import { describe, it, expect } from "vitest"
import {
  accessibleTiers,
  roleCanAccessTier,
  authorizedRolesForTier,
  canFileReport,
  isConflicted,
  canManageView,
  canInvestigate,
  canBeReviewer,
  canReporterView,
  canAddEvidence,
  canViewReportEvidence,
  type ActorRole,
  type Confidentiality,
  type ReportRef,
} from "../access"

const ref = (over: Partial<ReportRef> = {}): ReportRef => ({
  reportedById: "reporter",
  aboutUserId: "subject",
  confidentiality: "NORMAL",
  ...over,
})

describe("confidentiality access tiers", () => {
  it("escalates with authority; supervisors see only work-quality", () => {
    expect([...accessibleTiers("OWNER")].sort()).toEqual(["CONFIDENTIAL", "NORMAL", "PRIVATE"])
    expect([...accessibleTiers("ADMIN")].sort()).toEqual(["CONFIDENTIAL", "NORMAL", "PRIVATE"])
    expect([...accessibleTiers("MANAGER")].sort()).toEqual(["NORMAL", "PRIVATE"])
    expect([...accessibleTiers("SUPERVISOR")]).toEqual(["NORMAL"])
    expect([...accessibleTiers("CLEANER")]).toEqual([])
    expect([...accessibleTiers("CLIENT")]).toEqual([])
  })

  it("a supervisor can never reach a confidential report", () => {
    expect(roleCanAccessTier("SUPERVISOR", "CONFIDENTIAL")).toBe(false)
    expect(roleCanAccessTier("MANAGER", "CONFIDENTIAL")).toBe(false)
    expect(roleCanAccessTier("ADMIN", "CONFIDENTIAL")).toBe(true)
  })

  it("confidential alerts reach only owners/admins", () => {
    expect(authorizedRolesForTier("CONFIDENTIAL").sort()).toEqual(["ADMIN", "OWNER"])
    expect(authorizedRolesForTier("PRIVATE").sort()).toEqual(["ADMIN", "MANAGER", "OWNER"])
    expect(authorizedRolesForTier("NORMAL").sort()).toEqual(["ADMIN", "MANAGER", "OWNER", "SUPERVISOR"])
  })
})

describe("filing", () => {
  it("any internal staff may file; portal clients never", () => {
    for (const r of ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR", "CLEANER"] as ActorRole[]) {
      expect(canFileReport(r)).toBe(true)
    }
    expect(canFileReport("CLIENT")).toBe(false)
  })
})

describe("self-exclusion & investigation", () => {
  it("the reporter and the subject are both conflicted", () => {
    expect(isConflicted({ userId: "reporter" }, ref())).toBe(true)
    expect(isConflicted({ userId: "subject" }, ref())).toBe(true)
    expect(isConflicted({ userId: "other" }, ref())).toBe(false)
  })

  it("the accused can NEVER see the management view of a report about them", () => {
    // Even an owner who is the subject is locked out (alternative escalation).
    const d = canManageView({ role: "OWNER", userId: "subject" }, ref({ confidentiality: "CONFIDENTIAL" }))
    expect(d.allowed).toBe(false)
  })

  it("management view requires the role to reach the tier", () => {
    expect(canManageView({ role: "SUPERVISOR", userId: "x" }, ref({ confidentiality: "CONFIDENTIAL" })).allowed).toBe(false)
    expect(canManageView({ role: "SUPERVISOR", userId: "x" }, ref({ confidentiality: "NORMAL" })).allowed).toBe(true)
    expect(canManageView({ role: "ADMIN", userId: "x" }, ref({ confidentiality: "CONFIDENTIAL" })).allowed).toBe(true)
  })

  it("nobody may investigate a report they filed or that concerns them", () => {
    expect(canInvestigate({ role: "ADMIN", userId: "reporter" }, ref()).allowed).toBe(false) // filed it
    expect(canInvestigate({ role: "ADMIN", userId: "subject" }, ref()).allowed).toBe(false) // about them
    expect(canInvestigate({ role: "ADMIN", userId: "other" }, ref()).allowed).toBe(true)
  })

  it("a reviewer candidate must be able to investigate (tier + no conflict)", () => {
    const r = ref({ confidentiality: "PRIVATE" })
    expect(canBeReviewer({ role: "MANAGER", userId: "other" }, r)).toBe(true)
    expect(canBeReviewer({ role: "SUPERVISOR", userId: "other" }, r)).toBe(false) // can't reach PRIVATE
    expect(canBeReviewer({ role: "MANAGER", userId: "subject" }, r)).toBe(false) // conflict
    expect(canBeReviewer({ role: "MANAGER", userId: "reporter" }, r)).toBe(false) // conflict
  })
})

describe("reporter view & evidence", () => {
  it("the reporter may view their own report — at EVERY confidentiality tier", () => {
    expect(canReporterView({ userId: "reporter" }, ref())).toBe(true)
    expect(canReporterView({ userId: "reporter" }, ref({ confidentiality: "PRIVATE" }))).toBe(true)
    // A cleaner may follow their OWN confidential report (redacted) even though
    // their role could never reach the confidential tier for anyone else's.
    expect(canReporterView({ userId: "reporter" }, ref({ confidentiality: "CONFIDENTIAL" }))).toBe(true)
    expect(canReporterView({ userId: "other" }, ref())).toBe(false)
  })

  it("a reporter still cannot INVESTIGATE their own confidential report", () => {
    // Even if they were somehow an admin, filing it makes them conflicted; as a
    // cleaner their role also can't reach the tier.
    expect(canInvestigate({ role: "CLEANER", userId: "reporter" }, ref({ confidentiality: "CONFIDENTIAL" })).allowed).toBe(false)
    expect(canInvestigate({ role: "ADMIN", userId: "reporter" }, ref({ confidentiality: "CONFIDENTIAL" })).allowed).toBe(false)
  })

  it("evidence may be attached by the reporter or an authorized investigator", () => {
    expect(canAddEvidence({ role: "CLEANER", userId: "reporter" }, ref())).toBe(true) // own report
    expect(canAddEvidence({ role: "ADMIN", userId: "other" }, ref())).toBe(true) // investigator
    expect(canAddEvidence({ role: "CLEANER", userId: "other" }, ref())).toBe(false) // neither
    expect(canAddEvidence({ role: "ADMIN", userId: "subject" }, ref())).toBe(false) // subject is conflicted & not reporter
  })

  it("a reporter sees ONLY their own evidence; investigator evidence stays restricted", () => {
    const r = ref({ confidentiality: "CONFIDENTIAL" })
    const reporter = { role: "CLEANER" as ActorRole, userId: "reporter" }
    const own = { uploadedById: "reporter" }
    const investigatorPhoto = { uploadedById: "admin" }
    // Reporter: own upload yes, investigator's upload no.
    expect(canViewReportEvidence(reporter, r, own)).toBe(true)
    expect(canViewReportEvidence(reporter, r, investigatorPhoto)).toBe(false)
    // An authorized manager (ADMIN) sees all of the report's evidence.
    const admin = { role: "ADMIN" as ActorRole, userId: "admin" }
    expect(canViewReportEvidence(admin, r, own)).toBe(true)
    expect(canViewReportEvidence(admin, r, investigatorPhoto)).toBe(true)
    // The subject (accused) sees none of it.
    const subject = { role: "ADMIN" as ActorRole, userId: "subject" }
    expect(canViewReportEvidence(subject, r, own)).toBe(false)
    expect(canViewReportEvidence(subject, r, investigatorPhoto)).toBe(false)
    // A supervisor can't reach a confidential report's evidence at all.
    const supervisor = { role: "SUPERVISOR" as ActorRole, userId: "sup" }
    expect(canViewReportEvidence(supervisor, r, own)).toBe(false)
  })
})

// A tiny type anchor so the exported types are referenced in the test file.
const _tier: Confidentiality = "NORMAL"
void _tier
