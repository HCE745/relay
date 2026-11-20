// P1 Task Ownership & Verification — PURE decision logic.
//
// No DB, no `server-only`, no I/O: every rule here is a pure function so the
// accountability-critical behavior (status transitions, self-approval
// prevention, who may assign/verify) is unit-tested in isolation. The data layer
// (src/lib/data/task-ownership.ts) calls these to decide, then persists.

export type TaskVerificationStatus =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED_AWAITING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED"
  | "CORRECTED_AWAITING_REINSPECTION"

export type TaskAction = "start" | "submit" | "verify" | "reject" | "correct" | "reopen"

export type ActorRole = "OWNER" | "ADMIN" | "MANAGER" | "SUPERVISOR" | "CLEANER" | "CLIENT"

/** Supervisory roles: may assign work and verify anyone's work (subject to the
 *  self-approval rule). Mirrors rbac.canViewSchedule's operations set. */
const SUPERVISORY: ReadonlySet<ActorRole> = new Set(["OWNER", "ADMIN", "MANAGER", "SUPERVISOR"])

export function isSupervisory(role: ActorRole): boolean {
  return SUPERVISORY.has(role)
}

// ── Status machine ───────────────────────────────────────────────────────────
// Allowed transitions. Completion and verification are separate: work becomes
// COMPLETED_AWAITING_VERIFICATION, and only an independent verifier moves it to
// VERIFIED or REJECTED. A rejected task is corrected and re-enters verification.
const TRANSITIONS: Record<TaskVerificationStatus, readonly TaskVerificationStatus[]> = {
  ASSIGNED: ["IN_PROGRESS", "COMPLETED_AWAITING_VERIFICATION"],
  IN_PROGRESS: ["COMPLETED_AWAITING_VERIFICATION", "ASSIGNED"],
  COMPLETED_AWAITING_VERIFICATION: ["VERIFIED", "REJECTED"],
  REJECTED: ["CORRECTED_AWAITING_REINSPECTION", "IN_PROGRESS"],
  CORRECTED_AWAITING_REINSPECTION: ["VERIFIED", "REJECTED"],
  // A manager may overturn a verification back into review (audit-preserved).
  VERIFIED: ["REJECTED"],
}

export function canTransition(from: TaskVerificationStatus, to: TaskVerificationStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

/** The status an action produces (independent of the current one); null = no-op. */
export function statusForAction(action: TaskAction): TaskVerificationStatus | null {
  switch (action) {
    case "start":
      return "IN_PROGRESS"
    case "submit":
      return "COMPLETED_AWAITING_VERIFICATION"
    case "verify":
      return "VERIFIED"
    case "reject":
      return "REJECTED"
    case "correct":
      return "CORRECTED_AWAITING_REINSPECTION"
    case "reopen":
      return "COMPLETED_AWAITING_VERIFICATION"
    default:
      return null
  }
}

/** Keep the legacy isComplete boolean in sync: "work reported done or verified". */
export function isCompleteForStatus(status: TaskVerificationStatus): boolean {
  return (
    status === "COMPLETED_AWAITING_VERIFICATION" ||
    status === "VERIFIED" ||
    status === "CORRECTED_AWAITING_REINSPECTION"
  )
}

// ── Self-approval prevention ─────────────────────────────────────────────────
/** True if the proposed verifier performed or owns the work. The worker set is
 *  the primary owner + whoever marked it complete + any shared owners. */
export function isSelfVerification(params: {
  assignedToId: string | null
  completedById: string | null
  sharedAssigneeIds?: readonly string[]
  verifierId: string
}): boolean {
  const workers = new Set<string>()
  if (params.assignedToId) workers.add(params.assignedToId)
  if (params.completedById) workers.add(params.completedById)
  for (const id of params.sharedAssigneeIds ?? []) workers.add(id)
  return workers.has(params.verifierId)
}

export type Decision = { allowed: true } | { allowed: false; reason: string }

/**
 * May this actor VERIFY/REJECT this task right now?
 *   • Only when the task is awaiting verification (completed or corrected).
 *   • When independent verification is required, the actor must not be a worker
 *     on the task (no self-approval).
 *   • Supervisory roles may always verify; a CLEANER may verify only when the
 *     org has peer verification enabled.
 */
export function canVerifyTask(params: {
  role: ActorRole
  independentRequired: boolean
  peerVerificationEnabled: boolean
  isSelf: boolean
  currentStatus: TaskVerificationStatus
}): Decision {
  if (
    params.currentStatus !== "COMPLETED_AWAITING_VERIFICATION" &&
    params.currentStatus !== "CORRECTED_AWAITING_REINSPECTION"
  ) {
    return { allowed: false, reason: "Task is not awaiting verification" }
  }
  if (params.independentRequired && params.isSelf) {
    return { allowed: false, reason: "You cannot verify your own work" }
  }
  if (isSupervisory(params.role)) return { allowed: true }
  if (params.role === "CLEANER") {
    if (!params.peerVerificationEnabled) {
      return { allowed: false, reason: "Peer verification is not enabled for this workspace" }
    }
    return { allowed: true }
  }
  return { allowed: false, reason: "Not authorized to verify work" }
}

// ── Assignment permission ────────────────────────────────────────────────────
/** Managers/supervisors assign and reassign responsibilities. */
export function canAssignTasks(role: ActorRole): boolean {
  return isSupervisory(role)
}

/** A cleaner may self-assign (claim/divide) only an UNOWNED task; supervisory
 *  roles may always assign. This is "employees can self-assign or divide work
 *  when permitted" without an extra flag — claiming unowned work. */
export function canSelfAssign(params: { role: ActorRole; currentAssignedToId: string | null }): boolean {
  if (isSupervisory(params.role)) return true
  return params.role === "CLEANER" && params.currentAssignedToId === null
}

/** May this actor mark the work complete / move it through the worker-side
 *  states (start, submit, correct)? The primary owner, a shared owner, or a
 *  supervisor. */
export function canWorkTask(params: {
  role: ActorRole
  userId: string
  assignedToId: string | null
  sharedAssigneeIds?: readonly string[]
}): boolean {
  if (isSupervisory(params.role)) return true
  if (params.assignedToId === params.userId) return true
  return (params.sharedAssigneeIds ?? []).includes(params.userId)
}
