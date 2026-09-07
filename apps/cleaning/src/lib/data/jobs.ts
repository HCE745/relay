import { orgDb, systemDb } from "../org-db"
import { assertFound, ConflictError } from "./errors"
import { recordAudit } from "./audit"
import { wallTimeToInstant } from "../scheduling/time"
import type { z } from "zod"
import type { manualJobCreateSchema, jobUpdateSchema } from "../zod-schemas"

type ManualInput = z.infer<typeof manualJobCreateSchema>
type UpdateInput = z.infer<typeof jobUpdateSchema>

const jobListInclude = {
  serviceLocation: {
    select: { id: true, name: true, timezone: true, customerId: true, customer: { select: { name: true } } },
  },
  assignments: { include: { user: { select: { id: true, name: true } } } },
} as const

export function listJobsInWindow(orgId: string, start: Date, end: Date) {
  return orgDb(orgId).job.findMany({
    where: { scheduledStart: { gte: start, lte: end } },
    orderBy: { scheduledStart: "asc" },
    include: jobListInclude,
  })
}

export function getJob(orgId: string, id: string) {
  return orgDb(orgId).job.findFirst({
    where: { id },
    include: {
      serviceLocation: {
        select: { id: true, name: true, timezone: true, customerId: true, customer: { select: { name: true } } },
      },
      servicePlan: { select: { id: true, name: true } },
      assignments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { assignedAt: "asc" },
      },
      checklistItems: { orderBy: { sortOrder: "asc" }, include: { photos: { select: { id: true } } } },
      timeEntries: {
        orderBy: { clockInAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
      photos: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
      issues: {
        orderBy: { createdAt: "desc" },
        include: { reportedBy: { select: { name: true } }, photos: { select: { id: true } } },
      },
      inspections: {
        orderBy: { createdAt: "desc" },
        include: { inspector: { select: { name: true } } },
      },
    },
  })
}

async function effectiveTimezone(orgId: string, siteTimezone: string | null): Promise<string> {
  if (siteTimezone) return siteTimezone
  const org = await systemDb.organization.findUnique({ where: { id: orgId }, select: { timezone: true } })
  return org?.timezone ?? "America/New_York"
}

export async function createManualJob(orgId: string, input: ManualInput) {
  const db = orgDb(orgId)
  const site = await db.serviceLocation.findFirst({
    where: { id: input.serviceLocationId },
    select: { id: true, timezone: true },
  })
  assertFound(site, "Service location")

  // Optional scope: snapshot the chosen checklist template (org-validated).
  let snapshot: Array<{ label: string; instructions: string | null; isRequired: boolean; requirePhoto: boolean; sortOrder: number }> = []
  if (input.checklistTemplateId) {
    const tpl = await db.checklistTemplate.findFirst({
      where: { id: input.checklistTemplateId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    })
    assertFound(tpl, "Checklist template")
    snapshot = tpl!.items.map((it) => ({
      label: it.label,
      instructions: it.instructions,
      isRequired: it.isRequired,
      requirePhoto: it.requirePhoto,
      sortOrder: it.sortOrder,
    }))
  }

  const tz = await effectiveTimezone(orgId, site!.timezone)
  const start = wallTimeToInstant(input.date, input.startTime, tz)
  const end = input.durationMin ? new Date(start.getTime() + input.durationMin * 60_000) : null

  return db.job.create({
    data: {
      organizationId: orgId,
      serviceLocationId: site!.id,
      servicePlanId: null,
      title: input.title,
      status: "SCHEDULED",
      scheduledStart: start,
      scheduledEnd: end,
      crewSize: input.crewSize,
      notes: input.notes,
      checklistItems: snapshot.length ? { create: snapshot } : undefined,
    },
  })
}

export async function updateJob(orgId: string, id: string, input: UpdateInput) {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({ where: { id }, select: { id: true, serviceLocation: { select: { timezone: true } } } })
  if (!job) return null

  const data: Record<string, unknown> = {}
  if (input.title !== undefined) data.title = input.title
  if (input.notes !== undefined) data.notes = input.notes
  if (input.crewSize !== undefined) data.crewSize = input.crewSize
  // Rescheduling a single Job is a per-Job change and never affects the plan.
  if (input.date && input.startTime) {
    const tz = await effectiveTimezone(orgId, job.serviceLocation.timezone)
    data.scheduledStart = wallTimeToInstant(input.date, input.startTime, tz)
  }

  const { count } = await db.job.updateMany({ where: { id }, data })
  if (count === 0) return null
  return getJob(orgId, id)
}

export async function cancelJob(orgId: string, id: string) {
  const { count } = await orgDb(orgId).job.updateMany({ where: { id }, data: { status: "CANCELLED" } })
  return count > 0
}

/** Manually mark an uncompleted job MISSED (audited). No automated MISSED logic. */
export async function markJobMissed(orgId: string, id: string, actorId: string, reason: string) {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({ where: { id }, select: { status: true } })
  assertFound(job, "Job")
  if (job!.status === "COMPLETED") throw new ConflictError("Cannot mark a completed job as missed")
  if (job!.status === "CANCELLED") throw new ConflictError("This job is cancelled")
  if (job!.status === "MISSED") return { alreadyMissed: true }
  await db.job.updateMany({ where: { id }, data: { status: "MISSED" } })
  await recordAudit(orgId, actorId, "Job", id, "mark_missed", { metadata: { reason } })
  return { alreadyMissed: false }
}
