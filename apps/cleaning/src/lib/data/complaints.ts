import { orgDb } from "../org-db"
import { assertFound, ForbiddenActionError, ConflictError, ReferenceError, RequirementsError } from "./errors"
import { recordAudit, listAuditForEntity } from "./audit"
import { notifyManagers } from "../notify"
import { notifyUserEventSafe } from "../notifications/dispatch"
import {
  isCustomerComplaint,
  canRecordOutcome,
  deriveResponsibilities,
  type ComplaintOutcome,
} from "../complaints/investigation"

// P3 Customer complaint linkage, investigation & corrective work — data layer.
//
// A complaint is the EXISTING Issue (source = CUSTOMER); this module does NOT
// introduce a second complaint store. It reuses:
//   • Issue (the complaint itself: intake, SLA, routing, escalation, comments),
//   • WorkOrder (corrective rework, with its resolve/verify flow + billing),
//   • AuditEvent (immutable investigation history),
//   • JobPhoto / Inspection (evidence), JobChecklistItem / JobAssignment (who was
//     responsible), and the notify layer.
// It adds only: the investigation OUTCOME/finding on the Issue, a frozen
// responsibility SNAPSHOT (ComplaintResponsibility), and a neutral corrective
// assignment. EMPLOYEE PROTECTION: nothing here writes a performance record, and
// an outcome never auto-counts (see outcomeCountsAgainstEmployee, used by P4).

const ENTITY = "Issue"

const caseInclude = {
  reportedBy: { select: { name: true } },
  assignedTo: { select: { id: true, name: true } },
  verifier: { select: { id: true, name: true } },
  investigatedBy: { select: { id: true, name: true } },
  serviceLocation: { select: { id: true, name: true, customer: { select: { id: true, name: true } } } },
  job: { select: { id: true, title: true, checklistItems: { select: { id: true, label: true }, orderBy: { sortOrder: "asc" } } } },
  checklistItem: { select: { id: true, label: true, verificationStatus: true } },
  inspection: { select: { id: true, templateName: true, score: true, outcome: true } },
  photos: { select: { id: true, caption: true } },
  responsibilities: {
    orderBy: { capturedAt: "asc" },
    include: { user: { select: { id: true, name: true } } },
  },
  workOrder: {
    select: { id: true, status: true, isCorrective: true, dueAt: true, assignedToId: true, resolvedById: true, verifiedById: true, assignedTo: { select: { id: true, name: true } } },
  },
} as const

/** Load a complaint (a CUSTOMER issue) or throw — non-customer issues are not
 *  part of the complaint-investigation surface. */
async function loadComplaint(orgId: string, id: string) {
  const issue = await orgDb(orgId).issue.findFirst({ where: { id }, include: caseInclude })
  assertFound(issue, "Complaint")
  if (!isCustomerComplaint(issue!.source)) throw new ForbiddenActionError("That issue is not a customer complaint")
  return issue!
}

/** List customer complaints (optionally by status / investigation outcome). */
export function listComplaints(orgId: string, filters: { status?: string; outcome?: string } = {}) {
  const where: Record<string, unknown> = { source: "CUSTOMER" }
  if (filters.status) where.status = filters.status
  if (filters.outcome) where.outcome = filters.outcome
  return orgDb(orgId).issue.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      serviceLocation: { select: { name: true, customer: { select: { name: true } } } },
      job: { select: { id: true, title: true } },
      assignedTo: { select: { name: true } },
      investigatedBy: { select: { name: true } },
      _count: { select: { responsibilities: true } },
      workOrder: { select: { id: true, status: true, isCorrective: true } },
    },
  })
}

/** Full complaint case for the management detail view. */
export async function getComplaintCase(orgId: string, id: string) {
  const issue = await loadComplaint(orgId, id)
  const activity = await listAuditForEntity(orgId, ENTITY, id)
  return { issue, activity }
}

/** Link (or clear) the checklist task a complaint is about, then refresh the
 *  responsibility snapshot. The task must belong to the complaint's job. */
export async function linkComplaintTask(orgId: string, actorId: string, id: string, itemId: string | null) {
  const db = orgDb(orgId)
  const issue = await loadComplaint(orgId, id)
  if (itemId) {
    const it = await db.jobChecklistItem.findFirst({
      where: { id: itemId, ...(issue.jobId ? { jobId: issue.jobId } : {}) },
      select: { id: true },
    })
    if (!it) throw new ReferenceError(issue.jobId ? "That task is not on this complaint's job" : "Link the complaint to a job before linking a task")
  }
  await db.issue.updateMany({ where: { id }, data: { jobChecklistItemId: itemId } })
  await recordAudit(orgId, actorId, ENTITY, id, itemId ? "complaint.link-task" : "complaint.unlink-task", {
    field: "jobChecklistItemId",
    oldValue: issue.jobChecklistItemId ?? undefined,
    newValue: itemId ?? undefined,
  })
  if (itemId) await captureResponsibility(orgId, id, actorId)
  return getComplaintCase(orgId, id)
}

/**
 * Capture WHO was responsible for the work a complaint is about — an immutable
 * snapshot taken from the live job/checklist. First-capture-wins: once a snapshot
 * exists it is frozen (so later edits to the job never rewrite responsibility
 * history). Establishes no fault; it preserves facts.
 */
export async function captureResponsibility(orgId: string, id: string, actorId: string) {
  const db = orgDb(orgId)
  const existing = await db.complaintResponsibility.findMany({ where: { issueId: id }, select: { id: true } })
  if (existing.length) return existing.length // already frozen — preserve it

  const issue = await db.issue.findFirst({ where: { id }, select: { id: true, source: true, jobId: true, jobChecklistItemId: true } })
  assertFound(issue, "Complaint")
  if (!isCustomerComplaint(issue!.source)) throw new ForbiddenActionError("That issue is not a customer complaint")

  const it = issue!.jobChecklistItemId
    ? await db.jobChecklistItem.findFirst({
        where: { id: issue!.jobChecklistItemId },
        select: { id: true, label: true, assignedToId: true, completedById: true, verifierId: true, verificationStatus: true, completedAt: true },
      })
    : null
  const crew = issue!.jobId
    ? await db.jobAssignment.findMany({ where: { jobId: issue!.jobId }, select: { userId: true } })
    : []

  const rows = deriveResponsibilities({
    checklistItem: it
      ? {
          id: it.id,
          label: it.label,
          assignedToId: it.assignedToId,
          completedById: it.completedById,
          verifierId: it.verifierId,
          verificationStatus: it.verificationStatus, // TaskVerificationStatus ⊆ string
          completedAt: it.completedAt,
        }
      : null,
    jobAssigneeIds: crew.map((c) => c.userId),
  })
  if (!rows.length) return 0

  await db.complaintResponsibility.createMany({
    data: rows.map((r) => ({
      organizationId: orgId,
      issueId: id,
      userId: r.userId,
      basis: r.basis as "TASK_ASSIGNEE",
      jobChecklistItemId: r.jobChecklistItemId,
      taskLabel: r.taskLabel,
      verificationStatus: r.verificationStatus,
      completedAt: r.completedAt,
      capturedById: actorId,
    })),
  })
  await recordAudit(orgId, actorId, ENTITY, id, "complaint.responsibility-captured", { metadata: { count: rows.length } })
  return rows.length
}

/**
 * Record the investigation outcome + written finding on a complaint. A complaint
 * is an allegation until this is set; an outcome may be revised while the case is
 * open but not after it is CLOSED. Only SUBSTANTIATED may ever feed performance
 * analytics — enforced downstream by outcomeCountsAgainstEmployee, never here.
 */
export async function recordComplaintOutcome(
  orgId: string,
  actorId: string,
  id: string,
  input: { outcome: ComplaintOutcome; finding?: string | null },
) {
  const db = orgDb(orgId)
  const issue = await loadComplaint(orgId, id)
  if (!canRecordOutcome(issue.status)) throw new ConflictError("This complaint is closed; reopen it to change the finding")
  // Snapshot responsibility at investigation time if not already frozen.
  await captureResponsibility(orgId, id, actorId)
  await db.issue.updateMany({
    where: { id },
    data: { outcome: input.outcome, finding: input.finding ?? null, investigatedById: actorId, investigatedAt: new Date() },
  })
  await recordAudit(orgId, actorId, ENTITY, id, "complaint.outcome", {
    field: "outcome",
    oldValue: issue.outcome ?? undefined,
    newValue: input.outcome,
  })
  return getComplaintCase(orgId, id)
}

/**
 * Create + assign corrective rework for a complaint. Reuses the corrective
 * WorkOrder (non-billable by default), one per complaint (Issue.workOrder is
 * unique). The assignee is notified with NEUTRAL wording — the notification
 * never exposes the complaint text, the customer's accusation, or any finding.
 */
export async function assignCorrectiveWork(
  orgId: string,
  actorId: string,
  id: string,
  input: { assigneeId?: string | null; description: string; dueAt?: string | null; billable?: boolean },
) {
  const db = orgDb(orgId)
  const issue = await loadComplaint(orgId, id)
  if (issue.workOrder) throw new ConflictError("This complaint already has a work order")

  const customerId = issue.serviceLocation?.customer?.id
  if (!customerId) throw new RequirementsError("Can't tell which customer this is for", ["Link the complaint to a site or job first"])
  const serviceLocationId = issue.serviceLocation?.id ?? undefined

  let assigneeId: string | null = null
  if (input.assigneeId) {
    const u = await db.user.findFirst({ where: { id: input.assigneeId, isActive: true, role: { not: "CLIENT" } }, select: { id: true } })
    if (!u) throw new ReferenceError("That employee is not an active member of this organization")
    assigneeId = input.assigneeId
  }

  const wo = await db.workOrder.create({
    data: {
      organizationId: orgId,
      customerId,
      serviceLocationId,
      type: "ADDITIONAL",
      description: input.description.slice(0, 500),
      priority: "NORMAL",
      billable: input.billable ?? false, // rework is on us by default
      isCorrective: true,
      issueId: id,
      assignedToId: assigneeId,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      status: "REQUESTED",
      createdById: actorId,
    },
    select: { id: true },
  })
  await recordAudit(orgId, actorId, ENTITY, id, "complaint.corrective-assigned", {
    metadata: { workOrderId: wo.id, assigneeId, dueAt: input.dueAt ?? null },
  })
  // Neutral, accusation-free notice to the assignee.
  if (assigneeId) {
    notifyUserEventSafe(orgId, assigneeId, "CORRECTIVE_ASSIGNED", {
      subject: "Corrective work assigned to you",
      body: "You've been assigned follow-up work. Open the app for the details and the due date.",
    })
  }
  return getComplaintCase(orgId, id)
}

/** Notify management that a new customer complaint was received. Called from the
 *  portal intake. Content is a neutral heads-up, not the accusation specifics. */
export async function notifyComplaintReceived(orgId: string, siteName: string) {
  await notifyManagers(
    orgId,
    "New customer complaint received",
    `A customer submitted a complaint about ${siteName}. Review it in the Issues → Customer complaints area.`,
  )
}
