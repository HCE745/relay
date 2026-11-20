import { orgDb, systemDb } from "../org-db"
import { assertFound, ForbiddenActionError, ConflictError, ReferenceError } from "./errors"
import { recordAudit, listAuditForEntity } from "./audit"
import {
  canAssignTasks,
  canSelfAssign,
  canWorkTask,
  canVerifyTask,
  canTransition,
  isSelfVerification,
  isCompleteForStatus,
  submitTargetStatus,
  type ActorRole,
  type TaskVerificationStatus,
} from "../tasks/verification"

// P1 Task Ownership & Verification — data layer.
//
// Reuses the existing building blocks rather than adding parallel systems:
//   • org isolation via orgDb (Job is org-scoped; JobChecklistItem /
//     ChecklistItemAssignee are reached through the validated jobId/itemId);
//   • the generic AuditEvent trail (recordAudit) for the IMMUTABLE assignment +
//     status history, so responsibility can be reconstructed after a complaint;
//   • the pure rules in ../tasks/verification for every permission decision.
//
// All mutations keep the legacy JobChecklistItem.isComplete/completedAt/
// completedById in sync with the new verificationStatus so existing field and
// reporting code is unaffected.

const ENTITY = "JobChecklistItem"

export type TaskActor = { userId: string; role: ActorRole }

type LoadedItem = {
  id: string
  jobId: string
  label: string
  assignedToId: string | null
  completedById: string | null
  verificationStatus: TaskVerificationStatus
  assignees: { userId: string }[]
}

async function assertJob(db: ReturnType<typeof orgDb>, jobId: string) {
  // Job IS org-scoped: a cross-org id returns null here.
  const job = await db.job.findFirst({ where: { id: jobId }, select: { id: true } })
  assertFound(job, "Job")
}

async function loadItem(db: ReturnType<typeof orgDb>, jobId: string, itemId: string): Promise<LoadedItem> {
  const item = await db.jobChecklistItem.findFirst({
    where: { id: itemId, jobId },
    select: {
      id: true,
      jobId: true,
      label: true,
      assignedToId: true,
      completedById: true,
      verificationStatus: true,
      assignees: { select: { userId: true } },
    },
  })
  return assertFound(item, "Checklist item") as LoadedItem
}

/** CLEANERS must be on the job's crew to act in the field; supervisory roles need not be. */
async function assertFieldAccess(db: ReturnType<typeof orgDb>, jobId: string, actor: TaskActor) {
  if (actor.role !== "CLEANER") return
  const a = await db.jobAssignment.findFirst({ where: { jobId, userId: actor.userId }, select: { id: true } })
  if (!a) throw new ForbiddenActionError("You are not assigned to this job")
}

async function assertActiveOrgMember(orgId: string, userId: string) {
  const u = await orgDb(orgId).user.findFirst({
    where: { id: userId, isActive: true, role: { not: "CLIENT" } },
    select: { id: true },
  })
  if (!u) throw new ReferenceError(`User ${userId} is not an active member of this organization`)
}

async function orgFlags(orgId: string): Promise<{ peerVerificationEnabled: boolean; verificationRequired: boolean }> {
  const org = await systemDb.organization.findUnique({
    where: { id: orgId },
    select: { peerVerificationEnabled: true, verificationRequired: true },
  })
  return {
    peerVerificationEnabled: !!org?.peerVerificationEnabled,
    verificationRequired: !!org?.verificationRequired,
  }
}

function reloadItem(orgId: string, jobId: string, itemId: string) {
  return orgDb(orgId).jobChecklistItem.findFirst({
    where: { id: itemId, jobId },
    include: { assignees: { select: { userId: true } }, photos: { select: { id: true } } },
  })
}

/**
 * Assign (or reassign) a checklist task to one or more employees. Supervisory
 * roles only. The primary owner is the first id; additional ids are shared
 * owners. Records the before→after owner on the audit trail.
 */
export async function assignChecklistTask(
  orgId: string,
  jobId: string,
  itemId: string,
  actor: TaskActor,
  assigneeIds: string[],
) {
  if (!canAssignTasks(actor.role)) throw new ForbiddenActionError("Not authorized to assign work")
  const db = orgDb(orgId)
  await assertJob(db, jobId)
  const item = await loadItem(db, jobId, itemId)

  const unique = [...new Set(assigneeIds)].filter(Boolean)
  for (const id of unique) await assertActiveOrgMember(orgId, id)
  const primary = unique[0] ?? null

  // Replace the shared-owner set and set the primary owner.
  await db.jobChecklistItem.updateMany({ where: { id: itemId, jobId }, data: { assignedToId: primary } })
  await db.checklistItemAssignee.deleteMany({ where: { jobChecklistItemId: itemId } })
  if (unique.length) {
    await db.checklistItemAssignee.createMany({
      data: unique.map((userId) => ({ jobChecklistItemId: itemId, userId })),
    })
  }

  await recordAudit(orgId, actor.userId, ENTITY, itemId, "task.assign", {
    field: "assignedToId",
    oldValue: item.assignedToId ?? undefined,
    newValue: primary ?? undefined,
    metadata: { assigneeIds: unique, jobId },
  })
  return reloadItem(orgId, jobId, itemId)
}

/** A cleaner claims an UNOWNED task on a job they are on (self-assign / divide work). */
export async function selfAssignChecklistTask(orgId: string, jobId: string, itemId: string, actor: TaskActor) {
  const db = orgDb(orgId)
  await assertJob(db, jobId)
  await assertFieldAccess(db, jobId, actor)
  const item = await loadItem(db, jobId, itemId)
  if (!canSelfAssign({ role: actor.role, currentAssignedToId: item.assignedToId })) {
    throw new ConflictError("This task already has an assigned owner")
  }
  await db.jobChecklistItem.updateMany({ where: { id: itemId, jobId }, data: { assignedToId: actor.userId } })
  // Upsert the shared-owner row without the blocked upsert op.
  const existing = await db.checklistItemAssignee.findFirst({
    where: { jobChecklistItemId: itemId, userId: actor.userId },
    select: { id: true },
  })
  if (!existing) {
    await db.checklistItemAssignee.create({ data: { jobChecklistItemId: itemId, userId: actor.userId } })
  }
  await recordAudit(orgId, actor.userId, ENTITY, itemId, "task.self_assign", {
    field: "assignedToId",
    oldValue: item.assignedToId ?? undefined,
    newValue: actor.userId,
    metadata: { jobId },
  })
  return reloadItem(orgId, jobId, itemId)
}

/** Worker moves an assigned task into progress. */
export async function startChecklistTask(orgId: string, jobId: string, itemId: string, actor: TaskActor) {
  return transitionWorkerState(orgId, jobId, itemId, actor, "IN_PROGRESS", "task.start")
}

/** Worker reports the task complete — now AWAITING independent verification. */
export async function submitChecklistTask(
  orgId: string,
  jobId: string,
  itemId: string,
  actor: TaskActor,
  opts: { note?: string } = {},
) {
  const db = orgDb(orgId)
  await assertJob(db, jobId)
  await assertFieldAccess(db, jobId, actor)
  const item = await loadItem(db, jobId, itemId)
  if (!canWorkTask({ role: actor.role, userId: actor.userId, assignedToId: item.assignedToId, sharedAssigneeIds: item.assignees.map((a) => a.userId) })) {
    throw new ForbiddenActionError("You are not responsible for this task")
  }
  // When the org requires independent verification the task waits for a verifier;
  // otherwise it is simply COMPLETED (done, no wait) — still distinct from VERIFIED.
  const { verificationRequired } = await orgFlags(orgId)
  const to: TaskVerificationStatus = submitTargetStatus(verificationRequired)
  if (!canTransition(item.verificationStatus, to)) {
    throw new ConflictError(`Cannot submit a task that is ${item.verificationStatus}`)
  }
  await db.jobChecklistItem.updateMany({
    where: { id: itemId, jobId },
    data: {
      verificationStatus: to,
      isComplete: isCompleteForStatus(to),
      completedAt: new Date(),
      completedById: actor.userId,
      note: opts.note ?? undefined,
    },
  })
  await recordAudit(orgId, actor.userId, ENTITY, itemId, "task.submit", {
    field: "verificationStatus",
    oldValue: item.verificationStatus,
    newValue: to,
    metadata: { jobId },
  })
  return reloadItem(orgId, jobId, itemId)
}

/**
 * Verify or reject completed work. Enforces independent verification: the
 * verifier may never be a worker on the task, and a CLEANER can only verify when
 * the org has peer verification enabled. Records the verifier + outcome.
 */
export async function verifyChecklistTask(
  orgId: string,
  jobId: string,
  itemId: string,
  actor: TaskActor,
  opts: { approve: boolean; note?: string },
) {
  const db = orgDb(orgId)
  await assertJob(db, jobId)
  await assertFieldAccess(db, jobId, actor)
  const item = await loadItem(db, jobId, itemId)

  const isSelf = isSelfVerification({
    assignedToId: item.assignedToId,
    completedById: item.completedById,
    sharedAssigneeIds: item.assignees.map((a) => a.userId),
    verifierId: actor.userId,
  })
  const { peerVerificationEnabled, verificationRequired } = await orgFlags(orgId)
  const decision = canVerifyTask({
    role: actor.role,
    // Self-approval is blocked whenever the org requires independent verification.
    independentRequired: verificationRequired,
    peerVerificationEnabled,
    isSelf,
    currentStatus: item.verificationStatus,
  })
  if (!decision.allowed) throw new ForbiddenActionError(decision.reason)

  const to: TaskVerificationStatus = opts.approve ? "VERIFIED" : "REJECTED"
  await db.jobChecklistItem.updateMany({
    where: { id: itemId, jobId },
    data: {
      verificationStatus: to,
      verifierId: actor.userId,
      verifiedAt: new Date(),
      verificationNote: opts.approve ? (opts.note ?? undefined) : undefined,
      rejectionReason: opts.approve ? null : (opts.note ?? "Correction required"),
      isComplete: isCompleteForStatus(to),
    },
  })
  await recordAudit(orgId, actor.userId, ENTITY, itemId, opts.approve ? "task.verify" : "task.reject", {
    field: "verificationStatus",
    oldValue: item.verificationStatus,
    newValue: to,
    metadata: { jobId, note: opts.note },
  })
  return reloadItem(orgId, jobId, itemId)
}

/** Worker marks a rejected task corrected — re-enters verification. */
export async function markChecklistTaskCorrected(orgId: string, jobId: string, itemId: string, actor: TaskActor) {
  const db = orgDb(orgId)
  await assertJob(db, jobId)
  await assertFieldAccess(db, jobId, actor)
  const item = await loadItem(db, jobId, itemId)
  if (!canWorkTask({ role: actor.role, userId: actor.userId, assignedToId: item.assignedToId, sharedAssigneeIds: item.assignees.map((a) => a.userId) })) {
    throw new ForbiddenActionError("You are not responsible for this task")
  }
  const to: TaskVerificationStatus = "CORRECTED_AWAITING_REINSPECTION"
  if (!canTransition(item.verificationStatus, to)) {
    throw new ConflictError(`Cannot mark corrected from ${item.verificationStatus}`)
  }
  await db.jobChecklistItem.updateMany({
    where: { id: itemId, jobId },
    data: { verificationStatus: to, isComplete: isCompleteForStatus(to) },
  })
  await recordAudit(orgId, actor.userId, ENTITY, itemId, "task.correct", {
    field: "verificationStatus",
    oldValue: item.verificationStatus,
    newValue: to,
    metadata: { jobId },
  })
  return reloadItem(orgId, jobId, itemId)
}

async function transitionWorkerState(
  orgId: string,
  jobId: string,
  itemId: string,
  actor: TaskActor,
  to: TaskVerificationStatus,
  auditAction: string,
) {
  const db = orgDb(orgId)
  await assertJob(db, jobId)
  await assertFieldAccess(db, jobId, actor)
  const item = await loadItem(db, jobId, itemId)
  if (!canWorkTask({ role: actor.role, userId: actor.userId, assignedToId: item.assignedToId, sharedAssigneeIds: item.assignees.map((a) => a.userId) })) {
    throw new ForbiddenActionError("You are not responsible for this task")
  }
  if (!canTransition(item.verificationStatus, to)) {
    throw new ConflictError(`Cannot move a ${item.verificationStatus} task to ${to}`)
  }
  await db.jobChecklistItem.updateMany({
    where: { id: itemId, jobId },
    data: { verificationStatus: to, isComplete: isCompleteForStatus(to) },
  })
  await recordAudit(orgId, actor.userId, ENTITY, itemId, auditAction, {
    field: "verificationStatus",
    oldValue: item.verificationStatus,
    newValue: to,
    metadata: { jobId },
  })
  return reloadItem(orgId, jobId, itemId)
}

/** The immutable assignment + verification history for a task (for establishing
 *  responsibility after a complaint). Reuses the AuditEvent trail. */
export function listTaskHistory(orgId: string, itemId: string) {
  return listAuditForEntity(orgId, ENTITY, itemId)
}
