import { describe, it, expect } from "vitest"
import { periodsInWindow, periodForInstant } from "../billing-periods"

const TZ = "America/New_York"

describe("periodsInWindow — MONTHLY", () => {
  it("returns the single month for a within-month window", () => {
    const ps = periodsInWindow("MONTHLY", "2026-03-01", "2026-03-31", TZ)
    expect(ps.map((p) => p.key)).toEqual(["M:2026-03"])
    expect(ps[0].label).toBe("March 2026")
    expect(ps[0].startISO).toBe("2026-03-01")
    expect(ps[0].endISO).toBe("2026-03-31")
  })
  it("enumerates every month a multi-month window overlaps, inclusive of partial months", () => {
    const ps = periodsInWindow("MONTHLY", "2026-02-15", "2026-04-10", TZ)
    expect(ps.map((p) => p.key)).toEqual(["M:2026-02", "M:2026-03", "M:2026-04"])
  })
  it("crosses a year boundary", () => {
    const ps = periodsInWindow("MONTHLY", "2026-12-20", "2027-01-05", TZ)
    expect(ps.map((p) => p.key)).toEqual(["M:2026-12", "M:2027-01"])
  })
})

describe("periodsInWindow — QUARTERLY", () => {
  it("returns the quarter containing the window", () => {
    const ps = periodsInWindow("QUARTERLY", "2026-02-01", "2026-02-28", TZ)
    expect(ps.map((p) => p.key)).toEqual(["Q:2026-Q1"])
    expect(ps[0].label).toBe("Q1 2026")
    expect(ps[0].startISO).toBe("2026-01-01")
    expect(ps[0].endISO).toBe("2026-03-31")
  })
  it("spans two quarters", () => {
    const ps = periodsInWindow("QUARTERLY", "2026-03-15", "2026-04-15", TZ)
    expect(ps.map((p) => p.key)).toEqual(["Q:2026-Q1", "Q:2026-Q2"])
  })
})

describe("periodsInWindow — edge cases", () => {
  it("is empty for an inverted window", () => {
    expect(periodsInWindow("MONTHLY", "2026-04-01", "2026-03-01", TZ)).toEqual([])
  })
  it("period end is the local end-of-day instant (for ended-yet checks)", () => {
    const [p] = periodsInWindow("MONTHLY", "2026-03-10", "2026-03-10", TZ)
    // 2026-03-31 23:59:59 America/New_York = 2026-04-01T03:59:59Z (EDT, -04:00)
    expect(p.end.toISOString().startsWith("2026-04-01T03:59:59")).toBe(true)
  })
})

describe("periodForInstant", () => {
  it("maps an instant to its site-local month", () => {
    // 2026-03-01T02:00:00Z is still Feb 28 21:00 in New York.
    const p = periodForInstant("MONTHLY", new Date("2026-03-01T02:00:00.000Z"), TZ)
    expect(p.key).toBe("M:2026-02")
  })
  it("maps an instant to its quarter", () => {
    const p = periodForInstant("QUARTERLY", new Date("2026-08-15T12:00:00.000Z"), TZ)
    expect(p.key).toBe("Q:2026-Q3")
  })
})
