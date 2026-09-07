// Centralized, deterministic inspection scoring (V1). No AI.
//
// Rules:
//   • score = earnedPoints / applicablePoints × 100
//   • PASS item earns its full points; FAIL earns 0
//   • N/A is excluded from BOTH numerator and denominator
//   • all-N/A (or no items) → score 100, PASS (nothing failed)
//   • outcome = PASS when score ≥ passThreshold …
//   • …EXCEPT a FAILED CRITICAL item forces overall FAIL regardless of score
//
// The score is computed once at finalize and stored on the Inspection; it is
// never re-derived from the (mutable) template afterwards.

export type ResultValue = "PASS" | "FAIL" | "NA"

export type ScoringItem = {
  points: number
  isCritical: boolean
  result: ResultValue | null
}

export type ScoreOutcome = {
  score: number
  outcome: "PASS" | "FAIL"
  earnedPoints: number
  applicablePoints: number
  criticalFailure: boolean
}

export function scoreInspection(items: ScoringItem[], passThreshold: number): ScoreOutcome {
  let earned = 0
  let applicable = 0
  let criticalFailure = false

  for (const it of items) {
    // null (unscored) and NA are excluded from the denominator.
    if (it.result === null || it.result === "NA") continue
    applicable += it.points
    if (it.result === "PASS") earned += it.points
    else if (it.result === "FAIL" && it.isCritical) criticalFailure = true
  }

  const score = applicable === 0 ? 100 : (earned / applicable) * 100
  const rounded = Math.round(score * 10) / 10
  const outcome: "PASS" | "FAIL" = criticalFailure ? "FAIL" : rounded >= passThreshold ? "PASS" : "FAIL"

  return { score: rounded, outcome, earnedPoints: earned, applicablePoints: applicable, criticalFailure }
}
