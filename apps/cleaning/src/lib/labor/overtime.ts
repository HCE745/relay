import { DateTime } from "luxon"

// Overtime computation (Phase 24). Pure + deterministic. Boundary: this computes
// OT HOURS from approved time against org rules — it is NOT payroll processing.
//
// Model (documented, simplified — not a full state-by-state payroll engine) with
// NO pyramiding: within a business-tz day, minutes beyond the daily threshold are
// daily OT; only STRAIGHT-TIME minutes (≤ daily threshold) count toward the
// weekly total, and straight-time minutes beyond the weekly threshold are weekly
// OT. So a 10h day under daily=8/weekly=40 is 2h daily OT, and those OT hours
// never also count as weekly OT (the classic California-style rule).

export type OvertimeRules = { dailyThresholdHours: number | null; weeklyThresholdHours: number | null; multiplier: number }
export type OtEntry = { id: string; userId: string; clockInAt: Date; minutes: number }

export type OvertimeResult = {
  byEntry: Map<string, { regularMin: number; otMin: number }>
  byUser: Map<string, { regularMin: number; otMin: number }>
  byUserWeek: { userId: string; weekKey: string; totalMin: number; otMin: number }[]
}

const H = 60

export function computeOvertime(entries: OtEntry[], rules: OvertimeRules, tz: string): OvertimeResult {
  const dailyMin = rules.dailyThresholdHours != null ? rules.dailyThresholdHours * H : Infinity
  const weeklyMin = rules.weeklyThresholdHours != null ? rules.weeklyThresholdHours * H : Infinity

  const byEntry = new Map<string, { regularMin: number; otMin: number }>()
  const byUser = new Map<string, { regularMin: number; otMin: number }>()
  const weekAgg = new Map<string, { userId: string; weekKey: string; totalMin: number; otMin: number }>()

  // Per-user chronological processing.
  const byUserEntries = new Map<string, OtEntry[]>()
  for (const e of entries) (byUserEntries.get(e.userId) ?? byUserEntries.set(e.userId, []).get(e.userId)!).push(e)

  for (const [userId, list] of byUserEntries) {
    list.sort((a, b) => a.clockInAt.getTime() - b.clockInAt.getTime())
    const weekStraight = new Map<string, number>() // straight-time minutes so far this week
    const dayTotal = new Map<string, number>() // total minutes so far this day
    for (const e of list) {
      const dt = DateTime.fromJSDate(e.clockInAt, { zone: tz })
      const weekKey = dt.startOf("week").toISODate() ?? "?"
      const dayKey = dt.toISODate() ?? "?"
      const m = e.minutes
      // 1) Split the entry into daily-straight vs daily-OT.
      const dBefore = dayTotal.get(dayKey) ?? 0
      const dStraightBefore = Math.min(dBefore, dailyMin)
      const dStraightAfter = Math.min(dBefore + m, dailyMin)
      const entryStraightDay = dStraightAfter - dStraightBefore
      const dailyOt = m - entryStraightDay
      // 2) Of the daily-straight minutes, those beyond the weekly cap are weekly OT.
      const wBefore = weekStraight.get(weekKey) ?? 0
      const wAllowedBefore = Math.min(wBefore, weeklyMin)
      const wAllowedAfter = Math.min(wBefore + entryStraightDay, weeklyMin)
      const entryRegular = wAllowedAfter - wAllowedBefore
      const weeklyOt = entryStraightDay - entryRegular
      const otMin = dailyOt + weeklyOt
      byEntry.set(e.id, { regularMin: entryRegular, otMin })
      dayTotal.set(dayKey, dBefore + m)
      weekStraight.set(weekKey, wBefore + entryStraightDay)
      const u = byUser.get(userId) ?? { regularMin: 0, otMin: 0 }
      u.regularMin += m - otMin; u.otMin += otMin; byUser.set(userId, u)
      const wk = weekAgg.get(`${userId}:${weekKey}`) ?? { userId, weekKey, totalMin: 0, otMin: 0 }
      wk.totalMin += m; wk.otMin += otMin; weekAgg.set(`${userId}:${weekKey}`, wk)
    }
  }
  return { byEntry, byUser, byUserWeek: [...weekAgg.values()] }
}

export const hoursFromMin = (min: number) => Math.round((min / 60) * 100) / 100
