import { describe, it, expect } from "vitest"
import { scoreInspection, type ScoringItem } from "../scoring"

const item = (points: number, result: ScoringItem["result"], isCritical = false): ScoringItem => ({ points, result, isCritical })

describe("scoreInspection", () => {
  it("scores earned/applicable × 100 and PASSes at/above threshold", () => {
    const r = scoreInspection([item(1, "PASS"), item(1, "PASS"), item(1, "PASS"), item(1, "FAIL")], 70)
    expect(r.score).toBe(75)
    expect(r.outcome).toBe("PASS")
  })

  it("FAILs below threshold", () => {
    const r = scoreInspection([item(1, "PASS"), item(1, "FAIL"), item(1, "FAIL")], 80)
    expect(r.score).toBeCloseTo(33.3, 1)
    expect(r.outcome).toBe("FAIL")
  })

  it("excludes N/A from the denominator", () => {
    // 2 of 3 pass, third is N/A → 100%.
    const r = scoreInspection([item(1, "PASS"), item(1, "PASS"), item(1, "NA")], 80)
    expect(r.applicablePoints).toBe(2)
    expect(r.score).toBe(100)
    expect(r.outcome).toBe("PASS")
  })

  it("honors weighted points", () => {
    const r = scoreInspection([item(3, "PASS"), item(1, "FAIL")], 70)
    expect(r.score).toBe(75) // 3 / 4
  })

  it("a failed CRITICAL item forces FAIL even above threshold", () => {
    const r = scoreInspection([item(10, "PASS"), item(10, "PASS"), item(1, "FAIL", true)], 80)
    expect(r.score).toBeCloseTo(95.2, 1) // 20/21
    expect(r.criticalFailure).toBe(true)
    expect(r.outcome).toBe("FAIL")
  })

  it("a passed critical item does not force failure", () => {
    const r = scoreInspection([item(1, "PASS", true), item(1, "PASS")], 80)
    expect(r.outcome).toBe("PASS")
  })

  it("all-N/A (or empty) scores 100 / PASS", () => {
    expect(scoreInspection([item(1, "NA"), item(1, "NA")], 80).outcome).toBe("PASS")
    expect(scoreInspection([], 80).score).toBe(100)
  })
})
