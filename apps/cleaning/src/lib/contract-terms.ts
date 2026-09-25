import { Prisma } from "../generated/prisma/client"

// Pure contract math — expiry timing and value-vs-invoiced — so the reporting
// rules are unit-testable without a DB. Money is Prisma.Decimal.

type Money = Prisma.Decimal
const ZERO = new Prisma.Decimal(0)

/** Whole days from `now` until `date` (negative if already past). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000)
}

/** Expiring soon = has an end date that is upcoming within the lead window. */
export function isExpiringSoon(endDate: Date | null, leadDays: number, now: Date = new Date()): boolean {
  if (!endDate) return false
  const d = daysUntil(endDate, now)
  return d >= 0 && d <= leadDays
}

export type ContractProgress = { value: Money | null; invoiced: Money; remaining: Money | null; pct: number | null }

/**
 * Contract value vs actual invoiced revenue — the useful comparison. `remaining`
 * is value − invoiced (may go negative if over-invoiced); `pct` is the share of
 * the contract value invoiced so far, or null when there is no value to compare.
 */
export function contractProgress(value: Money | null, invoiced: Money): ContractProgress {
  if (value == null) return { value: null, invoiced, remaining: null, pct: null }
  const pct = value.greaterThan(ZERO) ? Number(invoiced.div(value).times(100).toDecimalPlaces(1)) : null
  return { value, invoiced, remaining: value.minus(invoiced), pct }
}
