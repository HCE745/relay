import { DateTime } from "luxon"

// Pure period math for flat-period (recurring) billing — month/quarter windows
// resolved in the SITE's local timezone, so a plan billed "March" means the
// site's March. Kept DB-free so the enumeration rules are unit-testable.

export type PeriodFrequencyValue = "MONTHLY" | "QUARTERLY"

export type BillingPeriod = {
  /** Stable idempotency key fragment (combined with the plan id), e.g. "M:2026-03". */
  key: string
  /** Human label for the invoice line, e.g. "March 2026" or "Q1 2026". */
  label: string
  /** Period bounds as local calendar dates ("YYYY-MM-DD") for job membership. */
  startISO: string
  endISO: string
  /** The period's final instant (local end-of-day), for "has it ended yet" checks. */
  end: Date
}

function build(freq: PeriodFrequencyValue, pStart: DateTime, pEnd: DateTime): BillingPeriod {
  const key =
    freq === "QUARTERLY" ? `Q:${pStart.year}-Q${pStart.quarter}` : `M:${pStart.year}-${String(pStart.month).padStart(2, "0")}`
  const label = freq === "QUARTERLY" ? `Q${pStart.quarter} ${pStart.year}` : pStart.toFormat("LLLL yyyy")
  return { key, label, startISO: pStart.toFormat("yyyy-MM-dd"), endISO: pEnd.toFormat("yyyy-MM-dd"), end: pEnd.toJSDate() }
}

/**
 * Every calendar period of `freq` (month or quarter, site-local) that overlaps
 * the window [startISO, endISO]. Used to decide which flat-rate charges fall due.
 */
export function periodsInWindow(
  freq: PeriodFrequencyValue,
  startISO: string,
  endISO: string,
  tz: string,
): BillingPeriod[] {
  const unit = freq === "QUARTERLY" ? "quarter" : "month"
  const start = DateTime.fromISO(startISO, { zone: tz }).startOf("day")
  const end = DateTime.fromISO(endISO, { zone: tz }).endOf("day")
  if (!start.isValid || !end.isValid || end < start) return []
  const out: BillingPeriod[] = []
  let cur = start.startOf(unit)
  // Bound the loop defensively (≤ ~40 periods even for a decade window).
  for (let i = 0; i < 200 && cur <= end; i++) {
    const pEnd = cur.endOf(unit)
    if (pEnd >= start && cur <= end) out.push(build(freq, cur, pEnd))
    cur = unit === "quarter" ? cur.plus({ quarters: 1 }) : cur.plus({ months: 1 })
  }
  return out
}

/** The canonical period a given instant falls in (site-local). */
export function periodForInstant(freq: PeriodFrequencyValue, instant: Date, tz: string): BillingPeriod {
  const unit = freq === "QUARTERLY" ? "quarter" : "month"
  const dt = DateTime.fromJSDate(instant, { zone: tz })
  return build(freq, dt.startOf(unit), dt.endOf(unit))
}
