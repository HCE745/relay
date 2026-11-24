import { orgDb, systemDb } from "../org-db"
import { recordAudit } from "./audit"
import { assertFound } from "./errors"

// In-app help feedback: bug reports and feature requests, with optional private
// screenshot/recording attachments. Management-only visibility. Demo submissions
// are flagged (and never trigger external side-effects).

export type FeedbackKind = "BUG" | "FEATURE" | "QUESTION"
export type FeedbackStatus = "NEW" | "IN_REVIEW" | "PLANNED" | "RESOLVED" | "CLOSED"
export type AttachmentKind = "SCREENSHOT" | "RECORDING" | "UPLOAD"

export const FEEDBACK_STATUSES: FeedbackStatus[] = ["NEW", "IN_REVIEW", "PLANNED", "RESOLVED", "CLOSED"]

const FB_IMAGE = new Set(["image/png", "image/jpeg", "image/webp"])
const FB_VIDEO = new Set(["video/webm", "video/mp4"])
const MAX_IMAGE = 10 * 1024 * 1024 // 10 MB
const MAX_VIDEO = 25 * 1024 * 1024 // 25 MB

/** Validate an attachment by content type + size. Returns an error or null. */
export function validateFeedbackFile(contentType: string, sizeBytes: number): string | null {
  if (sizeBytes <= 0) return "Empty file"
  if (FB_IMAGE.has(contentType)) return sizeBytes > MAX_IMAGE ? "Image exceeds 10 MB" : null
  if (FB_VIDEO.has(contentType)) return sizeBytes > MAX_VIDEO ? "Recording exceeds 25 MB" : null
  return "Unsupported file type (allowed: PNG, JPEG, WebP, WebM, MP4)"
}

export function extForFeedback(contentType: string): string {
  const map: Record<string, string> = {
    "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
    "video/webm": "webm", "video/mp4": "mp4",
  }
  return map[contentType] ?? "bin"
}

export type NewAttachment = {
  kind: AttachmentKind
  storageRef: string
  contentType: string
  sizeBytes: number
  name?: string
}

export type NewFeedback = {
  type: FeedbackKind
  title: string
  description: string
  pageUrl?: string
  userAgent?: string
  consentVisual: boolean
  isDemo: boolean
}

export async function createFeedback(
  orgId: string,
  actor: { id: string; name?: string | null; email?: string | null },
  input: NewFeedback,
  attachments: NewAttachment[],
) {
  const row = await orgDb(orgId).feedbackSubmission.create({
    data: {
      organizationId: orgId,
      type: input.type,
      title: input.title.slice(0, 200),
      description: input.description.slice(0, 5000),
      pageUrl: input.pageUrl?.slice(0, 500),
      userAgent: input.userAgent?.slice(0, 500),
      submittedById: actor.id,
      submittedByName: actor.name ?? null,
      submittedByEmail: actor.email ?? null,
      isDemo: input.isDemo,
      consentVisual: input.consentVisual,
      attachments: attachments.length
        ? {
            create: attachments.map((a) => ({
              organizationId: orgId,
              kind: a.kind,
              storageRef: a.storageRef,
              contentType: a.contentType,
              sizeBytes: a.sizeBytes,
              name: a.name?.slice(0, 200),
            })),
          }
        : undefined,
    },
    select: { id: true },
  })
  await recordAudit(orgId, actor.id, "FeedbackSubmission", row.id, "create", {
    metadata: { type: input.type, attachments: attachments.length, isDemo: input.isDemo },
  })
  return row
}

const listSelect = {
  id: true, type: true, status: true, title: true, isDemo: true,
  submittedByName: true, pageUrl: true, createdAt: true,
  _count: { select: { attachments: true } },
} as const

export function listFeedback(orgId: string, filter: { status?: FeedbackStatus; type?: FeedbackKind } = {}) {
  return orgDb(orgId).feedbackSubmission.findMany({
    where: { ...(filter.status ? { status: filter.status } : {}), ...(filter.type ? { type: filter.type } : {}) },
    orderBy: [{ createdAt: "desc" }],
    select: listSelect,
  })
}

export function feedbackCounts(orgId: string) {
  return orgDb(orgId).feedbackSubmission.groupBy({ by: ["status"], _count: { _all: true } })
}

export function getFeedback(orgId: string, id: string) {
  return orgDb(orgId).feedbackSubmission.findFirst({
    where: { id },
    include: { attachments: { orderBy: { createdAt: "asc" } } },
  })
}

export async function updateFeedbackStatus(
  orgId: string,
  actorId: string,
  id: string,
  status: FeedbackStatus,
  resolutionNote?: string,
) {
  const db = orgDb(orgId)
  const existing = await db.feedbackSubmission.findFirst({ where: { id }, select: { id: true } })
  assertFound(existing, "Feedback")
  const resolved = status === "RESOLVED" || status === "CLOSED"
  await db.feedbackSubmission.updateMany({
    where: { id },
    data: {
      status,
      resolutionNote: resolutionNote ?? undefined,
      resolvedById: resolved ? actorId : null,
      resolvedAt: resolved ? new Date() : null,
    },
  })
  await recordAudit(orgId, actorId, "FeedbackSubmission", id, "status", { newValue: status, metadata: { resolutionNote } })
  return db.feedbackSubmission.findFirst({ where: { id }, include: { attachments: true } })
}

/** Load one attachment for authenticated, org-scoped streaming. */
export function getFeedbackAttachment(orgId: string, id: string) {
  return systemDb.feedbackAttachment.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, storageRef: true, contentType: true, name: true },
  })
}

// ── CleanWare platform-admin (cross-org) views ───────────────────────────────
// Used ONLY behind isPlatformAdmin — software feedback is CleanWare product data,
// aggregated across every customer org, never scoped to the viewer's own org.
export function listAllFeedback(filter: { status?: FeedbackStatus; type?: FeedbackKind } = {}) {
  return systemDb.feedbackSubmission.findMany({
    where: { ...(filter.status ? { status: filter.status } : {}), ...(filter.type ? { type: filter.type } : {}) },
    orderBy: [{ createdAt: "desc" }],
    select: { ...listSelect, organization: { select: { name: true } } },
  })
}
export function feedbackCountsAll() {
  return systemDb.feedbackSubmission.groupBy({ by: ["status"], _count: { _all: true } })
}
export function getFeedbackAny(id: string) {
  return systemDb.feedbackSubmission.findFirst({
    where: { id },
    include: { attachments: { orderBy: { createdAt: "asc" } }, organization: { select: { name: true } } },
  })
}
export function getFeedbackAttachmentAny(id: string) {
  return systemDb.feedbackAttachment.findFirst({ where: { id }, select: { id: true, storageRef: true, contentType: true, name: true } })
}
export async function updateFeedbackStatusAny(actorId: string, id: string, status: FeedbackStatus, resolutionNote?: string) {
  const resolved = status === "RESOLVED" || status === "CLOSED"
  await systemDb.feedbackSubmission.updateMany({
    where: { id },
    data: { status, resolutionNote: resolutionNote ?? undefined, resolvedById: resolved ? actorId : null, resolvedAt: resolved ? new Date() : null },
  })
  return systemDb.feedbackSubmission.findFirst({ where: { id }, include: { attachments: true } })
}
