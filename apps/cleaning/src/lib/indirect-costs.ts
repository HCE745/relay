import { type Money, ZERO, dec, round2 } from "./billing-math"

// ─── Indirect cost allocation math (Phase 45) ────────────────────────────────
//
// Pure functions — no database. A pool holds a periodic indirect cost
// (equipment, insurance, overhead); the profitability report spreads it across
// rows (sites / customers / plans) by a chosen driver. Everything here is
// recomputed live at report time, so nothing is snapshotted.

export type AllocationBasis = "REVENUE" | "LABOR_COST" | "LABOR_HOURS" | "JOB_COUNT" | "EVEN"

export type IndirectPool = {
  id: string
  name: string
  category: string
  amount: Money // cost covering `periodDays` days
  periodDays: number
  basis: AllocationBasis
  effectiveFrom: Date | null
  effectiveTo: Date | null
}

/** A row we can allocate cost to, with the driver values the bases need. */
export type AllocTarget = {
  id: string
  revenue: Money
  laborCost: Money
  laborHours: Money
  jobs: number
}

function driverValue(t: AllocTarget, basis: AllocationBasis): Money {
  switch (basis) {
    case "REVENUE":
      return t.revenue
    case "LABOR_COST":
      return t.laborCost
    case "LABOR_HOURS":
      return t.laborHours
    case "JOB_COUNT":
      return dec(t.jobs)
    case "EVEN":
      return dec(1)
  }
}

/**
 * Whether a pool's effective window contains any of the report period. The
 * window is an on/off applicability gate, NOT a proration input — a pool that
 * is active during the period contributes its full period-prorated amount.
 */
export function poolApplies(pool: IndirectPool, periodStart: Date, periodEnd: Date): boolean {
  if (pool.effectiveFrom && pool.effectiveFrom > periodEnd) return false
  if (pool.effectiveTo && pool.effectiveTo < periodStart) return false
  return true
}

/** The pool's cost for a report of `reportDays` days: amount × reportDays / periodDays. */
export function proratedAmount(pool: IndirectPool, reportDays: number): Money {
  if (pool.periodDays <= 0 || reportDays <= 0) return ZERO
  return round2(pool.amount.times(reportDays).div(pool.periodDays))
}

export type Allocation = {
  byTarget: Map<string, Money> // targetId → allocated indirect cost
  totalAllocated: Money // sum actually spread across targets
  unallocated: Money // pool cost with no target to carry it (no rows / zero driver + no rows)
}

/**
 * Spread the applicable pools across the targets. For each pool: prorate to the
 * report length, then split by the chosen driver's share. A zero total driver
 * falls back to an EVEN split; with no targets at all the pool is unallocated
 * (surfaced so the report total stays honest). Per-pool rounding drift is
 * absorbed by the largest-share target, so the split always re-sums to the pool.
 */
export function allocateIndirect(
  pools: IndirectPool[],
  targets: AllocTarget[],
  reportDays: number,
  periodStart: Date,
  periodEnd: Date,
): Allocation {
  const byTarget = new Map<string, Money>()
  let totalAllocated = ZERO
  let unallocated = ZERO

  for (const pool of pools) {
    if (!poolApplies(pool, periodStart, periodEnd)) continue
    const poolTotal = proratedAmount(pool, reportDays)
    if (poolTotal.isZero()) continue

    if (targets.length === 0) {
      unallocated = unallocated.plus(poolTotal)
      continue
    }

    // Driver weights (fall back to EVEN when the chosen driver sums to zero).
    let weights = targets.map((t) => ({ id: t.id, w: driverValue(t, pool.basis) }))
    let totalW = weights.reduce((a, x) => a.plus(x.w), ZERO)
    if (totalW.isZero()) {
      weights = targets.map((t) => ({ id: t.id, w: dec(1) }))
      totalW = dec(targets.length)
    }

    // Allocate, tracking the largest-weight target to carry the rounding remainder.
    let running = ZERO
    let maxId = weights[0].id
    let maxW = weights[0].w
    for (const { id, w } of weights) {
      const share = round2(poolTotal.times(w).div(totalW))
      byTarget.set(id, (byTarget.get(id) ?? ZERO).plus(share))
      running = running.plus(share)
      if (w.greaterThan(maxW)) {
        maxW = w
        maxId = id
      }
    }
    const remainder = poolTotal.minus(running)
    if (!remainder.isZero()) byTarget.set(maxId, (byTarget.get(maxId) ?? ZERO).plus(remainder))
    totalAllocated = totalAllocated.plus(poolTotal)
  }

  return { byTarget, totalAllocated, unallocated }
}

/** Inclusive day count between two YYYY-MM-DD dates (same day = 1). */
export function inclusiveDays(periodStart: string, periodEnd: string): number {
  const start = Date.parse(`${periodStart}T00:00:00.000Z`)
  const end = Date.parse(`${periodEnd}T00:00:00.000Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  return Math.round((end - start) / 86_400_000) + 1
}
