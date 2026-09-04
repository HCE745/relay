// Business-day scheduling utilities for the CRM Sales Workflow Engine

/**
 * Returns true if a given Date falls on a weekend (Sat/Sun) in the given IANA timezone.
 */
function isWeekend(date: Date, timezone: string): boolean {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(date)
  return day === "Sat" || day === "Sun"
}

/**
 * Add N business days to a date (skipping Saturday/Sunday), then snap the result
 * to the next valid sending window (Mon-Fri, windowStart:00 – windowEnd:00 local time).
 * Returns a UTC Date that, when rendered in `timezone`, falls within the sending window.
 */
export function addBusinessDays(
  from: Date,
  days: number,
  timezone: string,
  windowStartHour = 9,
  windowEndHour   = 16,
): Date {
  let result = new Date(from)
  let added  = 0
  while (added < days) {
    result = new Date(result.getTime() + 24 * 60 * 60 * 1000)
    if (!isWeekend(result, timezone)) added++
  }
  return snapToWindow(result, timezone, windowStartHour, windowEndHour)
}

/**
 * Snaps a Date to the next valid sending-window moment in the given timezone.
 * If the date/time is already within the window, it returns as-is (hour kept at 9am for clean scheduling).
 * If the date is outside the window or on a weekend, advances to the next business day at windowStartHour.
 */
export function snapToWindow(
  date: Date,
  timezone: string,
  windowStartHour = 9,
  windowEndHour   = 16,
): Date {
  // Parse the current local time components in the target timezone
  const fmt = (unit: Intl.DateTimeFormatOptions["hour12"] extends never ? never : Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, ...unit }).format(date)

  const localHour = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(date),
    10,
  )
  const isWknd = isWeekend(date, timezone)

  if (!isWknd && localHour >= windowStartHour && localHour < windowEndHour) {
    // Already inside window — pin to 9am on the same day for predictable scheduling
    return setLocalHour(date, timezone, windowStartHour)
  }

  // Advance to next business day
  let candidate = new Date(date)
  // If after window end (or weekend), move to next day
  if (localHour >= windowEndHour || isWknd) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000)
  }
  // Skip weekends
  while (isWeekend(candidate, timezone)) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000)
  }
  return setLocalHour(candidate, timezone, windowStartHour)
}

/**
 * Set the hour (0-23) in local time for a given timezone, returning a UTC Date.
 */
function setLocalHour(date: Date, timezone: string, hour: number): Date {
  // Get local date parts
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date)

  const year  = parseInt(parts.find(p => p.type === "year")!.value, 10)
  const month = parseInt(parts.find(p => p.type === "month")!.value, 10) - 1
  const day   = parseInt(parts.find(p => p.type === "day")!.value, 10)

  // Build an ISO string in that timezone to find UTC offset
  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00`
  // Use the Temporal-free approach: create a date string and parse the offset
  const localDate = new Date(`${iso}`)
  // The offset trick: create UTC time then adjust
  const utcGuess  = new Date(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00Z`)
  const offset    = getOffsetMinutes(utcGuess, timezone)
  return new Date(utcGuess.getTime() - offset * 60 * 1000)
}

/**
 * Returns the UTC-offset in minutes for the given timezone at the given UTC instant.
 * Positive means UTC+X.
 */
function getOffsetMinutes(utcDate: Date, timezone: string): number {
  // Format both in UTC and in the target timezone, compare
  const utcStr   = utcDate.toLocaleString("en-US", { timeZone: "UTC" })
  const localStr  = utcDate.toLocaleString("en-US", { timeZone: timezone })
  const diff      = (new Date(localStr).getTime() - new Date(utcStr).getTime()) / (60 * 1000)
  return diff
}

/**
 * Returns a human-readable relative description: "today", "tomorrow", "in 3 days", "2 days ago", etc.
 */
export function relativeDays(date: Date, now = new Date()): string {
  const diffMs  = date.getTime() - now.getTime()
  const diffD   = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffD === 0)  return "today"
  if (diffD === 1)  return "tomorrow"
  if (diffD === -1) return "yesterday"
  if (diffD > 0)    return `in ${diffD} days`
  return `${Math.abs(diffD)} days ago`
}
