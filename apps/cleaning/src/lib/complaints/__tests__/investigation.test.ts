import { describe, it, expect } from "vitest"
import {
  isCustomerComplaint,
  outcomeCountsAgainstEmployee,
  isAllegation,
  canRecordOutcome,
  deriveResponsibilities,
  COMPLAINT_OUTCOMES,
  type ChecklistSnapshot,
} from "../investigation"

const item = (over: Partial<ChecklistSnapshot> = {}): ChecklistSnapshot => ({
  id: "task1",
  label: "Mop the lobby",
  assignedToId: "alice",
  completedById: "alice",
  verifierId: "bob",
  verificationStatus: "VERIFIED",
  completedAt: new Date("2026-11-01T10:00:00Z"),
  ...over,
})

describe("complaint = customer issue", () => {
  it("only source CUSTOMER is a complaint", () => {
    expect(isCustomerComplaint("CUSTOMER")).toBe(true)
    expect(isCustomerComplaint("STAFF")).toBe(false)
    expect(isCustomerComplaint("INSPECTION")).toBe(false)
  })
})

describe("employee protection — only substantiated counts", () => {
  it("ONLY a substantiated outcome may count against an employee", () => {
    expect(outcomeCountsAgainstEmployee("SUBSTANTIATED")).toBe(true)
    expect(outcomeCountsAgainstEmployee("UNSUBSTANTIATED")).toBe(false)
    expect(outcomeCountsAgainstEmployee("INCONCLUSIVE")).toBe(false)
    expect(outcomeCountsAgainstEmployee(null)).toBe(false) // an allegation never counts
    expect(outcomeCountsAgainstEmployee(undefined)).toBe(false)
  })

  it("no recorded outcome means it is still an allegation", () => {
    expect(isAllegation(null)).toBe(true)
    expect(isAllegation(undefined)).toBe(true)
    for (const o of COMPLAINT_OUTCOMES) expect(isAllegation(o)).toBe(false)
  })

  it("an outcome can be recorded while open but not after the case is closed", () => {
    for (const s of ["OPEN", "ACKNOWLEDGED", "RESOLVED"]) expect(canRecordOutcome(s)).toBe(true)
    expect(canRecordOutcome("CLOSED")).toBe(false)
  })
})

describe("historical responsibility snapshot (pure)", () => {
  it("captures assignee, completer, and verifier of the linked task", () => {
    const rows = deriveResponsibilities({ checklistItem: item() })
    // alice is both assignee and completer → two distinct rows; bob verified.
    expect(rows).toEqual([
      { userId: "alice", basis: "TASK_ASSIGNEE", jobChecklistItemId: "task1", taskLabel: "Mop the lobby", verificationStatus: "VERIFIED", completedAt: item().completedAt },
      { userId: "alice", basis: "TASK_COMPLETER", jobChecklistItemId: "task1", taskLabel: "Mop the lobby", verificationStatus: "VERIFIED", completedAt: item().completedAt },
      { userId: "bob", basis: "TASK_VERIFIER", jobChecklistItemId: "task1", taskLabel: "Mop the lobby", verificationStatus: "VERIFIED", completedAt: item().completedAt },
    ])
  })

  it("adds crew members as JOB_ASSIGNEE, but never double-lists someone already on the task", () => {
    const rows = deriveResponsibilities({ checklistItem: item(), jobAssigneeIds: ["alice", "carol"] })
    // alice already captured via the task → not re-added as crew; carol is new crew.
    const carol = rows.filter((r) => r.userId === "carol")
    expect(carol).toEqual([{ userId: "carol", basis: "JOB_ASSIGNEE", jobChecklistItemId: null, taskLabel: null, verificationStatus: null, completedAt: null }])
    expect(rows.some((r) => r.userId === "alice" && r.basis === "JOB_ASSIGNEE")).toBe(false)
  })

  it("is empty when there is nothing to attribute, and ignores null actors", () => {
    expect(deriveResponsibilities({})).toEqual([])
    expect(deriveResponsibilities({ checklistItem: item({ assignedToId: null, completedById: null, verifierId: null }) })).toEqual([])
  })

  it("dedupes repeated crew ids", () => {
    const rows = deriveResponsibilities({ jobAssigneeIds: ["dan", "dan"] })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ userId: "dan", basis: "JOB_ASSIGNEE" })
  })
})
