import { DateTime } from "luxon"
import { dec, ZERO, round2, hoursFromMinutes, billableMinutes, type Money } from "./billing-math"

// Shift differentials & labor burden (Phase 43). Pure, DB-free math so the
// money-critical rules are unit-tested. A differential rule pays a premium on
// the worked minutes that fall in a daily LOCAL time window and (optionally) on
// specific weekdays. Breaks are prorated against the eligible window so a lunch
// never inflates the premium. BOUNDARY: cost/export figures only — not payroll.

export type DifferentialRule = {
  startMinute: number // local minutes-from-midnight, inclusive
  endMinute: number // local minutes-from-midnight, exclusive; < start means it wraps past midnight
  daysOfWeek: number[] // 0=Sun..6=Sat; empty = every day
  amountType: "PERCENT" | "FLAT_PER_HOUR"
  value: Money // percent (10 = 10%) or $/hour
}

const DAY_MIN = 1440

// luxon weekday is 1=Mon..7=Sun; convert to 0=Sun..6=Sat.
function jsWeekday(dt: DateTime): number {
  return dt.weekday % 7
}

/**
 * Minutes of [clockIn, clockOut) that fall inside a rule's daily window and on
 * a matching weekday, evaluated in the site timezone. Handles windows that wrap
 * past midnight and shifts that span multiple local days.
 */
export function windowOverlapMinutes(clockInAt: Date, clockOutAt: Date, tz: string, rule: DifferentialRule): number {
  const start = DateTime.fromJSDate(clockInAt, { zone: tz })
  const end = DateTime.fromJSDate(clockOutAt, { zone: tz })
  if (end <= start) return 0
  const days = new Set(rule.daysOfWeek)
  const matchesDay = (dt: DateTime) => days.size === 0 || days.has(jsWeekday(dt))

  let total = 0
  // Walk each local calendar day the shift touches (at most a couple).
  let dayCursor = start.startOf("day")
  const lastDay = end.startOf("day")
  while (dayCursor <= lastDay) {
    // Candidate window(s) anchored to this local day.
    const windows: [DateTime, DateTime][] = []
    if (rule.startMinute <= rule.endMinute) {
      windows.push([dayCursor.plus({ minutes: rule.startMinute }), dayCursor.plus({ minutes: rule.endMinute })])
    } else {
      // Wraps: [start, midnight) on this day, and [midnight, end) early this day.
      windows.push([dayCursor.plus({ minutes: rule.startMinute }), dayCursor.plus({ minutes: DAY_MIN })])
      windows.push([dayCursor, dayCursor.plus({ minutes: rule.endMinute })])
    }
    for (const [ws, we] of windows) {
      // The weekday test uses the window's own start (the day the minutes occur).
      if (!matchesDay(ws)) continue
      const lo = ws > start ? ws : start
      const hi = we < end ? we : end
      if (hi > lo) total += hi.diff(lo, "minutes").minutes
    }
    dayCursor = dayCursor.plus({ days: 1 })
  }
  return Math.round(total)
}

/**
 * The differential premium ($) earned on one approved entry, summed over all
 * rules, plus a short note of which rules applied. `baseRate` is the hourly rate
 * (used for PERCENT rules). Breaks are prorated: eligible minutes are scaled by
 * billable/gross so a mid-shift break reduces the premium proportionally.
 */
export function computeDifferential(
  entry: { clockInAt: Date; clockOutAt: Date | null; breakMinutes: number },
  baseRate: Money | null,
  tz: string,
  rules: (DifferentialRule & { name: string })[],
): { amount: Money; note: string } {
  if (!entry.clockOutAt) return { amount: ZERO, note: "" }
  const grossMin = Math.round((entry.clockOutAt.getTime() - entry.clockInAt.getTime()) / 60000)
  if (grossMin <= 0) return { amount: ZERO, note: "" }
  const billable = billableMinutes(entry)
  const breakScale = grossMin > 0 ? billable / grossMin : 0

  let amount = ZERO
  const notes: string[] = []
  for (const rule of rules) {
    const overlap = windowOverlapMinutes(entry.clockInAt, entry.clockOutAt, tz, rule)
    if (overlap <= 0) continue
    const eligibleHours = hoursFromMinutes(Math.round(overlap * breakScale))
    if (eligibleHours.lessThanOrEqualTo(ZERO)) continue
    let premium: Money
    if (rule.amountType === "FLAT_PER_HOUR") {
      premium = round2(eligibleHours.times(rule.value))
    } else {
      // PERCENT of base rate per eligible hour; no base rate → no percent premium.
      if (baseRate == null) continue
      premium = round2(eligibleHours.times(baseRate).times(rule.value).div(100))
    }
    if (premium.greaterThan(ZERO)) {
      amount = amount.plus(premium)
      notes.push(`${rule.name} +${premium.toFixed(2)}`)
    }
  }
  return { amount: round2(amount), note: notes.join("; ") }
}

/** Burdened labor = labor × (1 + burdenPct). burdenPct is a fraction (0.25=25%). */
export function applyBurden(labor: Money, burdenPct: Money): Money {
  if (burdenPct.lessThanOrEqualTo(ZERO)) return labor
  return round2(labor.times(dec(1).plus(burdenPct)))
}
