import { DateTime } from "luxon"
import { orgDb } from "../org-db"

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
