// P2 Employee Reporting & Supervisor Review — PURE investigation-workflow logic.
//
// No DB, no I/O: the status machine and the allegation/finding helpers are pure
// so the accountability-critical behaviour is unit-tested in isolation. The data
// layer (src/lib/data/employee-reports.ts) calls these to decide, then persists.

export type ReportStatus =
  | "SUBMITTED"
  | "PENDING_REVIEW"
  | "UNDER_REVIEW"
  | "SUBSTANTIATED"
  | "UNSUBSTANTIATED"
  | "INCONCLUSIVE"
  | "RESOLVED"

export type ReportOutcome = "SUBSTANTIATED" | "UNSUBSTANTIATED" | "INCONCLUSIVE"

export type ReportAction =
  | "triage" // SUBMITTED → PENDING_REVIEW (a reviewer is assigned)
  | "start_review" // PENDING_REVIEW → UNDER_REVIEW
  | "substantiate"
  | "unsubstantiate"
  | "inconclusive"
  | "resolve"
  | "reopen"

// Submitted → Pending Review → Under Review → {finding} → Resolved. A finding or
// resolution can be reopened back into review (audit-preserved) if new facts
// arrive — nothing is ever silently rewritten.
const TRANSITIONS: Record<ReportStatus, readonly ReportStatus[]> = {
  SUBMITTED: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["SUBSTANTIATED", "UNSUBSTANTIATED", "INCONCLUSIVE"],
  SUBSTANTIATED: ["RESOLVED", "UNDER_REVIEW"],
  UNSUBSTANTIATED: ["RESOLVED", "UNDER_REVIEW"],
  INCONCLUSIVE: ["RESOLVED", "UNDER_REVIEW"],
  RESOLVED: ["UNDER_REVIEW"],
}

export function canTransition(from: ReportStatus, to: ReportStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

/** The status an action produces (independent of the current one); null = no-op. */
export function statusForAction(action: ReportAction): ReportStatus | null {
  switch (action) {
    case "triage":
      return "PENDING_REVIEW"
    case "start_review":
      return "UNDER_REVIEW"
    case "substantiate":
      return "SUBSTANTIATED"
    case "unsubstantiate":
      return "UNSUBSTANTIATED"
    case "inconclusive":
      return "INCONCLUSIVE"
    case "resolve":
      return "RESOLVED"
    case "reopen":
      return "UNDER_REVIEW"
    default:
      return null
  }
}

const FINDINGS: ReadonlySet<ReportStatus> = new Set(["SUBSTANTIATED", "UNSUBSTANTIATED", "INCONCLUSIVE"])

/** The finding this status represents, or null if the report has none yet. */
export function outcomeForStatus(status: ReportStatus): ReportOutcome | null {
  return FINDINGS.has(status) ? (status as ReportOutcome) : null
}

export function isFinding(status: ReportStatus): boolean {
  return FINDINGS.has(status)
}

/**
 * An ALLEGATION is a report that has NOT yet reached a finding — Submitted,
 * Pending Review, or Under Review. Employee protection: nothing about an
 * allegation may ever count against the subject's performance record.
 */
export function isAllegation(status: ReportStatus): boolean {
  return status === "SUBMITTED" || status === "PENDING_REVIEW" || status === "UNDER_REVIEW"
}

/**
 * The ONLY condition under which a report may EVER be referenced in a
 * performance context: a recorded SUBSTANTIATED finding. Unverified or
 * unsubstantiated/inconclusive reports never count against an employee. (P2
 * writes nothing to any performance record; this guards future phases.)
 */
export function countsAgainstEmployee(outcome: ReportOutcome | null): boolean {
  return outcome === "SUBSTANTIATED"
}
