import { DateTime } from "luxon"

// Timezone-aware helpers shared by scheduling code. All conversions go through
// luxon with an explicit IANA zone — never the server's local timezone.

/** Compose a local calendar date + "HH:mm" in `tz` into a real UTC instant. */
export function wallTimeToInstant(dateISO: string, time: string, tz: string): Date {
  const [h, m] = time.split(":").map(Number)
  const [y, mo, d] = dateISO.split("-").map(Number)
  return DateTime.fromObject({ year: y, month: mo, day: d, hour: h || 0, minute: m || 0 }, { zone: tz }).toJSDate()
}

/** Format an instant in the site zone, e.g. "9:00 AM". */
export function formatTimeInZone(instant: Date, tz: string): string {
  return DateTime.fromJSDate(instant, { zone: tz }).toFormat("h:mm a")
}

/** The site-local calendar date key ("YYYY-MM-DD") for an instant. */
export function dateKeyInZone(instant: Date, tz: string): string {
  return DateTime.fromJSDate(instant, { zone: tz }).toFormat("yyyy-MM-dd")
}
