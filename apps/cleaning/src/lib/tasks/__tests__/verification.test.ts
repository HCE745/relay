import { describe, it, expect } from "vitest"
import {
  canTransition,
  statusForAction,
  submitTargetStatus,
  isCompleteForStatus,
  isSelfVerification,
  canVerifyTask,
  canAssignTasks,
  canSelfAssign,
  canWorkTask,
  isSupervisory,
  type ActorRole,
  type TaskVerificationStatus,
} from "../verification"

describe("status machine", () => {
  it("allows the real lifecycle transitions", () => {
    expect(canTransition("ASSIGNED", "IN_PROGRESS")).toBe(true)
    expect(canTransition("ASSIGNED", "COMPLETED_AWAITING_VERIFICATION")).toBe(true)
    expect(canTransition("IN_PROGRESS", "COMPLETED_AWAITING_VERIFICATION")).toBe(true)
    expect(canTransition("COMPLETED_AWAITING_VERIFICATION", "VERIFIED")).toBe(true)
    expect(canTransition("COMPLETED_AWAITING_VERIFICATION", "REJECTED")).toBe(true)
    expect(canTransition("REJECTED", "CORRECTED_AWAITING_REINSPECTION")).toBe(true)
    expect(canTransition("CORRECTED_AWAITING_REINSPECTION", "VERIFIED")).toBe(true)
    // Manager overturn of a verification back into review is allowed.
    expect(canTransition("VERIFIED", "REJECTED")).toBe(true)
  })

  it("rejects nonsensical jumps", () => {
    expect(canTransition("ASSIGNED", "VERIFIED")).toBe(false) // cannot verify unstarted work
    expect(canTransition("VERIFIED", "IN_PROGRESS")).toBe(false)
    expect(canTransition("ASSIGNED", "CORRECTED_AWAITING_REINSPECTION")).toBe(false)
  })

  it("maps actions to their resulting status", () => {
    expect(statusForAction("start")).toBe("IN_PROGRESS")
    expect(statusForAction("submit")).toBe("COMPLETED_AWAITING_VERIFICATION")
    expect(statusForAction("verify")).toBe("VERIFIED")
    expect(statusForAction("reject")).toBe("REJECTED")
    expect(statusForAction("correct")).toBe("CORRECTED_AWAITING_REINSPECTION")
  })

  it("submit resolves by whether the org requires independent verification", () => {
    expect(submitTargetStatus(true)).toBe("COMPLETED_AWAITING_VERIFICATION")
    expect(submitTargetStatus(false)).toBe("COMPLETED")
    expect(statusForAction("submit", { verificationRequired: true })).toBe("COMPLETED_AWAITING_VERIFICATION")
    expect(statusForAction("submit", { verificationRequired: false })).toBe("COMPLETED")
  })

  it("allows marking a task done directly when verification is not required", () => {
    // Worker can complete normally without waiting for a verifier.
    expect(canTransition("ASSIGNED", "COMPLETED")).toBe(true)
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(true)
    // A COMPLETED task can still be verified optionally, or reopened to redo.
    expect(canTransition("COMPLETED", "VERIFIED")).toBe(true)
    expect(canTransition("COMPLETED", "REJECTED")).toBe(true)
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(true)
  })

  it("keeps the legacy isComplete flag in sync with 'work reported or verified'", () => {
    const complete: TaskVerificationStatus[] = ["COMPLETED", "COMPLETED_AWAITING_VERIFICATION", "VERIFIED", "CORRECTED_AWAITING_REINSPECTION"]
    const incomplete: TaskVerificationStatus[] = ["ASSIGNED", "IN_PROGRESS", "REJECTED"]
    for (const s of complete) expect(isCompleteForStatus(s)).toBe(true)
    for (const s of incomplete) expect(isCompleteForStatus(s)).toBe(false)
  })
})

describe("self-approval prevention (isSelfVerification)", () => {
  it("flags the primary owner, the completer, and any shared owner as self", () => {
    expect(isSelfVerification({ assignedToId: "u1", completedById: null, verifierId: "u1" })).toBe(true)
    expect(isSelfVerification({ assignedToId: null, completedById: "u2", verifierId: "u2" })).toBe(true)
    expect(isSelfVerification({ assignedToId: "u1", completedById: "u2", sharedAssigneeIds: ["u3"], verifierId: "u3" })).toBe(true)
  })

  it("permits a genuinely independent verifier", () => {
    expect(isSelfVerification({ assignedToId: "u1", completedById: "u2", sharedAssigneeIds: ["u3"], verifierId: "u9" })).toBe(false)
  })
})

describe("canVerifyTask", () => {
  const base = { independentRequired: true, peerVerificationEnabled: false, isSelf: false, currentStatus: "COMPLETED_AWAITING_VERIFICATION" as TaskVerificationStatus }

  it("blocks verification unless the task is awaiting verification", () => {
    for (const s of ["ASSIGNED", "IN_PROGRESS", "VERIFIED", "REJECTED"] as TaskVerificationStatus[]) {
      expect(canVerifyTask({ ...base, role: "MANAGER", currentStatus: s }).allowed).toBe(false)
    }
    expect(canVerifyTask({ ...base, role: "MANAGER", currentStatus: "CORRECTED_AWAITING_REINSPECTION" }).allowed).toBe(true)
  })

  it("blocks self-approval even for a supervisor when independence is required", () => {
    const d = canVerifyTask({ ...base, role: "MANAGER", isSelf: true })
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.reason).toMatch(/your own work/i)
  })

  it("allows a supervisor to verify someone else's completed work", () => {
    for (const role of ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR"] as ActorRole[]) {
      expect(canVerifyTask({ ...base, role }).allowed).toBe(true)
    }
  })

  it("lets a cleaner peer-verify ONLY when peer verification is enabled and it isn't their own work", () => {
    expect(canVerifyTask({ ...base, role: "CLEANER", peerVerificationEnabled: false }).allowed).toBe(false)
    expect(canVerifyTask({ ...base, role: "CLEANER", peerVerificationEnabled: true }).allowed).toBe(true)
    expect(canVerifyTask({ ...base, role: "CLEANER", peerVerificationEnabled: true, isSelf: true }).allowed).toBe(false)
  })

  it("never lets a CLIENT verify", () => {
    expect(canVerifyTask({ ...base, role: "CLIENT", peerVerificationEnabled: true }).allowed).toBe(false)
  })

  it("permits OPTIONAL verification of a COMPLETED task (verification was not required)", () => {
    expect(canVerifyTask({ ...base, role: "MANAGER", currentStatus: "COMPLETED" }).allowed).toBe(true)
  })

  it("allows self-approval ONLY when independent verification is not required", () => {
    // Required: a worker can never verify their own work (even a manager).
    expect(canVerifyTask({ ...base, role: "MANAGER", isSelf: true, independentRequired: true }).allowed).toBe(false)
    // Not required: verification is optional, so self-attestation is permitted.
    expect(
      canVerifyTask({ ...base, role: "MANAGER", isSelf: true, independentRequired: false, currentStatus: "COMPLETED" }).allowed,
    ).toBe(true)
  })
})

describe("assignment permissions", () => {
  it("only supervisory roles assign tasks", () => {
    expect(canAssignTasks("MANAGER")).toBe(true)
    expect(canAssignTasks("SUPERVISOR")).toBe(true)
    expect(canAssignTasks("CLEANER")).toBe(false)
    expect(canAssignTasks("CLIENT")).toBe(false)
  })

  it("a cleaner may self-assign only an unowned task; supervisors always can", () => {
    expect(canSelfAssign({ role: "CLEANER", currentAssignedToId: null })).toBe(true)
    expect(canSelfAssign({ role: "CLEANER", currentAssignedToId: "someone" })).toBe(false)
    expect(canSelfAssign({ role: "MANAGER", currentAssignedToId: "someone" })).toBe(true)
  })

  it("canWorkTask: owner, shared owner, or supervisor only", () => {
    expect(canWorkTask({ role: "CLEANER", userId: "u1", assignedToId: "u1" })).toBe(true)
    expect(canWorkTask({ role: "CLEANER", userId: "u2", assignedToId: "u1", sharedAssigneeIds: ["u2"] })).toBe(true)
    expect(canWorkTask({ role: "CLEANER", userId: "u3", assignedToId: "u1", sharedAssigneeIds: ["u2"] })).toBe(false)
    expect(canWorkTask({ role: "SUPERVISOR", userId: "x", assignedToId: "u1" })).toBe(true)
  })

  it("isSupervisory covers exactly the operations roles", () => {
    expect(["OWNER", "ADMIN", "MANAGER", "SUPERVISOR"].every((r) => isSupervisory(r as ActorRole))).toBe(true)
    expect(isSupervisory("CLEANER")).toBe(false)
    expect(isSupervisory("CLIENT")).toBe(false)
  })
})
