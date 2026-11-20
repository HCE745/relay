// P2 Employee Reporting & Supervisor Review — PURE access-control logic.
//
// Confidentiality isolation, self-exclusion, and viewer redaction live here as
// pure functions so the privacy-critical rules are unit-tested in isolation.
// WHO may see/investigate a report is decided ONLY here; the data layer and
// routes call these and never re-derive the rules.

export type ActorRole = "OWNER" | "ADMIN" | "MANAGER" | "SUPERVISOR" | "CLEANER" | "CLIENT"
export type Confidentiality = "NORMAL" | "PRIVATE" | "CONFIDENTIAL"

export type Decision = { allowed: true } | { allowed: false; reason: string }
const ALLOW: Decision = { allowed: true }
const deny = (reason: string): Decision => ({ allowed: false, reason })

/**
 * The confidentiality tiers a MANAGEMENT role may reach:
 *   • OWNER / ADMIN  — everything, including CONFIDENTIAL (authorized management)
 *   • MANAGER        — NORMAL + PRIVATE (operational concerns), NOT confidential
 *   • SUPERVISOR     — NORMAL work-quality only
 *   • CLEANER/CLIENT — none (they file + see their own; no management view)
 */
export function accessibleTiers(role: ActorRole): ReadonlySet<Confidentiality> {
  switch (role) {
    case "OWNER":
    case "ADMIN":
      return new Set<Confidentiality>(["NORMAL", "PRIVATE", "CONFIDENTIAL"])
    case "MANAGER":
      return new Set<Confidentiality>(["NORMAL", "PRIVATE"])
    case "SUPERVISOR":
      return new Set<Confidentiality>(["NORMAL"])
    default:
      return new Set<Confidentiality>()
  }
}

export function roleCanAccessTier(role: ActorRole, tier: Confidentiality): boolean {
  return accessibleTiers(role).has(tier)
}

/** The management roles that may be NOTIFIED about / review a tier — used to
 *  resolve recipients (confidential alerts never reach a supervisor). */
export function authorizedRolesForTier(tier: Confidentiality): ActorRole[] {
  return (["OWNER", "ADMIN", "MANAGER", "SUPERVISOR"] as ActorRole[]).filter((r) => roleCanAccessTier(r, tier))
}

/** Any internal staff member may FILE a report; portal CLIENTs never can. */
export function canFileReport(role: ActorRole): boolean {
  return role !== "CLIENT"
}

export type ReportRef = {
  reportedById: string
  aboutUserId: string | null
  confidentiality: Confidentiality
}

/** Conflict of interest: the actor filed the report or is its subject. Such a
 *  person may never investigate or decide it. */
export function isConflicted(actor: { userId: string }, report: ReportRef): boolean {
  return actor.userId === report.reportedById || actor.userId === report.aboutUserId
}

/**
 * May this actor see the MANAGEMENT view of a report (full detail + evidence)?
 *   • The actor's role must reach the report's confidentiality tier, AND
 *   • the actor must NOT be the subject — the accused never gets the management
 *     view of a report about themselves (this is the alternative escalation when
 *     the accused is the reporter's own supervisor: it routes past them to a
 *     higher authorized role).
 * Note: the reporter is allowed the management view only if their role qualifies;
 * their own-report view (field app) is `canReporterView`.
 */
export function canManageView(actor: { role: ActorRole; userId: string }, report: ReportRef): Decision {
  if (actor.userId === report.aboutUserId) return deny("You cannot access a report that concerns you")
  if (!roleCanAccessTier(actor.role, report.confidentiality)) return deny("Not authorized for this report's confidentiality level")
  return ALLOW
}

/**
 * May this actor INVESTIGATE (triage, review, record a finding, resolve, record
 * the subject's response, or set corrective action)? Management view PLUS no
 * conflict of interest — nobody investigates a report they filed or that
 * concerns them.
 */
export function canInvestigate(actor: { role: ActorRole; userId: string }, report: ReportRef): Decision {
  const view = canManageView(actor, report)
  if (!view.allowed) return view
  if (isConflicted(actor, report)) return deny("You cannot investigate a report you filed or that concerns you")
  return ALLOW
}

/** May a candidate be ASSIGNED as the reviewer? They must be able to investigate
 *  it (role reaches the tier, and they are neither the reporter nor the subject). */
export function canBeReviewer(candidate: { role: ActorRole; userId: string }, report: ReportRef): boolean {
  return canInvestigate(candidate, report).allowed
}

/** The reporter may always see their OWN report (status + what they filed), but
 *  the investigation internals are redacted unless they also have the mgmt view. */
export function canReporterView(actor: { userId: string }, report: ReportRef): boolean {
  return actor.userId === report.reportedById
}

/** Can the actor attach evidence? The reporter (to their own report) or an
 *  authorized investigator. */
export function canAddEvidence(actor: { role: ActorRole; userId: string }, report: ReportRef): boolean {
  return canReporterView(actor, report) || canInvestigate(actor, report).allowed
}

/**
 * May the actor fetch a SPECIFIC evidence photo attached to a report?
 *   • A management viewer may see all of the report's evidence.
 *   • A reporter may see ONLY evidence they uploaded themselves — never the
 *     "restricted" evidence an investigator attached during review. This keeps
 *     investigation material protected even on a report the reporter filed.
 */
export function canViewReportEvidence(
  actor: { role: ActorRole; userId: string },
  report: ReportRef,
  photo: { uploadedById: string | null },
): boolean {
  if (canManageView(actor, report).allowed) return true
  if (canReporterView(actor, report) && photo.uploadedById === actor.userId) return true
  return false
}

/**
 * Field names that are investigation-internal: visible only to someone with the
 * management view, never to a reporter viewing their own report. The data layer
 * strips these for reporter-only viewers.
 */
export const INVESTIGATION_INTERNAL_FIELDS = [
  "finding",
  "employeeResponse",
  "respondedAt",
  "reviewerId",
  "reviewer",
  "reviewStartedAt",
] as const
