import { orgDb } from "../org-db"
import { assertFound, ForbiddenActionError } from "./errors"
import { recordAudit } from "./audit"
import { notifyManagers } from "../notify"
import { notifyUserEventSafe } from "../notifications/dispatch"
import { getIssueSla, deadlinesFor, severityForCategory, type Severity } from "./issue-sla"
import type { ReportProblemInput } from "../zod-schemas"

/**
 * Severity + SLA deadlines for a new issue — the single place every intake
 * source (field, inspection, portal, QR, SMS) derives them, so an issue is
 * never created without an owner-accountability clock. (Phase 30)
 */
export async function issueSlaFields(orgId: string, category: string, severity?: Severity, now: Date = new Date()) {
  const sev = severity ?? severityForCategory(category)
  const sla = await getIssueSla(orgId)
  const { ackDeadline, resolveDeadline } = deadlinesFor(sev, now, sla)
  return { severity: sev, ackDeadline, resolveDeadline }
}

// Cleaning Issues — cleaner-reported problems AND failed-inspection issues are
// handled uniformly here. Minimal Team V1 workflow: list/detail, optional
// assignee, notes, and OPEN→ACKNOWLEDGED→RESOLVED→CLOSED status. No SLA,
// escalation, corrective-action engine, or routing.

export async function reportProblem(orgId: string, jobId: string, reporterId: string, input: ReportProblemInput) {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({
    where: { id: jobId },
    select: { id: true, serviceLocationId: true, title: true, serviceLocation: { select: { name: true } } },
  })
  assertFound(job, "Job")
  const sla = await issueSlaFields(orgId, input.category)
  const issue = await db.issue.create({
    data: {
      organizationId: orgId,
      jobId,
      serviceLocationId: job!.serviceLocationId,
      reportedById: reporterId,
      category: input.category,
      severity: sla.severity,
      ackDeadline: sla.ackDeadline,
      resolveDeadline: sla.resolveDeadline,
      title: input.title,
      description: input.description,
      status: "OPEN",
    },
  })
  await notifyManagers(
    orgId,
    `New problem reported: ${input.category}`,
    `A cleaner reported a problem at ${job!.serviceLocation.name} (${job!.title}):\n\n${input.description}`,
  )
  return issue
}

// ── Management workflow ───────────────────────────────────────────────────────

const listInclude = {
  reportedBy: { select: { name: true } },
  assignedTo: { select: { name: true } },
  serviceLocation: { select: { name: true, customer: { select: { name: true } } } },
  job: { select: { id: true, title: true } },
  inspection: { select: { id: true } },
} as const

export function listIssues(
  orgId: string,
  filters: { status?: string; category?: string; serviceLocationId?: string } = {},
) {
  const where: Record<string, unknown> = {}
  if (filters.status) where.status = filters.status
  if (filters.category) where.category = filters.category
  if (filters.serviceLocationId) where.serviceLocationId = filters.serviceLocationId
  return orgDb(orgId).issue.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: listInclude,
  })
}

const detailInclude = {
  reportedBy: { select: { name: true } },
  assignedTo: { select: { id: true, name: true } },
  verifier: { select: { id: true, name: true } },
  serviceLocation: { select: { id: true, name: true, customer: { select: { name: true } } } },
  job: { select: { id: true, title: true } },
  inspection: { select: { id: true, templateName: true, score: true, outcome: true } },
  photos: { select: { id: true, caption: true } },
  comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
} as const

export function getIssue(orgId: string, id: string) {
  return orgDb(orgId).issue.findFirst({ where: { id }, include: detailInclude })
}

export async function assignIssue(orgId: string, id: string, actorId: string, assigneeId: string | null, reason?: string) {
  const db = orgDb(orgId)
  const issue = await db.issue.findFirst({ where: { id }, select: { id: true, assignedToId: true } })
  assertFound(issue, "Issue")
  if (assigneeId) {
    const u = await db.user.findFirst({ where: { id: assigneeId, isActive: true }, select: { id: true } })
    assertFound(u, "Assignee")
  }
  // Reassigning resets the escalation clock-position (new owner starts at 0).
  await db.issue.updateMany({ where: { id }, data: { assignedToId: assigneeId, escalationLevel: 0 } })
  await recordAudit(orgId, actorId, "Issue", id, issue!.assignedToId ? "reassign" : "assign", { oldValue: issue!.assignedToId ?? undefined, newValue: assigneeId ?? undefined, metadata: { reason } })
  if (assigneeId) notifyUserEventSafe(orgId, assigneeId, "ISSUE_ASSIGNED", { subject: "An issue was assigned to you", body: "You've been assigned an issue to resolve. Open it in the app for details and the deadline." })
  return getIssue(orgId, id)
}

export async function setIssueStatus(orgId: string, id: string, actorId: string, status: string) {
  const db = orgDb(orgId)
  const issue = await db.issue.findFirst({ where: { id }, select: { status: true, category: true, severity: true, reopenCount: true } })
  assertFound(issue, "Issue")
  if (status === "CLOSED") throw new ForbiddenActionError("Close an issue via verification (a different person must verify the fix)")
  const now = new Date()
  const data: Record<string, unknown> = { status }
  if (status === "ACKNOWLEDGED") data.acknowledgedAt = now
  if (status === "RESOLVED") data.resolvedAt = now
  // Reopen: a reopened issue gets a FRESH deadline and keeps its history.
  const reopening = status === "OPEN" && (issue!.status === "RESOLVED" || issue!.status === "CLOSED")
  if (reopening) {
    const sla = await issueSlaFields(orgId, issue!.category, issue!.severity as Severity, now)
    data.ackDeadline = sla.ackDeadline
    data.resolveDeadline = sla.resolveDeadline
    data.acknowledgedAt = null
    data.resolvedAt = null
    data.closedAt = null
    data.verifierId = null
    data.escalationLevel = 0
    data.reopenCount = issue!.reopenCount + 1
  }
  await db.issue.updateMany({ where: { id }, data })
  await recordAudit(orgId, actorId, "Issue", id, reopening ? "reopen" : "status", { oldValue: issue!.status, newValue: status })
  return getIssue(orgId, id)
}

/** VERIFIER confirms a RESOLVED issue — must be a DIFFERENT person than the resolver. */
export async function verifyIssue(orgId: string, id: string, verifierId: string) {
  const db = orgDb(orgId)
  const issue = await db.issue.findFirst({ where: { id }, select: { status: true, assignedToId: true } })
  assertFound(issue, "Issue")
  if (issue!.status !== "RESOLVED") throw new ForbiddenActionError("Only a resolved issue can be verified")
  if (issue!.assignedToId && issue!.assignedToId === verifierId) {
    throw new ForbiddenActionError("The person who resolved an issue can't verify their own fix")
  }
  await db.issue.updateMany({ where: { id }, data: { status: "CLOSED", closedAt: new Date(), verifierId } })
  await recordAudit(orgId, verifierId, "Issue", id, "verify", { newValue: "CLOSED" })
  return getIssue(orgId, id)
}

export async function addIssueComment(orgId: string, id: string, authorId: string, body: string) {
  const db = orgDb(orgId)
  const issue = await db.issue.findFirst({ where: { id }, select: { id: true } })
  assertFound(issue, "Issue")
  await db.issueComment.create({ data: { organizationId: orgId, issueId: id, authorId, body } })
  return getIssue(orgId, id)
}

export function listJobIssues(orgId: string, jobId: string) {
  return orgDb(orgId).issue.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    include: { reportedBy: { select: { name: true } }, photos: { select: { id: true } } },
  })
}

/** Combined status/assignment history (material transitions) for the detail view. */
export function listIssueActivity(orgId: string, id: string) {
  return orgDb(orgId).auditEvent.findMany({
    where: { entityType: "Issue", entityId: id },
    orderBy: { createdAt: "desc" },
  })
}
