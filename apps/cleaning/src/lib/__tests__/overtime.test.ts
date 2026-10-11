import { describe, it, expect } from "vitest"
import { computeOvertime, type OtEntry } from "../labor/overtime"

const TZ = "UTC"
const rules = { dailyThresholdHours: 8, weeklyThresholdHours: 40, multiplier: 1.5 }
// Monday 2026-06-01 .. in UTC.
const day = (d: number, h = 9) => new Date(Date.UTC(2026, 5, d, h, 0, 0))
const e = (id: string, userId: string, clockInAt: Date, hours: number): OtEntry => ({ id, userId, clockInAt, minutes: hours * 60 })

describe("computeOvertime", () => {
  it("no OT under both thresholds", () => {
    const r = computeOvertime([e("a", "u1", day(1), 6), e("b", "u1", day(2), 6)], rules, TZ)
    expect(r.byUser.get("u1")).toEqual({ regularMin: 720, otMin: 0 })
  })

  it("daily OT: a 10h day yields 2h OT", () => {
    const r = computeOvertime([e("a", "u1", day(1), 10)], rules, TZ)
    expect(r.byEntry.get("a")).toEqual({ regularMin: 8 * 60, otMin: 2 * 60 })
  })

  it("weekly OT: 5x9h = 45h → 5h OT (daily off)", () => {
    const wk = { dailyThresholdHours: null, weeklyThresholdHours: 40, multiplier: 1.5 }
    const entries = [1, 2, 3, 4, 5].map((d) => e(`d${d}`, "u1", day(d), 9))
    const r = computeOvertime(entries, wk, TZ)
    expect(r.byUser.get("u1")!.otMin).toBe(5 * 60)
  })

  it("no double-count: 5x10h with daily 8 + weekly 40 → OT is max, not sum", () => {
    // Daily OT = 5×2h = 10h; weekly OT = 50−40 = 10h. Combined (per-minute max) = 10h, not 20h.
    const entries = [1, 2, 3, 4, 5].map((d) => e(`d${d}`, "u1", day(d), 10))
    const r = computeOvertime(entries, rules, TZ)
    expect(r.byUser.get("u1")!.otMin).toBe(10 * 60)
    expect(r.byUser.get("u1")!.regularMin).toBe(40 * 60)
  })

  it("separates users and weeks", () => {
    const r = computeOvertime([e("a", "u1", day(1), 10), e("b", "u2", day(1), 4)], rules, TZ)
    expect(r.byUser.get("u1")!.otMin).toBe(120)
    expect(r.byUser.get("u2")!.otMin).toBe(0)
    expect(r.byUserWeek.find((w) => w.userId === "u1")!.otMin).toBe(120)
  })

  it("resets across weeks (next Monday is a fresh 40h)", () => {
    // 40h week 1 then 9h on the following Monday (day 8) → no weekly OT carried.
    const wk = { dailyThresholdHours: null, weeklyThresholdHours: 40, multiplier: 1.5 }
    const entries = [...[1, 2, 3, 4, 5].map((d) => e(`a${d}`, "u1", day(d), 8)), e("nextMon", "u1", day(8), 6)]
    const r = computeOvertime(entries, wk, TZ)
    expect(r.byUser.get("u1")!.otMin).toBe(0)
  })
})
