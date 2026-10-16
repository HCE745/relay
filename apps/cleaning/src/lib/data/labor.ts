import { DateTime } from "luxon"
import { orgDb } from "../org-db"
import { getOrgTimezone, getOvertimeRules } from "./org"
import { type Money, ZERO, billableMinutes } from "../billing-math"
import { Prisma } from "../../generated/prisma/client"
import { computeOvertime, hoursFromMin } from "../labor/overtime"

// Period overtime per employee (Phase 24). Computes OT HOURS from APPROVED time
// against the org rules, plus the OT premium cost (HOURLY only — salary time is
// never costed, matching profitability). Powers the time screen, payroll export,
// the dashboard warning, and the profitability OT premium. NOT payroll.

export type PeriodOvertime = {
  rules: { dailyThresholdHours: number | null; weeklyThresholdHours: number | null; multiplier: number }
  byUser: { userId: string; name: string; regularHours: number; otHours: number; premium: Money | null }[]
  totalOtHours: number
  totalPremium: Money
}

export async function getPeriodOvertime(orgId: string, window: { start: Date; end: Date }): Promise<PeriodOvertime> {
  const [tz, rules] = await Promise.all([getOrgTimezone(orgId), getOvertimeRules(orgId)])
  const entries = await orgDb(orgId).timeEntry.findMany({
    where: { status: "APPROVED", clockInAt: { gte: window.start, lte: window.end } },
    select: {
      id: true, userId: true, clockInAt: true, clockOutAt: true, breakMinutes: true,
      approvedPayRate: true, approvedPayType: true,
      user: { select: { name: true, employeeProfile: { select: { payRate: true, payType: true } } } },
    },
  })

  const ot = computeOvertime(
    entries.map((e) => ({ id: e.id, userId: e.userId, clockInAt: e.clockInAt, minutes: billableMinutes(e) })),
    rules, tz,
  )

  const meta = new Map(entries.map((e) => [e.userId, {
    name: e.user.name,
    rate: (e.approvedPayRate ?? e.user.employeeProfile?.payRate ?? null) as Money | null,
    type: e.approvedPayType ?? e.user.employeeProfile?.payType ?? null,
  }]))

  const mult = new Prisma.Decimal(rules.multiplier)
  const premiumFactor = mult.minus(1) // the EXTRA paid per OT hour vs regular
  let totalOtHours = 0
  let totalPremium = ZERO
  const byUser = [...ot.byUser.entries()].map(([userId, split]) => {
    const m = meta.get(userId)
    const otHours = hoursFromMin(split.otMin)
    totalOtHours += otHours
    let premium: Money | null = null
    if (m && m.type === "HOURLY" && m.rate) {
      premium = m.rate.times(premiumFactor).times(new Prisma.Decimal(split.otMin).dividedBy(60))
      totalPremium = totalPremium.plus(premium)
    }
    return { userId, name: m?.name ?? "-", regularHours: hoursFromMin(split.regularMin), otHours, premium }
  }).filter((r) => r.otHours > 0 || r.regularHours > 0)
    .sort((a, b) => b.otHours - a.otHours)

  return { rules, byUser, totalOtHours, totalPremium }
}

/** Count employees at ≥90% of the weekly OT threshold THIS week (dashboard warning). */
export async function countApproachingOvertime(orgId: string): Promise<number> {
  const [rules, tz] = await Promise.all([getOvertimeRules(orgId), getOrgTimezone(orgId)])
  if (!rules.weeklyThresholdHours) return 0
  const weekStart = DateTime.now().setZone(tz).startOf("week").toJSDate()
  const ot = await getPeriodOvertime(orgId, { start: weekStart, end: new Date() })
  const near = rules.weeklyThresholdHours * 0.9
  return ot.byUser.filter((u) => u.regularHours + u.otHours >= near).length
}
