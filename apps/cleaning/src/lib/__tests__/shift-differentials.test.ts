import { describe, it, expect } from "vitest"
import { dec } from "../billing-math"
import { windowOverlapMinutes, computeDifferential, applyBurden, type DifferentialRule } from "../shift-differentials"

const night: DifferentialRule = { startMinute: 22 * 60, endMinute: 6 * 60, daysOfWeek: [], amountType: "PERCENT", value: dec("10") }

describe("windowOverlapMinutes", () => {
  it("counts the night-window portion of a shift that crosses midnight", () => {
    // 20:00 → 02:00 UTC against a 22:00–06:00 window = 4h in-window.
    const inAt = new Date("2026-06-01T20:00:00.000Z")
    const outAt = new Date("2026-06-02T02:00:00.000Z")
    expect(windowOverlapMinutes(inAt, outAt, "UTC", night)).toBe(240)
  })
  it("is 0 when the shift is fully outside the window", () => {
    const inAt = new Date("2026-06-01T08:00:00.000Z")
    const outAt = new Date("2026-06-01T16:00:00.000Z")
    expect(windowOverlapMinutes(inAt, outAt, "UTC", night)).toBe(0)
  })
  it("respects a weekend-only day filter", () => {
    const weekend: DifferentialRule = { startMinute: 0, endMinute: 24 * 60 - 1, daysOfWeek: [0, 6], amountType: "FLAT_PER_HOUR", value: dec("2") }
    // 2026-08-01 is a Saturday.
    const sat = windowOverlapMinutes(new Date("2026-08-01T10:00:00.000Z"), new Date("2026-08-01T14:00:00.000Z"), "UTC", weekend)
    const mon = windowOverlapMinutes(new Date("2026-08-03T10:00:00.000Z"), new Date("2026-08-03T14:00:00.000Z"), "UTC", weekend)
    expect(sat).toBe(240)
    expect(mon).toBe(0)
  })
})

describe("computeDifferential", () => {
  const entry = { clockInAt: new Date("2026-06-01T20:00:00.000Z"), clockOutAt: new Date("2026-06-02T02:00:00.000Z"), breakMinutes: 0 }
  it("PERCENT premium = eligibleHours × rate × pct", () => {
    // 4h × $20 × 10% = $8.00
    const r = computeDifferential(entry, dec("20"), "UTC", [{ ...night, name: "Night" }])
    expect(r.amount.toFixed(2)).toBe("8.00")
    expect(r.note).toContain("Night")
  })
  it("FLAT premium = eligibleHours × $/hr", () => {
    const flat: DifferentialRule & { name: string } = { name: "Night flat", startMinute: 22 * 60, endMinute: 6 * 60, daysOfWeek: [], amountType: "FLAT_PER_HOUR", value: dec("3") }
    const r = computeDifferential(entry, dec("20"), "UTC", [flat])
    expect(r.amount.toFixed(2)).toBe("12.00") // 4h × $3
  })
  it("prorates the premium for breaks", () => {
    // 6h gross, 1h break → billable 5h; a window covering the whole shift gives
    // eligible = 360 × (300/360) = 300 min = 5h; $2/hr flat → $10.00.
    const allDay: DifferentialRule & { name: string } = { name: "All", startMinute: 0, endMinute: 24 * 60 - 1, daysOfWeek: [], amountType: "FLAT_PER_HOUR", value: dec("2") }
    const e = { clockInAt: new Date("2026-06-01T08:00:00.000Z"), clockOutAt: new Date("2026-06-01T14:00:00.000Z"), breakMinutes: 60 }
    expect(computeDifferential(e, dec("20"), "UTC", [allDay]).amount.toFixed(2)).toBe("10.00")
  })
  it("PERCENT with no base rate contributes nothing", () => {
    expect(computeDifferential(entry, null, "UTC", [{ ...night, name: "Night" }]).amount.toFixed(2)).toBe("0.00")
  })
})

describe("applyBurden", () => {
  it("loads the burden fraction onto labor", () => {
    expect(applyBurden(dec("100"), dec("0.25")).toFixed(2)).toBe("125.00")
  })
  it("is a no-op at 0", () => {
    expect(applyBurden(dec("100"), dec("0")).toFixed(2)).toBe("100.00")
  })
})
