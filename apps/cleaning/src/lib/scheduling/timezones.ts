// IANA timezone helpers. We store ONLY valid IANA identifiers — never
// human-readable text — and validate them via the Intl database.

const FALLBACK = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
]

/** All IANA zones supported by the runtime (falls back to a common subset). */
export function listTimezones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
  try {
    return supported ? supported("timeZone") : FALLBACK
  } catch {
    return FALLBACK
  }
}

/** True if `tz` is a valid IANA identifier the runtime can format with. */
export function isValidTimezone(tz: string): boolean {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}
