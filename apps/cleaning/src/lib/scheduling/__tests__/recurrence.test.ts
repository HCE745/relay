import { describe, it, expect } from "vitest"
import { DateTime } from "luxon"
import { generateOccurrences, type PlanRecurrence } from "../recurrence"

const TZ = "America/New_York"
const d = (iso: string) => new Date(iso)

// Local wall-clock parts of an instant, in the site zone.
const local = (instant: Date, tz = TZ) => {
  const dt = DateTime.fromJSDate(instant, { zone: tz })
  return { hour: dt.hour, minute: dt.minute, weekday: dt.weekday, day: dt.day, offset: dt.offset }
}

const base: Omit<PlanRecurrence, "frequency"> = {
  startDate: d("2026-03-02T00:00:00Z"), // Monday, March 2 2026
  startTime: "09:00",
  timezone: TZ,
}

describe("frequencies", () => {
  it("DAILY yields one occurrence per day within the window", () => {
    const occ = generateOccurrences(
      { ...base, frequency: "DAILY" },
      d("2026-03-02T00:00:00Z"),
      d("2026-03-08T23:59:00Z"),
    )
    expect(occ.length).toBe(7)
    expect(occ.every((o) => local(o).hour === 9)).toBe(true)
  })

  it("WEEKLY yields one per week on the anchor weekday", () => {
    const occ = generateOccurrences(
      { ...base, frequency: "WEEKLY" },
      d("2026-03-02T00:00:00Z"),
      d("2026-03-30T23:59:00Z"),
    )
    expect(occ.length).toBe(5) // Mar 2, 9, 16, 23, 30
    expect(occ.every((o) => local(o).weekday === 1)).toBe(true) // Monday
  })

  it("BIWEEKLY skips alternate weeks", () => {
    const occ = generateOccurrences(
      { ...base, frequency: "BIWEEKLY" },
      d("2026-03-02T00:00:00Z"),
      d("2026-04-13T23:59:00Z"),
    )
    // Mar 2, 16, 30, Apr 13
    expect(occ.length).toBe(4)
  })

  it("MONTHLY yields one per month on the anchor day", () => {
    const occ = generateOccurrences(
      { ...base, frequency: "MONTHLY" },
      d("2026-03-02T00:00:00Z"),
      d("2026-06-02T23:59:00Z"),
    )
    expect(occ.length).toBe(4) // Mar 2, Apr 2, May 2, Jun 2
    expect(occ.every((o) => local(o).day === 2)).toBe(true)
  })

  it("ONE_TIME yields a single occurrence, only when in window", () => {
    const inWin = generateOccurrences({ ...base, frequency: "ONE_TIME" }, d("2026-03-01T00:00:00Z"), d("2026-03-31T00:00:00Z"))
    expect(inWin.length).toBe(1)
    const outWin = generateOccurrences({ ...base, frequency: "ONE_TIME" }, d("2026-04-01T00:00:00Z"), d("2026-04-30T00:00:00Z"))
    expect(outWin.length).toBe(0)
  })

  it("CUSTOM uses a raw RRULE (Mon/Wed/Fri)", () => {
    const occ = generateOccurrences(
      { ...base, frequency: "CUSTOM", rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR" },
      d("2026-03-02T00:00:00Z"),
      d("2026-03-08T23:59:00Z"),
    )
    expect(occ.length).toBe(3) // Mon 2, Wed 4, Fri 6
    expect(occ.every((o) => local(o).hour === 9)).toBe(true)
  })

  it("CUSTOM with no rrule yields nothing", () => {
    expect(generateOccurrences({ ...base, frequency: "CUSTOM" }, d("2026-03-02T00:00:00Z"), d("2026-04-01T00:00:00Z"))).toEqual([])
  })
})

describe("bounds", () => {
  it("respects startDate (no occurrences before it)", () => {
    const occ = generateOccurrences(
      { ...base, frequency: "DAILY" },
      d("2026-02-20T00:00:00Z"),
      d("2026-03-04T23:59:00Z"),
    )
    // Starts Mar 2 despite the window opening Feb 20.
    expect(occ.length).toBe(3) // Mar 2, 3, 4
  })

  it("respects endDate (inclusive calendar date)", () => {
    const occ = generateOccurrences(
      { ...base, frequency: "DAILY", endDate: d("2026-03-05T00:00:00Z") },
      d("2026-03-02T00:00:00Z"),
      d("2026-03-31T23:59:00Z"),
    )
    expect(occ.length).toBe(4) // Mar 2, 3, 4, 5
  })
})

describe("timezone + DST", () => {
  it("keeps 09:00 local across the US spring-forward (Mar 8 2026)", () => {
    // Weekly Sunday 09:00, spanning the DST change.
    const rec: PlanRecurrence = {
      frequency: "WEEKLY",
      startDate: d("2026-03-01T00:00:00Z"), // Sunday before DST (EST)
      startTime: "09:00",
      timezone: TZ,
    }
    const occ = generateOccurrences(rec, d("2026-03-01T00:00:00Z"), d("2026-03-15T23:59:00Z"))
    expect(occ.length).toBe(3) // Mar 1 (EST), Mar 8 (EDT), Mar 15 (EDT)

    // Local time stays 09:00 for every occurrence…
    expect(occ.every((o) => local(o).hour === 9 && local(o).minute === 0)).toBe(true)
    // …but the UTC offset actually changed across the boundary (DST handled).
    expect(local(occ[0]).offset).not.toBe(local(occ[1]).offset)
    // EST = -300, EDT = -240
    expect(local(occ[0]).offset).toBe(-300)
    expect(local(occ[1]).offset).toBe(-240)
  })

  it("produces different UTC instants for the same wall time in different zones", () => {
    const ny = generateOccurrences({ ...base, frequency: "ONE_TIME", timezone: "America/New_York" }, d("2026-03-01T00:00:00Z"), d("2026-03-31T00:00:00Z"))
    const la = generateOccurrences({ ...base, frequency: "ONE_TIME", timezone: "America/Los_Angeles" }, d("2026-03-01T00:00:00Z"), d("2026-03-31T00:00:00Z"))
    expect(ny[0].getTime()).not.toBe(la[0].getTime())
    // LA (further west) is 3 hours later in UTC for the same 09:00 local.
    expect(la[0].getTime() - ny[0].getTime()).toBe(3 * 60 * 60 * 1000)
  })
})
