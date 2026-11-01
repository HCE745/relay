import { describe, it, expect } from "vitest"
import { rankCandidate, rankCandidates, type CandidateFacts } from "../scheduling/matching"

const base = (over: Partial<CandidateFacts> = {}): CandidateFacts => ({
  userId: "u",
  name: "A",
  priorJobsAtSite: 0,
  requiredSkills: [],
  matchedSkills: [],
  requiredCredentials: [],
  missingCredentials: [],
  ...over,
})

describe("rankCandidate", () => {
  it("is qualified with a null score when nothing is required", () => {
    const r = rankCandidate(base())
    expect(r.qualified).toBe(true)
    expect(r.matchScore).toBeNull()
    expect(r.missingSkills).toEqual([])
  })

  it("computes missing skills and a partial score", () => {
    const r = rankCandidate(base({ requiredSkills: ["floor", "window"], matchedSkills: ["floor"] }))
    expect(r.missingSkills).toEqual(["window"])
    expect(r.qualified).toBe(false)
    expect(r.matchScore).toBe(50)
  })

  it("counts credential gaps toward the score and disqualifies", () => {
    const r = rankCandidate(
      base({
        requiredSkills: ["floor"],
        matchedSkills: ["floor"],
        requiredCredentials: ["BACKGROUND_CHECK"],
        missingCredentials: [{ type: "BACKGROUND_CHECK", reason: "expired" }],
      }),
    )
    // 1 of 2 requirements met (skill yes, credential no).
    expect(r.matchScore).toBe(50)
    expect(r.qualified).toBe(false)
  })

  it("is fully qualified when every requirement is met", () => {
    const r = rankCandidate(base({ requiredSkills: ["floor"], matchedSkills: ["floor"], requiredCredentials: ["INSURANCE"], missingCredentials: [] }))
    expect(r.qualified).toBe(true)
    expect(r.matchScore).toBe(100)
  })
})

describe("rankCandidates", () => {
  it("PRESERVES Phase 11 behavior when nothing is required: prior jobs then name", () => {
    const ranked = rankCandidates([
      base({ userId: "a", name: "Zed", priorJobsAtSite: 1 }),
      base({ userId: "b", name: "Amy", priorJobsAtSite: 5 }),
      base({ userId: "c", name: "Bob", priorJobsAtSite: 1 }),
    ])
    expect(ranked.map((r) => r.userId)).toEqual(["b", "c", "a"]) // 5 prior, then Bob<Zed by name
  })

  it("ranks fully-qualified ahead of partial, then by score, then history", () => {
    const ranked = rankCandidates([
      base({ userId: "partial", name: "P", requiredSkills: ["x", "y"], matchedSkills: ["x"], priorJobsAtSite: 99 }),
      base({ userId: "full", name: "F", requiredSkills: ["x", "y"], matchedSkills: ["x", "y"], priorJobsAtSite: 0 }),
    ])
    expect(ranked[0].userId).toBe("full") // qualified wins despite zero history
    expect(ranked[1].userId).toBe("partial")
  })
})
