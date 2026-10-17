import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ManagerTabs } from "../ManagerTabs"
import { ActivityTable } from "./ActivityTable"

export const dynamic = "force-dynamic"

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const session = await getSession()
  if (!session?.superAdmin && session?.salesUserRole !== "admin_sales") redirect("/sales")

  const params = await searchParams
  const period = params.period ?? "week"

  const now = new Date()
  let dateFrom: Date
  let dateTo: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  if (period === "today") {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (period === "month") {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (period === "30days") {
    dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    dateFrom = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate())
  } else if (period === "custom" && params.from && params.to) {
    dateFrom = new Date(params.from)
    dateTo = new Date(params.to)
    dateTo.setHours(23, 59, 59)
  } else {
    // This week (Mon–Sun)
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1
    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow)
  }

  const salesUsers = await prisma.salesUser.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  })

  const [dailyActivities, sessions] = await Promise.all([
    prisma.salesDailyActivity.findMany({
      where: {
        date: { gte: dateFrom, lte: dateTo },
      },
      orderBy: [{ salesUserId: "asc" }, { date: "asc" }],
    }),
    prisma.salesSession.findMany({
      where: {
        loginAt: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { loginAt: "desc" },
      take: 500,
      select: {
        id: true,
        salesUserId: true,
        loginAt: true,
        logoutAt: true,
        durationMinutes: true,
        lastActivityAt: true,
        pagesVisited: true,
      },
    }),
  ])

  // Build per-rep summaries
  const repSummaries = salesUsers.map(u => {
    const myActivity = dailyActivities.filter(a => a.salesUserId === u.id)
    const mySessions = sessions.filter(s => s.salesUserId === u.id)

    const totalEmailsSent         = myActivity.reduce((s, a) => s + a.emailsSent, 0)
    const totalFollowUpsWorked    = myActivity.reduce((s, a) => s + a.followUpsWorked, 0)
    const totalProspectsContacted = myActivity.reduce((s, a) => s + a.prospectsContacted, 0)
    const totalProspectsAdded     = myActivity.reduce((s, a) => s + a.prospectsAdded, 0)
    const totalOppsUpdated        = myActivity.reduce((s, a) => s + a.opportunitiesUpdated, 0)
    const totalTasksCompleted     = myActivity.reduce((s, a) => s + a.tasksCompleted, 0)
    const totalTimeInApp          = myActivity.reduce((s, a) => s + a.timeInAppMinutes, 0)

    const firstActivityTimes = myActivity
      .map(a => a.firstActivityAt)
      .filter(Boolean) as Date[]
    const lastActivityTimes = myActivity
      .map(a => a.lastActivityAt)
      .filter(Boolean) as Date[]

    const avgStartHour = firstActivityTimes.length > 0
      ? firstActivityTimes.reduce((s, d) => s + d.getHours() + d.getMinutes() / 60, 0) / firstActivityTimes.length
      : null
    const avgEndHour = lastActivityTimes.length > 0
      ? lastActivityTimes.reduce((s, d) => s + d.getHours() + d.getMinutes() / 60, 0) / lastActivityTimes.length
      : null

    const daysActive = myActivity.filter(a =>
      a.emailsSent + a.followUpsWorked + a.prospectsContacted +
      a.prospectsAdded + a.opportunitiesUpdated + a.tasksCompleted > 0
    ).length

    const longestSession = mySessions.reduce((max, s) => {
      const dur = s.durationMinutes ?? (s.logoutAt
        ? Math.round((s.logoutAt.getTime() - s.loginAt.getTime()) / 60000)
        : Math.round((Date.now() - s.loginAt.getTime()) / 60000))
      return dur > max ? dur : max
    }, 0)

    // Most productive day
    const bestDay = myActivity.reduce((best, a) => {
      const score = a.emailsSent + a.followUpsWorked + a.prospectsContacted +
                    a.prospectsAdded + a.opportunitiesUpdated + a.tasksCompleted
      return score > (best?.score ?? 0) ? { date: a.date, score } : best
    }, null as { date: Date; score: number } | null)

    return {
      user: u,
      dailyActivity: myActivity,
      sessions: mySessions,
      totals: {
        emailsSent: totalEmailsSent,
        followUpsWorked: totalFollowUpsWorked,
        prospectsContacted: totalProspectsContacted,
        prospectsAdded: totalProspectsAdded,
        opportunitiesUpdated: totalOppsUpdated,
        tasksCompleted: totalTasksCompleted,
        timeInAppMinutes: totalTimeInApp,
      },
      insights: {
        daysActive,
        avgStartHour,
        avgEndHour,
        longestSession,
        bestDay,
        avgDailyHours: daysActive > 0 ? totalTimeInApp / daysActive / 60 : 0,
      },
    }
  })

  return (
    <div className="p-6 max-w-6xl">
      <ManagerTabs />
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Time & Activity</h1>
          <p className="text-sm text-gray-400 mt-0.5">Session and activity data for your team</p>
        </div>
      </div>

      <ActivityTable
        repSummaries={repSummaries}
        period={period}
        dateFrom={dateFrom.toISOString()}
        dateTo={dateTo.toISOString()}
        customFrom={params.from}
        customTo={params.to}
      />
    </div>
  )
}
