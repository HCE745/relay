import { orgDb } from "../org-db"
import { sendEmailSafe } from "../email"
import { assertFound, ForbiddenActionError, ConflictError, ReferenceError } from "./errors"
import { recordAudit, listAuditForEntity } from "./audit"
import { uploadEmployeeReportPhoto } from "./photos"
import {
  canFileReport,
  canInvestigate,
  canManageView,
  canReporterView,
  canBeReviewer,
  canAddEvidence,
  accessibleTiers,
  authorizedRolesForTier,
  type ActorRole,
  type Confidentiality,
  type ReportRef,
} from "../employee-reports/access"
import {
  canTransition,
  statusForAction,
  outcomeForStatus,
  isFinding,
  type ReportAction,
  type ReportStatus,
} from "../employee-reports/workflow"

// P2 Employee Reporting & Supervisor Review — data layer.
//
// Reuses existing building blocks, never duplicating them:
//   • org isolation via orgDb;
//   • the generic AuditEvent trail (recordAudit) for the IMMUTABLE investigation
//     history, so who did what and when can always be reconstructed;
//   • JobPhoto for evidence (via uploadEmployeeReportPhoto — jobId-less, so it
//     never leaks into proof-of-service galleries);
//   • the notify/email layer for AUTHORIZED, content-free review alerts;
//   • the pure rules in ../employee-reports/{access,workflow} for every decision.
//
// EMPLOYEE PROTECTION: this module writes to NO performance/analytics record.
// A report is an allegation until a finding is recorded, and nothing here ever
// counts an allegation (or an unsubstantiated/inconclusive finding) against an
// employee. The data lives only in EmployeeReport + its audit trail.

const ENTITY = "EmployeeReport"

export type ReportActor = { userId: string; role: ActorRole }

export type CreateReportInput = {
  category: string
  confidentiality: Confidentiality
  title?: string
  description: string
  aboutUserId?: string | null
  jobId?: string | null
  jobChecklistItemId?: string | null
}

const detailInclude = {
  reportedBy: { select: { id: true, name: true } },
  about: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
  correctiveAssignee: { select: { id: true, name: true } },
  job: { select: { id: true, title: true } },
  checklistItem: { select: { id: true, label: true } },
  photos: { select: { id: true, createdAt: true, uploadedById: true }, orderBy: { createdAt: "asc" } },
} as const

async function assertOrgMember(orgId: string, userId: string, label: string) {
  const u = await orgDb(orgId).user.findFirst({
    where: { id: userId, isActive: true, role: { not: "CLIENT" } },
    select: { id: true },
  })
  if (!u) throw new ReferenceError(`${label} is not an active member of this organization`)
}

function refOf(r: { reportedById: string; aboutUserId: string | null; confidentiality: string }): ReportRef {
  return { reportedById: r.reportedById, aboutUserId: r.aboutUserId, confidentiality: r.confidentiality as Confidentiality }
}

/** Load the raw report (org-scoped) or throw 404. */
async function loadReport(orgId: string, id: string) {
  const report = await orgDb(orgId).employeeReport.findFirst({ where: { id }, include: detailInclude })
  return assertFound(report, "Report")
}

type LoadedReport = Awaited<ReturnType<typeof loadReport>>

/**
 * Strip investigation-internal fields for a reporter-only viewer. The reporter
 * sees the status + what they filed + their OWN evidence, but never the
 * investigator's finding, the reviewer's identity, the subject's response, or
 * restricted evidence an investigator attached. Applies to every confidentiality
 * tier — a reporter may follow their own confidential report at this same
 * redacted level.
 */
function redactForReporter(report: LoadedReport) {
  return {
    ...report,
    finding: null,
    employeeResponse: null,
    respondedAt: null,
    reviewerId: null,
    reviewer: null,
    reviewStartedAt: null,
    // Only evidence the reporter uploaded themselves — investigator evidence is
    // restricted (see canViewReportEvidence / getPhotoForServe).
    photos: report.photos.filter((p) => p.uploadedById === report.reportedById),
  }
}

/**
 * File a report. Any internal staff member may file. The subject (if any) and
 * any job/checklist links must belong to the org. Authorized management is
 * alerted with a CONTENT-FREE email. The subject is never notified.
 */
export async function createReport(orgId: string, actor: ReportActor, input: CreateReportInput) {
  if (!canFileReport(actor.role)) throw new ForbiddenActionError("Not authorized to file reports")
  const db = orgDb(orgId)

  if (input.aboutUserId) {
    if (input.aboutUserId === actor.userId) throw new ConflictError("You cannot file a report about yourself")
    await assertOrgMember(orgId, input.aboutUserId, "The subject")
  }
  if (input.jobId) {
    const job = await db.job.findFirst({ where: { id: input.jobId }, select: { id: true } })
    assertFound(job, "Job")
  }
  if (input.jobChecklistItemId) {
    const it = await db.jobChecklistItem.findFirst({
      where: { id: input.jobChecklistItemId, ...(input.jobId ? { jobId: input.jobId } : {}) },
      select: { id: true },
    })
    assertFound(it, "Checklist item")
  }

  const report = await db.employeeReport.create({
    data: {
      organizationId: orgId,
      reportedById: actor.userId,
      aboutUserId: input.aboutUserId ?? null,
      jobId: input.jobId ?? null,
      jobChecklistItemId: input.jobChecklistItemId ?? null,
      category: input.category as never,
      confidentiality: input.confidentiality as never,
      title: input.title ?? null,
      description: input.description,
      status: "SUBMITTED",
    },
    include: detailInclude,
  })

  await recordAudit(orgId, actor.userId, ENTITY, report.id, "report.create", {
    field: "status",
    newValue: "SUBMITTED",
    metadata: { category: input.category, confidentiality: input.confidentiality },
  })
  await notifyReviewers(orgId, report.id, input.confidentiality, [actor.userId, input.aboutUserId ?? ""].filter(Boolean))
  return report
}

/**
 * Resolve the AUTHORIZED recipients for a tier and send a content-free alert.
 * Confidential reports reach only OWNER/ADMIN; the subject and reporter are
 * always excluded (alternative escalation when the accused is a supervisor).
 */
async function notifyReviewers(orgId: string, reportId: string, tier: Confidentiality, excludeUserIds: string[]) {
  const roles = authorizedRolesForTier(tier) as string[]
  const recipients = await orgDb(orgId).user.findMany({
    where: { role: { in: roles as never }, isActive: true, id: { notIn: excludeUserIds.length ? excludeUserIds : ["__none__"] } },
    select: { email: true },
  })
  const to = recipients.map((r) => r.email).filter(Boolean)
  if (!to.length) return
  const label = tier === "CONFIDENTIAL" ? "confidential workplace" : tier === "PRIVATE" ? "workplace" : "work-quality"
  // Deliberately NO details — the alert only says a review is needed.
  sendEmailSafe({
    to,
    subject: `A ${label} report needs review`,
    text: `A new ${label} report has been filed and needs review. Sign in to review it in the Reports area. (Details are intentionally omitted from this email.)`,
  })
}

/** Management list, filtered to the actor's confidentiality tiers and excluding
 *  reports ABOUT the actor. `mine` (or a CLEANER) returns the actor's OWN filed
 *  reports (redacted). */
export async function listReports(orgId: string, actor: ReportActor, opts: { status?: ReportStatus; mine?: boolean } = {}) {
  const db = orgDb(orgId)
  const tiers = [...accessibleTiers(actor.role)]
  const wantMine = opts.mine || tiers.length === 0

  if (wantMine) {
    const rows = await db.employeeReport.findMany({
      where: { reportedById: actor.userId, ...(opts.status ? { status: opts.status } : {}) },
      include: detailInclude,
      orderBy: { createdAt: "desc" },
    })
    return rows.map(redactForReporter)
  }

  const rows = await db.employeeReport.findMany({
    where: {
      confidentiality: { in: tiers as never },
      NOT: { aboutUserId: actor.userId },
      ...(opts.status ? { status: opts.status } : {}),
    },
    include: detailInclude,
    orderBy: { createdAt: "desc" },
  })
  return rows
}

/** Report detail, access-checked. Management viewers get full detail; the
 *  reporter gets a redacted view; everyone else is refused. */
export async function getReport(orgId: string, actor: ReportActor, id: string) {
  const report = await loadReport(orgId, id)
  const ref = refOf(report)
  if (canManageView(actor, ref).allowed) return report
  if (canReporterView(actor, ref)) return redactForReporter(report)
  throw new ForbiddenActionError("Not authorized to view this report")
}

/** Assign a reviewer and move SUBMITTED → PENDING_REVIEW. */
export async function assignReviewer(orgId: string, actor: ReportActor, id: string, reviewerId: string) {
  const db = orgDb(orgId)
  const report = await loadReport(orgId, id)
  const ref = refOf(report)
  const can = canInvestigate(actor, ref)
  if (!can.allowed) throw new ForbiddenActionError(can.reason)

  // The reviewer must be a real org member who may investigate this report.
  const reviewer = await db.user.findFirst({ where: { id: reviewerId, isActive: true }, select: { id: true, role: true } })
  assertFound(reviewer, "Reviewer")
  if (!canBeReviewer({ role: reviewer!.role as ActorRole, userId: reviewer!.id }, ref)) {
    throw new ForbiddenActionError("That person cannot review this report (conflict of interest or insufficient access)")
  }

  const to: ReportStatus = "PENDING_REVIEW"
  if (report.status !== "SUBMITTED" && report.status !== "PENDING_REVIEW") {
    throw new ConflictError(`Cannot assign a reviewer to a ${report.status} report`)
  }
  const updated = await db.employeeReport.updateMany({
    where: { id },
    data: { reviewerId, status: "PENDING_REVIEW" },
  })
  void updated
  await recordAudit(orgId, actor.userId, ENTITY, id, "report.assign", {
    field: "reviewerId",
    oldValue: report.reviewerId ?? undefined,
    newValue: reviewerId,
    metadata: { status: to },
  })
  return loadReport(orgId, id)
}

/** Advance the investigation (start review, record a finding, resolve, reopen). */
export async function transitionReport(
  orgId: string,
  actor: ReportActor,
  id: string,
  action: ReportAction,
  opts: { note?: string } = {},
) {
  const db = orgDb(orgId)
  const report = await loadReport(orgId, id)
  const ref = refOf(report)
  const can = canInvestigate(actor, ref)
  if (!can.allowed) throw new ForbiddenActionError(can.reason)

  const to = statusForAction(action)
  if (!to) throw new ReferenceError(`Unknown action ${action}`)
  if (!canTransition(report.status as ReportStatus, to)) {
    throw new ConflictError(`Cannot ${action} a ${report.status} report`)
  }

  const data: Record<string, unknown> = { status: to }
  if (action === "start_review" && !report.reviewStartedAt) data.reviewStartedAt = new Date()
  if (isFinding(to)) {
    data.outcome = outcomeForStatus(to)
    if (opts.note) data.finding = opts.note
  }
  if (action === "resolve") {
    data.resolvedAt = new Date()
    data.resolvedById = actor.userId
  }

  await db.employeeReport.updateMany({ where: { id }, data })
  await recordAudit(orgId, actor.userId, ENTITY, id, `report.${action}`, {
    field: "status",
    oldValue: report.status,
    newValue: to,
    metadata: { note: opts.note },
  })
  return loadReport(orgId, id)
}

/** Record the subject employee's response (solicited and entered by management). */
export async function recordEmployeeResponse(orgId: string, actor: ReportActor, id: string, response: string) {
  const db = orgDb(orgId)
  const report = await loadReport(orgId, id)
  const can = canInvestigate(actor, refOf(report))
  if (!can.allowed) throw new ForbiddenActionError(can.reason)
  await db.employeeReport.updateMany({ where: { id }, data: { employeeResponse: response, respondedAt: new Date() } })
  await recordAudit(orgId, actor.userId, ENTITY, id, "report.response", { field: "employeeResponse" })
  return loadReport(orgId, id)
}

/** Request a correction / assign follow-up work — only on a SUBSTANTIATED report. */
export async function setCorrectiveAction(
  orgId: string,
  actor: ReportActor,
  id: string,
  input: { action: string; dueAt?: string | null; assigneeId?: string | null },
) {
  const db = orgDb(orgId)
  const report = await loadReport(orgId, id)
  const can = canInvestigate(actor, refOf(report))
  if (!can.allowed) throw new ForbiddenActionError(can.reason)
  if (report.outcome !== "SUBSTANTIATED") {
    throw new ConflictError("Corrective action can only be set on a substantiated report")
  }
  if (input.assigneeId) await assertOrgMember(orgId, input.assigneeId, "The corrective assignee")
  await db.employeeReport.updateMany({
    where: { id },
    data: {
      correctiveAction: input.action,
      correctiveDueAt: input.dueAt ? new Date(input.dueAt) : null,
      correctiveAssigneeId: input.assigneeId ?? null,
    },
  })
  await recordAudit(orgId, actor.userId, ENTITY, id, "report.corrective", {
    field: "correctiveAction",
    metadata: { dueAt: input.dueAt, assigneeId: input.assigneeId },
  })
  return loadReport(orgId, id)
}

/** Attach photographic evidence. The reporter (their own report) or an
 *  authorized investigator. Evidence is jobId-less (never in job galleries). */
export async function addReportEvidence(
  orgId: string,
  actor: ReportActor,
  id: string,
  photo: { data: Buffer; contentType: string; sizeBytes: number; caption?: string },
) {
  const report = await loadReport(orgId, id)
  if (!canAddEvidence(actor, refOf(report))) throw new ForbiddenActionError("Not authorized to add evidence to this report")
  const row = await uploadEmployeeReportPhoto(orgId, id, actor.userId, photo)
  await recordAudit(orgId, actor.userId, ENTITY, id, "report.evidence", { metadata: { photoId: row.id } })
  return row
}

/** The immutable investigation history. Management viewers only. */
export async function reportHistory(orgId: string, actor: ReportActor, id: string) {
  const report = await loadReport(orgId, id)
  const view = canManageView(actor, refOf(report))
  if (!view.allowed) throw new ForbiddenActionError("Not authorized to view this report's history")
  return listAuditForEntity(orgId, ENTITY, id)
}
