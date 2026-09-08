import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import { recordAudit } from "./audit"
import { notifyManagers } from "../notify"
import type { ReportProblemInput } from "../zod-schemas"

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
  const issue = await db.issue.create({
    data: {
      organizationId: orgId,
      jobId,
      serviceLocationId: job!.serviceLocationId,
      reportedById: reporterId,
      category: input.category,
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
  serviceLocation: { select: { id: true, name: true, customer: { select: { name: true } } } },
  job: { select: { id: true, title: true } },
  inspection: { select: { id: true, templateName: true, score: true, outcome: true } },
  photos: { select: { id: true, caption: true } },
  comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
} as const

export function getIssue(orgId: string, id: string) {
  return orgDb(orgId).issue.findFirst({ where: { id }, include: detailInclude })
}

export async function assignIssue(orgId: string, id: string, actorId: string, assigneeId: string | null) {
  const db = orgDb(orgId)
  const issue = await db.issue.findFirst({ where: { id }, select: { id: true } })
  assertFound(issue, "Issue")
  if (assigneeId) {
    const u = await db.user.findFirst({ where: { id: assigneeId, isActive: true }, select: { id: true } })
    assertFound(u, "Assignee")
  }
  await db.issue.updateMany({ where: { id }, data: { assignedToId: assigneeId } })
  await recordAudit(orgId, actorId, "Issue", id, "assign", { metadata: { assigneeId } })
  return getIssue(orgId, id)
}

export async function setIssueStatus(orgId: string, id: string, actorId: string, status: string) {
  const db = orgDb(orgId)
  const issue = await db.issue.findFirst({ where: { id }, select: { status: true } })
  assertFound(issue, "Issue")
  const now = new Date()
  const data: Record<string, unknown> = { status }
  if (status === "ACKNOWLEDGED") data.acknowledgedAt = now
  if (status === "RESOLVED") data.resolvedAt = now
  if (status === "CLOSED") data.closedAt = now
  await db.issue.updateMany({ where: { id }, data })
  await recordAudit(orgId, actorId, "Issue", id, "status", { oldValue: issue!.status, newValue: status })
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
