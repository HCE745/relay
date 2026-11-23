import { describe, it, expect } from "vitest"
import {
  isCustomerComplaint,
  outcomeCountsAgainstEmployee,
  isAllegation,
  canRecordOutcome,
  deriveResponsibilities,
  buildCorrectiveAttachPatch,
  CORRECTIVE_ATTACH_FIELDS,
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
  const base = { jobChecklistItemId: "task1", taskLabel: "Mop the lobby", verificationStatus: "VERIFIED", completedAt: item().completedAt }

  it("captures assignee (primary), completer, and verifier of the linked task", () => {
    const rows = deriveResponsibilities({ checklistItem: item() })
    // alice is both assignee and completer → two distinct rows; bob verified.
    expect(rows).toEqual([
      { userId: "alice", basis: "TASK_ASSIGNEE", isPrimary: true, ...base },
      { userId: "alice", basis: "TASK_COMPLETER", isPrimary: false, ...base },
      { userId: "bob", basis: "TASK_VERIFIER", isPrimary: false, ...base },
    ])
  })

  it("captures ALL shared task owners as task-level assignees, with only the designated primary flagged", () => {
    // alice is primary; carol & dave are shared co-owners; the owner set also
    // (redundantly) lists alice. verifier/ completer cleared to isolate ownership.
    const rows = deriveResponsibilities({
      checklistItem: item({
        assignedToId: "alice",
        sharedAssigneeIds: ["alice", "carol", "dave"],
        completedById: null,
        verifierId: null,
      }),
    })
    const assignees = rows.filter((r) => r.basis === "TASK_ASSIGNEE")
    // Every owner is TASK_ASSIGNEE (no one demoted to crew); alice not duplicated.
    expect(assignees.map((r) => r.userId)).toEqual(["alice", "carol", "dave"])
    // Exactly one primary — the designated assignedToId.
    expect(assignees.filter((r) => r.isPrimary).map((r) => r.userId)).toEqual(["alice"])
    expect(assignees.every((r) => r.jobChecklistItemId === "task1")).toBe(true)
  })

  it("a shared task owner is NOT also listed as general job crew", () => {
    const rows = deriveResponsibilities({
      checklistItem: item({ assignedToId: "alice", sharedAssigneeIds: ["alice", "carol"], completedById: null, verifierId: null }),
      jobAssigneeIds: ["carol", "erin"], // carol is a task owner; erin is only crew
    })
    expect(rows.some((r) => r.userId === "carol" && r.basis === "JOB_ASSIGNEE")).toBe(false)
    expect(rows.filter((r) => r.userId === "carol")).toEqual([
      { userId: "carol", basis: "TASK_ASSIGNEE", isPrimary: false, jobChecklistItemId: "task1", taskLabel: "Mop the lobby", verificationStatus: "VERIFIED", completedAt: item().completedAt },
    ])
    expect(rows.find((r) => r.userId === "erin")).toMatchObject({ basis: "JOB_ASSIGNEE", isPrimary: false })
  })

  it("adds crew members as JOB_ASSIGNEE, but never double-lists someone already on the task", () => {
    const rows = deriveResponsibilities({ checklistItem: item(), jobAssigneeIds: ["alice", "carol"] })
    const carol = rows.filter((r) => r.userId === "carol")
    expect(carol).toEqual([{ userId: "carol", basis: "JOB_ASSIGNEE", isPrimary: false, jobChecklistItemId: null, taskLabel: null, verificationStatus: null, completedAt: null }])
    expect(rows.some((r) => r.userId === "alice" && r.basis === "JOB_ASSIGNEE")).toBe(false)
  })

  it("is empty when there is nothing to attribute, and ignores null actors", () => {
    expect(deriveResponsibilities({})).toEqual([])
    expect(deriveResponsibilities({ checklistItem: item({ assignedToId: null, sharedAssigneeIds: [], completedById: null, verifierId: null }) })).toEqual([])
  })

  it("dedupes repeated shared/crew ids", () => {
    const rows = deriveResponsibilities({ jobAssigneeIds: ["dan", "dan"] })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ userId: "dan", basis: "JOB_ASSIGNEE" })
  })
})

describe("corrective work on an EXISTING work order — billing preserved", () => {
  it("the attach patch only ever touches the owner and due date", () => {
    const patch = buildCorrectiveAttachPatch({ assigneeId: "alice", dueAt: "2026-12-01T00:00:00.000Z" })
    expect(Object.keys(patch).sort()).toEqual(["assignedToId", "dueAt"])
    // Never a billing/scheduling field.
    for (const forbidden of ["billable", "type", "quotedAmount", "status", "isCorrective", "convertedJobId", "description"]) {
      expect(patch).not.toHaveProperty(forbidden)
    }
    // Every key is in the allowlist.
    expect(Object.keys(patch).every((k) => (CORRECTIVE_ATTACH_FIELDS as readonly string[]).includes(k))).toBe(true)
  })

  it("sets the owner (incl. explicit unassign) and omits an absent due date", () => {
    expect(buildCorrectiveAttachPatch({ assigneeId: "bob" })).toEqual({ assignedToId: "bob" })
    expect(buildCorrectiveAttachPatch({ assigneeId: null })).toEqual({ assignedToId: null }) // explicit unassign
    expect(buildCorrectiveAttachPatch({})).toEqual({}) // nothing provided → no-op patch
    expect(buildCorrectiveAttachPatch({ dueAt: "2026-12-01T00:00:00.000Z" })).toEqual({ dueAt: new Date("2026-12-01T00:00:00.000Z") })
  })
})
