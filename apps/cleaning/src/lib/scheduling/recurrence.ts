import { RRule, rrulestr } from "rrule"
import { DateTime } from "luxon"

// ─── Recurrence service ──────────────────────────────────────────────────────
//
// The rest of Cleaning depends on THIS module, never on rrule/luxon directly, so
// the recurrence engine can be swapped without touching product code.
//
// Timezone strategy (explicit — we never use the server's local timezone):
//   • Scheduling wall-clock time is defined in the SITE's IANA timezone
//     (ServiceLocation.timezone ?? Organization.timezone), passed in as `timezone`.
//   • `startDate` supplies the anchor calendar date (read via its UTC Y/M/D so
//     the server timezone can't shift it); `startTime` ("HH:mm") is the local
//     wall-clock start.
//   • rrule is timezone-naive: we generate "floating" occurrences whose Y/M/D/H/M
//     represent local wall-clock, then bind each to the site zone with luxon to
//     get the correct UTC instant — which is DST-aware (09:00 local stays 09:00
//     across a DST transition even though its UTC offset changes).
//   • Callers store the returned Date (a true UTC instant) in Job.scheduledStart.

const MAX_OCCURRENCES = 1000 // safety cap so an unbounded rule can't run away

export type Frequency = "ONE_TIME" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM"

export type PlanRecurrence = {
  frequency: Frequency
  startDate: Date
  startTime?: string | null
  rrule?: string | null
  endDate?: Date | null
  timezone: string
}

function parseTime(t?: string | null): { hour: number; minute: number } {
  if (t && /^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(":").map(Number)
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return { hour: h, minute: m }
  }
  return { hour: 9, minute: 0 }
}

/** A floating Date whose UTC-encoded fields carry local wall-clock parts. */
function naive(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))
}

/** Interpret a floating wall-clock Date as local time in `tz` → real UTC instant. */
function toInstant(n: Date, tz: string): Date {
  return DateTime.fromObject(
    {
      year: n.getUTCFullYear(),
      month: n.getUTCMonth() + 1,
      day: n.getUTCDate(),
      hour: n.getUTCHours(),
      minute: n.getUTCMinutes(),
    },
    { zone: tz },
  ).toJSDate()
}

/** Real UTC instant → floating wall-clock Date in `tz`. */
function toNaive(instant: Date, tz: string): Date {
  const dt = DateTime.fromJSDate(instant, { zone: tz })
  return naive(dt.year, dt.month, dt.day, dt.hour, dt.minute)
}

// Both RRule and RRuleSet expose between(); that's all we need here.
type Recurrable = { between(after: Date, before: Date, inc?: boolean): Date[] }

function buildRule(rec: PlanRecurrence, dtstart: Date): Recurrable | null {
  switch (rec.frequency) {
    case "DAILY":
      return new RRule({ freq: RRule.DAILY, interval: 1, dtstart })
    case "WEEKLY":
      return new RRule({ freq: RRule.WEEKLY, interval: 1, dtstart })
    case "BIWEEKLY":
      return new RRule({ freq: RRule.WEEKLY, interval: 2, dtstart })
    case "MONTHLY":
      return new RRule({ freq: RRule.MONTHLY, interval: 1, dtstart })
    case "CUSTOM":
      return rec.rrule ? rrulestr(rec.rrule, { dtstart }) : null
    default:
      return null
  }
}

/**
 * Occurrence start instants (UTC) within [windowStart, windowEnd], inclusive,
 * respecting startDate/startTime/endDate and the site timezone. Deterministic
 * and side-effect free — safe to call repeatedly during idempotent generation.
 */
export function generateOccurrences(rec: PlanRecurrence, windowStart: Date, windowEnd: Date): Date[] {
  const { hour, minute } = parseTime(rec.startTime)
  const dtstart = naive(
    rec.startDate.getUTCFullYear(),
    rec.startDate.getUTCMonth() + 1,
    rec.startDate.getUTCDate(),
    hour,
    minute,
  )

  // Latest allowed instant (endDate is an inclusive calendar date, end-of-day).
  const endLimit = rec.endDate
    ? toInstant(
        naive(rec.endDate.getUTCFullYear(), rec.endDate.getUTCMonth() + 1, rec.endDate.getUTCDate(), 23, 59),
        rec.timezone,
      )
    : null

  const within = (instant: Date) =>
    instant >= windowStart && instant <= windowEnd && (!endLimit || instant <= endLimit)

  if (rec.frequency === "ONE_TIME") {
    const instant = toInstant(dtstart, rec.timezone)
    return within(instant) ? [instant] : []
  }

  const rule = buildRule(rec, dtstart)
  if (!rule) return []

  // rrule operates in the floating space, so convert the window bounds to
  // floating wall-clock before querying, then bind results back to real instants.
  const floatingStarts = rule.between(toNaive(windowStart, rec.timezone), toNaive(windowEnd, rec.timezone), true)

  const out: Date[] = []
  for (const f of floatingStarts) {
    const instant = toInstant(f, rec.timezone)
    if (within(instant)) out.push(instant)
    if (out.length >= MAX_OCCURRENCES) break
  }
  return out
}

const FREQUENCY_LABELS: Record<Frequency, string> = {
  ONE_TIME: "One-time",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
  CUSTOM: "Custom",
}

export function describeFrequency(freq: Frequency): string {
  return FREQUENCY_LABELS[freq] ?? freq
}
