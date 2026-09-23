import { Prisma } from "../generated/prisma/client"
import { dateKeyInZone } from "./scheduling/time"

// Pure billing arithmetic — no DB, no I/O — so the money-critical rules are unit
// testable. All amounts are Prisma.Decimal (never a JS float); rounding is
// half-up to 2 dp at the LINE level.

export type Money = Prisma.Decimal
export const ZERO = new Prisma.Decimal(0)
export const dec = (v: string | number): Money => new Prisma.Decimal(v)
export const round2 = (d: Money): Money => d.toDecimalPlaces(2)

/** Worked minutes on a completed entry, net of breaks, never negative. */
export function billableMinutes(e: { clockInAt: Date; clockOutAt: Date | null; breakMinutes: number }): number {
  if (!e.clockOutAt) return 0
  const gross = Math.round((e.clockOutAt.getTime() - e.clockInAt.getTime()) / 60000)
  return Math.max(0, gross - (e.breakMinutes ?? 0))
}

/** Minutes → hours as a 2-dp Decimal. */
export function hoursFromMinutes(minutes: number): Money {
  return round2(new Prisma.Decimal(minutes).div(60))
}

/** FLAT_PER_JOB line: quantity 1, amount = rate (2 dp). */
export function flatLine(rate: Money): { quantity: Money; amount: Money } {
  return { quantity: new Prisma.Decimal(1), amount: round2(rate) }
}

/** HOURLY line: quantity = hours (2 dp), amount = hours × rate (2 dp). */
export function hourlyLine(minutes: number, rate: Money): { quantity: Money; amount: Money } {
  const quantity = hoursFromMinutes(minutes)
  return { quantity, amount: round2(quantity.times(rate)) }
}

export const TERM_DAYS: Record<string, number> = { DUE_ON_RECEIPT: 0, NET_15: 15, NET_30: 30 }

export function dueDateFromTerms(from: Date, terms: string): Date {
  return new Date(from.getTime() + (TERM_DAYS[terms] ?? 0) * 86_400_000)
}

export type AgingBucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90"

export function agingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "current"
  if (daysOverdue <= 30) return "d1_30"
  if (daysOverdue <= 60) return "d31_60"
  if (daysOverdue <= 90) return "d61_90"
  return "d90"
}

// ─── Labor cost & margin (Phase 4) ───────────────────────────────────────────

// Standard full-time hours/year, used to express a SALARY rate as an hourly
// cost for per-job labor. Named so it is easy to find and change.
export const SALARY_HOURS_PER_YEAR = 2080

/** A pay basis expressed as an hourly rate: HOURLY as-is, SALARY / 2080. */
export function effectiveHourlyRate(rate: Money, payType: string | null): Money {
  return payType === "SALARY" ? rate.div(SALARY_HOURS_PER_YEAR) : rate
}

/**
 * Labor cost of one time entry = worked hours × effective hourly rate, rounded
 * to 2 dp. `rate` is the snapshotted pay rate (or a fallback); a null rate
 * yields 0 (unknown cost, never guessed as non-zero).
 */
export function laborCostForEntry(
  entry: { clockInAt: Date; clockOutAt: Date | null; breakMinutes: number },
  rate: Money | null,
  payType: string | null,
): Money {
  if (rate == null) return ZERO
  const hours = hoursFromMinutes(billableMinutes(entry))
  return round2(hours.times(effectiveHourlyRate(rate, payType)))
}

/** Gross margin percentage as a number (1 dp), or null when there is no revenue. */
export function marginPct(revenue: Money, cost: Money): number | null {
  if (revenue.lessThanOrEqualTo(ZERO)) return null
  return Number(revenue.minus(cost).div(revenue).times(100).toDecimalPlaces(1))
}

export const startOfUtcDay = (isoDate: string): Date => new Date(`${isoDate}T00:00:00.000Z`)
export const endOfUtcDay = (isoDate: string): Date => new Date(`${isoDate}T23:59:59.999Z`)

/**
 * Whether an instant belongs to a billing period, decided by the SITE's local
 * wall-clock day — not by UTC. `tz` is the resolved site/org timezone (same
 * resolution the scheduler uses); `periodStart`/`periodEnd` are inclusive
 * `yyyy-MM-dd` bounds. Because `dateKeyInZone` yields `yyyy-MM-dd`, a lexical
 * compare is a correct chronological compare. This is what keeps a job
 * scheduled 8pm local on the 31st on that month's invoice even though it is the
 * 1st in UTC.
 */
export function isInBillingPeriod(instant: Date, tz: string, periodStart: string, periodEnd: string): boolean {
  const key = dateKeyInZone(instant, tz)
  return key >= periodStart && key <= periodEnd
}
