import { DateTime } from "luxon"
import { orgDb } from "../org-db"

const OPEN_ISSUE = ["OPEN", "ACKNOWLEDGED"] as ("OPEN" | "ACKNOWLEDGED")[]
const ACTIVE_JOB = ["SCHEDULED", "ASSIGNED"] as ("SCHEDULED" | "ASSIGNED")[]

// Live operations screen (the dispatcher's all-day view): today's timeline, the
// week at a glance, and the exceptions that need action. Read-only aggregation.
export async function getOperations(orgId: string, tz: string, now: Date = new Date()) {
  const db = orgDb(orgId)
  const dt = DateTime.fromJSDate(now).setZone(tz)
  const dayStart = dt.startOf("day").toJSDate()
  const dayEnd = dt.endOf("day").toJSDate()
  const weekEnd = dt.startOf("day").plus({ days: 7 }).toJSDate()

  const [todayRows, weekRows, unassigned, understaffedRaw, overdueIssues, missedRaw, pendingApproval] = await Promise.all([
    db.job.findMany({
      where: { scheduledStart: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELLED" } },
      orderBy: { scheduledStart: "asc" },
      select: { id: true, title: true, status: true, scheduledStart: true, scheduledEnd: true, serviceLocation: { select: { name: true, customer: { select: { name: true } } } }, assignments: { select: { user: { select: { name: true } } } } },
    }),
    db.job.findMany({
      where: { scheduledStart: { gte: dayStart, lt: weekEnd }, status: { not: "CANCELLED" } },
      select: { scheduledStart: true, status: true },
    }),
    db.job.findMany({ where: { scheduledStart: { gte: dayStart, lte: dayEnd }, status: { in: ACTIVE_JOB }, assignments: { none: {} } }, take: 8, select: { id: true, title: true } }),
    db.job.findMany({ where: { scheduledStart: { gte: dayStart, lte: dayEnd }, status: { in: ACTIVE_JOB }, crewSize: { not: null } }, take: 30, select: { id: true, title: true, crewSize: true, _count: { select: { assignments: true } } } }),
    db.issue.findMany({ where: { status: { in: OPEN_ISSUE }, resolveDeadline: { lt: now } }, orderBy: { resolveDeadline: "asc" }, take: 8, select: { id: true, title: true, description: true } }),
    db.job.findMany({ where: { status: { in: ACTIVE_JOB }, scheduledStart: { lt: now }, timeEntries: { none: {} } }, orderBy: { scheduledStart: "asc" }, take: 8, select: { id: true, title: true } }),
    db.timeEntry.count({ where: { status: "COMPLETED" } }),
  ])

  const understaffed = understaffedRaw
    .filter((j) => j._count.assignments > 0 && j._count.assignments < j.crewSize!)
    .slice(0, 8)
    .map((j) => ({ id: j.id, title: j.title, have: j._count.assignments, need: j.crewSize! }))

  // Week at a glance: 7 day cells with job counts.
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = dt.startOf("day").plus({ days: i })
    const dayJobs = weekRows.filter((j) => DateTime.fromJSDate(j.scheduledStart).setZone(tz).hasSame(day, "day"))
    return {
      dateIso: day.toISODate()!,
      label: i === 0 ? "Today" : day.toFormat("ccc"),
      dayNum: day.toFormat("d"),
      count: dayJobs.length,
      completed: dayJobs.filter((j) => j.status === "COMPLETED").length,
      isToday: i === 0,
    }
  })

  return {
    nowIso: now.toISOString(),
    today: todayRows.map((j) => ({
      id: j.id, title: j.title, status: j.status,
      startIso: j.scheduledStart.toISOString(), endIso: j.scheduledEnd?.toISOString() ?? null,
      siteName: j.serviceLocation?.name ?? null, customerName: j.serviceLocation?.customer.name ?? null,
      crew: j.assignments.map((a) => a.user.name),
    })),
    week,
    exceptions: {
      unassigned: unassigned.map((j) => ({ id: j.id, title: j.title })),
      understaffed,
      overdueIssues: overdueIssues.map((i) => ({ id: i.id, title: i.title ?? i.description.slice(0, 50) })),
      missedClockIns: missedRaw.map((j) => ({ id: j.id, title: j.title })),
      pendingApproval,
    },
  }
}

// Operational supervisor dashboard metrics — "what needs attention today?".
// Deliberately operational, not executive BI.
export async function getDashboardMetrics(orgId: string, tz: string) {
  const db = orgDb(orgId)
  const now = DateTime.now().setZone(tz)
  const dayStart = now.startOf("day").toJSDate()
  const dayEnd = now.endOf("day").toJSDate()
  const weekAgo = now.minus({ days: 7 }).toJSDate()

  const todayJobs = await db.job.findMany({
    where: { scheduledStart: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELLED" } },
    select: { status: true, crewSize: true, _count: { select: { assignments: true } } },
  })

  const scheduledToday = todayJobs.filter((j) => j.status === "SCHEDULED" || j.status === "ASSIGNED").length
  const completedToday = todayJobs.filter((j) => j.status === "COMPLETED").length
  const unassigned = todayJobs.filter(
    (j) => j._count.assignments === 0 && (j.status === "SCHEDULED" || j.status === "ASSIGNED"),
  ).length
  const understaffed = todayJobs.filter(
    (j) =>
      j.crewSize != null &&
      j._count.assignments > 0 &&
      j._count.assignments < j.crewSize &&
      j.status !== "COMPLETED" &&
      j.status !== "MISSED",
  ).length

  const [inProgress, awaitingInspection, failedInspections, openIssues, pendingApproval] = await Promise.all([
    db.job.count({ where: { status: "IN_PROGRESS" } }),
    db.job.count({
      where: { status: "COMPLETED", actualEnd: { gte: weekAgo }, inspections: { none: { status: "FINALIZED" } } },
    }),
    db.inspection.count({ where: { outcome: "FAIL", finalizedAt: { gte: weekAgo } } }),
    db.issue.count({ where: { status: "OPEN" } }),
    db.timeEntry.count({ where: { status: "COMPLETED" } }),
  ])

  return {
    scheduledToday,
    inProgress,
    completedToday,
    unassigned,
    understaffed,
    awaitingInspection,
    failedInspections,
    openIssues,
    pendingApproval,
  }
}
