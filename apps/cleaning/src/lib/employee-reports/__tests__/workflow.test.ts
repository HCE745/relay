import { describe, it, expect } from "vitest"
import {
  canTransition,
  statusForAction,
  outcomeForStatus,
  isFinding,
  isAllegation,
  countsAgainstEmployee,
  type ReportStatus,
} from "../workflow"

describe("investigation status machine", () => {
  it("allows the real lifecycle", () => {
    expect(canTransition("SUBMITTED", "PENDING_REVIEW")).toBe(true)
    expect(canTransition("PENDING_REVIEW", "UNDER_REVIEW")).toBe(true)
    for (const f of ["SUBSTANTIATED", "UNSUBSTANTIATED", "INCONCLUSIVE"] as ReportStatus[]) {
      expect(canTransition("UNDER_REVIEW", f)).toBe(true)
      expect(canTransition(f, "RESOLVED")).toBe(true)
      expect(canTransition(f, "UNDER_REVIEW")).toBe(true) // reopen a finding
    }
    expect(canTransition("RESOLVED", "UNDER_REVIEW")).toBe(true) // reopen a resolution
  })

  it("rejects nonsensical jumps", () => {
    expect(canTransition("SUBMITTED", "UNDER_REVIEW")).toBe(false) // must be triaged first
    expect(canTransition("SUBMITTED", "SUBSTANTIATED")).toBe(false) // cannot conclude unreviewed
    expect(canTransition("PENDING_REVIEW", "RESOLVED")).toBe(false)
    expect(canTransition("RESOLVED", "SUBSTANTIATED")).toBe(false)
  })

  it("maps actions to their resulting status", () => {
    expect(statusForAction("triage")).toBe("PENDING_REVIEW")
    expect(statusForAction("start_review")).toBe("UNDER_REVIEW")
    expect(statusForAction("substantiate")).toBe("SUBSTANTIATED")
    expect(statusForAction("unsubstantiate")).toBe("UNSUBSTANTIATED")
    expect(statusForAction("inconclusive")).toBe("INCONCLUSIVE")
    expect(statusForAction("resolve")).toBe("RESOLVED")
    expect(statusForAction("reopen")).toBe("UNDER_REVIEW")
  })

  it("distinguishes allegations from findings", () => {
    for (const s of ["SUBMITTED", "PENDING_REVIEW", "UNDER_REVIEW"] as ReportStatus[]) {
      expect(isAllegation(s)).toBe(true)
      expect(isFinding(s)).toBe(false)
    }
    for (const s of ["SUBSTANTIATED", "UNSUBSTANTIATED", "INCONCLUSIVE"] as ReportStatus[]) {
      expect(isAllegation(s)).toBe(false)
      expect(isFinding(s)).toBe(true)
      expect(outcomeForStatus(s)).toBe(s)
    }
    expect(outcomeForStatus("UNDER_REVIEW")).toBeNull()
  })

  it("ONLY a substantiated finding may ever count against an employee", () => {
    expect(countsAgainstEmployee("SUBSTANTIATED")).toBe(true)
    expect(countsAgainstEmployee("UNSUBSTANTIATED")).toBe(false)
    expect(countsAgainstEmployee("INCONCLUSIVE")).toBe(false)
    expect(countsAgainstEmployee(null)).toBe(false) // an allegation never counts
  })
})
