import { type Money, ZERO, round2 } from "./billing-math"

// ─── Labor budgeting & variance math (Phase 46) ──────────────────────────────
//
// Pure functions — no database. A budget is a run-rate (weekly or monthly) of
// expected labor HOURS and COST; the report prorates it to the report range and
// compares against scheduled and actual figures.

export type BudgetPeriod = "WEEKLY" | "MONTHLY"

/** Nominal days in a budget period (monthly uses 30, matching indirect costs). */
export function periodDays(p: BudgetPeriod): number {
  return p === "WEEKLY" ? 7 : 30
}

/** The budgeted amount for a report of `rangeDays` days: amount × rangeDays / periodDays. */
export function prorate(amount: Money, period: BudgetPeriod, rangeDays: number): Money {
  const d = periodDays(period)
  if (d <= 0 || rangeDays <= 0) return ZERO
  return round2(amount.times(rangeDays).div(d))
}

export type Variance = {
  budget: Money
  actual: Money
  variance: Money // actual − budget (positive = over budget)
  pctUsed: number | null // actual / budget as a percent; null when budget is 0
}

export function variance(budget: Money, actual: Money): Variance {
  return {
    budget,
    actual,
    variance: actual.minus(budget),
    pctUsed: budget.isZero() ? null : Number(actual.div(budget).times(100).toDecimalPlaces(1)),
  }
}
