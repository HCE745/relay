// P3 Customer complaint investigation — PURE logic.
//
// A customer complaint IS the existing Issue (source = CUSTOMER). This module
// holds the complaint-specific investigation rules as pure functions so the
// employee-protection guarantees are unit-tested in isolation and reused by the
// data layer (which never re-derives them).

export type ComplaintOutcome = "SUBSTANTIATED" | "UNSUBSTANTIATED" | "INCONCLUSIVE"

export const COMPLAINT_OUTCOMES: ComplaintOutcome[] = ["SUBSTANTIATED", "UNSUBSTANTIATED", "INCONCLUSIVE"]

export const OUTCOME_LABELS: Record<ComplaintOutcome, string> = {
  SUBSTANTIATED: "Substantiated",
  UNSUBSTANTIATED: "Unsubstantiated",
  INCONCLUSIVE: "Inconclusive",
}

/** A customer complaint is an Issue whose source is CUSTOMER. */
export function isCustomerComplaint(source: string): boolean {
  return source === "CUSTOMER"
}

/**
 * EMPLOYEE PROTECTION: a complaint is an ALLEGATION until it is investigated and
 * an outcome is recorded. Only a SUBSTANTIATED outcome may EVER contribute to an
 * employee's performance record/analytics. An unsubstantiated or inconclusive
 * finding — and any un-investigated complaint — never counts against anyone.
 * P4 analytics must gate on this single rule.
 */
export function outcomeCountsAgainstEmployee(outcome: string | null | undefined): boolean {
  return outcome === "SUBSTANTIATED"
}

/** A complaint with no recorded outcome is an unproven allegation. */
export function isAllegation(outcome: string | null | undefined): boolean {
  return !outcome
}

/** An outcome may be recorded or revised while the complaint is still open; a
 *  CLOSED (verified) complaint is final. */
export function canRecordOutcome(issueStatus: string): boolean {
  return issueStatus !== "CLOSED"
}

export type ResponsibilityBasis = "TASK_ASSIGNEE" | "TASK_COMPLETER" | "TASK_VERIFIER" | "JOB_ASSIGNEE"

export const RESPONSIBILITY_BASIS_LABELS: Record<ResponsibilityBasis, string> = {
  TASK_ASSIGNEE: "Assigned the task",
  TASK_COMPLETER: "Marked it complete",
  TASK_VERIFIER: "Verified the task",
  JOB_ASSIGNEE: "On the job crew",
}

export type ChecklistSnapshot = {
  id: string
  label: string | null
  assignedToId: string | null
  completedById: string | null
  verifierId: string | null
  verificationStatus: string | null
  completedAt: Date | null
}

export type DerivedResponsibility = {
  userId: string
  basis: ResponsibilityBasis
  jobChecklistItemId: string | null
  taskLabel: string | null
  verificationStatus: string | null
  completedAt: Date | null
}

/**
 * PURE: derive the responsible-employee snapshot for a complaint from a checklist
 * item snapshot and the job crew. Deterministic and de-duplicated:
 *   • The linked task yields up to three rows — who was ASSIGNED it, who
 *     COMPLETED it, and who VERIFIED it (the same person can hold more than one).
 *   • Remaining job crew (not already captured via the task) are JOB_ASSIGNEE.
 * This preserves historical responsibility as fact; it establishes NO fault.
 */
export function deriveResponsibilities(input: {
  checklistItem?: ChecklistSnapshot | null
  jobAssigneeIds?: string[]
}): DerivedResponsibility[] {
  const out: DerivedResponsibility[] = []
  const seen = new Set<string>() // userId|basis|itemId
  const usersWithTaskBasis = new Set<string>()

  const push = (userId: string | null, basis: ResponsibilityBasis, item: ChecklistSnapshot | null) => {
    if (!userId) return
    const key = `${userId}|${basis}|${item?.id ?? ""}`
    if (seen.has(key)) return
    seen.add(key)
    if (basis !== "JOB_ASSIGNEE") usersWithTaskBasis.add(userId)
    out.push({
      userId,
      basis,
      jobChecklistItemId: item?.id ?? null,
      taskLabel: item?.label ?? null,
      verificationStatus: item?.verificationStatus ?? null,
      completedAt: item?.completedAt ?? null,
    })
  }

  const it = input.checklistItem
  if (it) {
    push(it.assignedToId, "TASK_ASSIGNEE", it)
    push(it.completedById, "TASK_COMPLETER", it)
    push(it.verifierId, "TASK_VERIFIER", it)
  }
  // Crew members not already captured by the task get a plain JOB_ASSIGNEE row.
  for (const uid of input.jobAssigneeIds ?? []) {
    if (usersWithTaskBasis.has(uid)) continue
    push(uid, "JOB_ASSIGNEE", null)
  }
  return out
}
