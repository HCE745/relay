import { orgDb } from "../org-db"
import {
  buildSummary,
  buildTrend,
  recentMonths,
  rate,
  type TaskTotals,
  type ResponsibilityRecord,
  type CorrectiveTotals,
  type PerformanceSummary,
  type TrendPoint,
} from "../performance/metrics"

// P4 Employee performance & accountability — data layer.
//
// Everything here is DERIVED on read from existing P1–P3 data; there is no new
// store. Fair-attribution rules live in ../performance/metrics (pure, tested):
// only SUBSTANTIATED complaints count, and shared responsibility is distinguished
// from individual. Org-scoped via orgDb; callers gate on workforce.performanceAnalytics.

const CORRECTIVE_DONE = ["RESOLVED", "VERIFIED"]
const TREND_MONTHS = 6

type UserRow = { id: string; name: string; role: string }

async function activeStaff(orgId: string): Promise<UserRow[]> {
  return orgDb(orgId).user.findMany({
    where: { isActive: true, role: { not: "CLIENT" } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  })
}

/** Raw per-user aggregates, computed with grouped counts (bounded by #users). */
async function rawAggregates(orgId: string) {
  const db = orgDb(orgId)
  const [assigned, completed, responsibilities, corrective] = await Promise.all([
    db.jobChecklistItem.groupBy({ by: ["assignedToId"], where: { assignedToId: { not: null } }, _count: { _all: true } }),
    db.jobChecklistItem.groupBy({ by: ["completedById", "verificationStatus"], where: { completedById: { not: null } }, _count: { _all: true } }),
    db.complaintResponsibility.findMany({ select: { userId: true, isPrimary: true, issue: { select: { outcome: true } } } }),
    db.workOrder.groupBy({ by: ["assignedToId", "status"], where: { isCorrective: true, assignedToId: { not: null } }, _count: { _all: true } }),
  ])
  return { assigned, completed, responsibilities, corrective }
}

type Raw = Awaited<ReturnType<typeof rawAggregates>>

function tasksFor(userId: string, raw: Raw): TaskTotals {
  const assigned = raw.assigned.find((a) => a.assignedToId === userId)?._count._all ?? 0
  const mine = raw.completed.filter((c) => c.completedById === userId)
  const completed = mine.reduce((n, c) => n + c._count._all, 0)
  const verified = mine.find((c) => c.verificationStatus === "VERIFIED")?._count._all ?? 0
  const rejected = mine.find((c) => c.verificationStatus === "REJECTED")?._count._all ?? 0
  return { assigned, completed, verified, rejected }
}

function responsibilitiesFor(userId: string, raw: Raw): ResponsibilityRecord[] {
  return raw.responsibilities
    .filter((r) => r.userId === userId)
    .map((r) => ({ outcome: r.issue?.outcome ?? null, isPrimary: r.isPrimary }))
}

function correctiveFor(userId: string, raw: Raw): CorrectiveTotals {
  const mine = raw.corrective.filter((c) => c.assignedToId === userId)
  const assigned = mine.reduce((n, c) => n + c._count._all, 0)
  const completed = mine.filter((c) => CORRECTIVE_DONE.includes(c.status)).reduce((n, c) => n + c._count._all, 0)
  return { assigned, completed }
}

function summaryFor(userId: string, raw: Raw): PerformanceSummary {
  return buildSummary({ tasks: tasksFor(userId, raw), responsibilities: responsibilitiesFor(userId, raw), corrective: correctiveFor(userId, raw) })
}

/** Month-bucketed completion/verification/rejection trend, optionally for one
 *  employee (completedById). Bounded by a cap; test/empty orgs return zeros. */
async function trend(orgId: string, userId?: string): Promise<TrendPoint[]> {
  const months = recentMonths(new Date(), TREND_MONTHS)
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (TREND_MONTHS - 1), 1))
  const rows = await orgDb(orgId).jobChecklistItem.findMany({
    where: {
      ...(userId ? { completedById: userId } : { completedById: { not: null } }),
      OR: [{ completedAt: { gte: since } }, { verifiedAt: { gte: since } }],
    },
    select: { completedAt: true, verifiedAt: true, verificationStatus: true },
    take: 5000,
  })
  const events = rows.flatMap((r) => {
    const e: { date: Date; kind: "completed" | "verified" | "rejected" }[] = []
    if (r.completedAt) e.push({ date: r.completedAt, kind: "completed" })
    if (r.verifiedAt && r.verificationStatus === "VERIFIED") e.push({ date: r.verifiedAt, kind: "verified" })
    if (r.verifiedAt && r.verificationStatus === "REJECTED") e.push({ date: r.verifiedAt, kind: "rejected" })
    return e
  })
  return buildTrend(events, months)
}

/** Management dashboard: per-employee summaries + org-wide roll-up + trend. */
export async function getTeamPerformance(orgId: string) {
  const [staff, raw, orgTrend] = await Promise.all([activeStaff(orgId), rawAggregates(orgId), trend(orgId)])
  const employees = staff
    .map((u) => ({ id: u.id, name: u.name, role: u.role, summary: summaryFor(u.id, raw) }))
    // Only show people who actually have task history, so the board stays signal.
    .filter((e) => e.summary.tasks.assigned > 0 || e.summary.tasks.completed > 0 || e.summary.corrective.assigned > 0 || e.summary.complaints.substantiated > 0)

  const totals = employees.reduce(
    (acc, e) => {
      acc.assigned += e.summary.tasks.assigned
      acc.completed += e.summary.tasks.completed
      acc.verified += e.summary.tasks.verified
      acc.rejected += e.summary.tasks.rejected
      acc.substantiated += e.summary.complaints.substantiated
      acc.corrective += e.summary.corrective.assigned
      return acc
    },
    { assigned: 0, completed: 0, verified: 0, rejected: 0, substantiated: 0, corrective: 0 },
  )
  const org = {
    completionRate: rate(totals.completed, totals.assigned),
    verificationPassRate: rate(totals.verified, totals.verified + totals.rejected),
    rework: totals.rejected,
    substantiatedComplaints: totals.substantiated,
    correctiveOpen: totals.corrective,
    employees: employees.length,
  }
  return { employees, org, trend: orgTrend }
}

/** One employee's full accountability history (management view). */
export async function getEmployeePerformance(orgId: string, userId: string) {
  const [raw, userTrend, user] = await Promise.all([
    rawAggregates(orgId),
    trend(orgId, userId),
    orgDb(orgId).user.findFirst({ where: { id: userId }, select: { id: true, name: true, role: true } }),
  ])
  if (!user) return null
  return { user, summary: summaryFor(userId, raw), trend: userTrend }
}

/**
 * Employee-facing OWN performance history. Privacy: a person sees only their own
 * record, and complaints appear only as a SUBSTANTIATED count (never allegations,
 * complaint text, customer detail, or who reported it). Reuses the same derivation.
 */
export async function getMyPerformance(orgId: string, userId: string) {
  const [raw, myTrend] = await Promise.all([rawAggregates(orgId), trend(orgId, userId)])
  const summary = summaryFor(userId, raw)
  return {
    tasks: summary.tasks,
    completionRate: summary.completionRate,
    verificationPassRate: summary.verificationPassRate,
    rework: summary.rework,
    substantiatedFindings: summary.complaints.substantiated, // count only — no detail
    corrective: summary.corrective,
    trend: myTrend,
  }
}
