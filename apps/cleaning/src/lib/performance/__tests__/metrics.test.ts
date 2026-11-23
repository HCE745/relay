import { describe, it, expect } from "vitest"
import {
  rate,
  completionRate,
  verificationPassRate,
  attributeComplaints,
  buildSummary,
  monthKey,
  recentMonths,
  buildTrend,
  type ResponsibilityRecord,
} from "../metrics"

describe("rates", () => {
  it("rounds to one decimal and is zero-safe", () => {
    expect(rate(1, 3)).toBe(33.3)
    expect(rate(0, 0)).toBe(0)
    expect(rate(5, 0)).toBe(0)
    expect(rate(3, 4)).toBe(75)
  })
  it("completion and verification-pass rates", () => {
    expect(completionRate({ assigned: 10, completed: 8, verified: 6, rejected: 2 })).toBe(80)
    // pass rate is over REVIEWED work only (verified + rejected), not all completed.
    expect(verificationPassRate({ assigned: 10, completed: 8, verified: 6, rejected: 2 })).toBe(75)
    expect(verificationPassRate({ assigned: 0, completed: 0, verified: 0, rejected: 0 })).toBe(0)
  })
})

describe("fair attribution of complaints", () => {
  const rows: ResponsibilityRecord[] = [
    { outcome: "SUBSTANTIATED", isPrimary: true },
    { outcome: "SUBSTANTIATED", isPrimary: false },
    { outcome: "UNSUBSTANTIATED", isPrimary: true },
    { outcome: "INCONCLUSIVE", isPrimary: true },
    { outcome: null, isPrimary: true }, // un-investigated allegation
  ]

  it("counts ONLY substantiated, split into individual vs shared", () => {
    expect(attributeComplaints(rows)).toEqual({ substantiated: 2, individual: 1, shared: 1 })
  })

  it("never counts allegations, unsubstantiated, or inconclusive", () => {
    expect(attributeComplaints([
      { outcome: null, isPrimary: true },
      { outcome: "UNSUBSTANTIATED", isPrimary: false },
      { outcome: "INCONCLUSIVE", isPrimary: true },
    ])).toEqual({ substantiated: 0, individual: 0, shared: 0 })
  })

  it("a shared substantiated complaint is NOT individual fault", () => {
    const r = attributeComplaints([{ outcome: "SUBSTANTIATED", isPrimary: false }])
    expect(r.individual).toBe(0)
    expect(r.shared).toBe(1)
  })
})

describe("summary", () => {
  it("assembles the derived performance view", () => {
    const s = buildSummary({
      tasks: { assigned: 20, completed: 18, verified: 15, rejected: 3 },
      responsibilities: [
        { outcome: "SUBSTANTIATED", isPrimary: true },
        { outcome: null, isPrimary: true },
      ],
      corrective: { assigned: 2, completed: 1 },
    })
    expect(s.completionRate).toBe(90)
    expect(s.verificationPassRate).toBe(83.3)
    expect(s.rework).toBe(3)
    expect(s.complaints).toEqual({ substantiated: 1, individual: 1, shared: 0 })
    expect(s.corrective).toEqual({ assigned: 2, completed: 1 })
  })
})

describe("trends", () => {
  it("builds ordered month keys ending at `end`", () => {
    expect(recentMonths(new Date(Date.UTC(2026, 10, 15)), 3)).toEqual(["2026-09", "2026-10", "2026-11"])
    expect(monthKey(new Date(Date.UTC(2026, 0, 2)))).toBe("2026-01")
  })
  it("buckets events into the window and ignores those outside it", () => {
    const months = recentMonths(new Date(Date.UTC(2026, 10, 1)), 2) // ["2026-10","2026-11"]
    const pts = buildTrend(
      [
        { date: new Date(Date.UTC(2026, 9, 5)), kind: "completed" },
        { date: new Date(Date.UTC(2026, 10, 7)), kind: "completed" },
        { date: new Date(Date.UTC(2026, 10, 8)), kind: "rejected" },
        { date: new Date(Date.UTC(2026, 5, 1)), kind: "completed" }, // out of window → ignored
      ],
      months,
    )
    expect(pts).toEqual([
      { period: "2026-10", completed: 1, verified: 0, rejected: 0 },
      { period: "2026-11", completed: 1, verified: 0, rejected: 1 },
    ])
  })
})
