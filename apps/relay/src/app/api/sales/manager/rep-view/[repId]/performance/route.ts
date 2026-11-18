import { NextResponse } from "next/server"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ repId: string }> },
) {
  const { repId } = await params
  const view = await getManagerRepView(repId)
  if (!view) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const url = new URL(req.url)
  const rawPeriod = url.searchParams.get("period") ?? "30d"
  const period = ["today", "7d", "30d", "90d"].includes(rawPeriod) ? rawPeriod : "30d"

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let since: Date
  if (period === "today") {
    since = today
  } else {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90
    since = new Date(today)
    since.setDate(since.getDate() - days + 1)
  }

  const [dailyRows, oppsWon, oppsLost, openPipeline] = await Promise.all([
    prisma.salesDailyActivity.findMany({
      where: { salesUserId: repId, date: { gte: since } },
      select: {
        date: true, emailsSent: true, followUpsWorked: true,
        prospectsContacted: true, prospectsAdded: true,
        tasksCompleted: true, demosLogged: true, timeInAppMinutes: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.crmOpportunity.count({ where: { assignedToId: repId, wonAt: { gte: since } } }),
    prisma.crmOpportunity.count({ where: { assignedToId: repId, lostAt: { gte: since } } }),
    prisma.crmOpportunity.aggregate({
      where: { assignedToId: repId, wonAt: null, lostAt: null },
      _sum: { value: true },
      _count: { _all: true },
    }),
  ])

  const totals = dailyRows.reduce(
    (acc, r) => ({
      emailsSent:           acc.emailsSent           + r.emailsSent,
      followUpsWorked:      acc.followUpsWorked       + r.followUpsWorked,
      prospectsContacted:   acc.prospectsContacted    + r.prospectsContacted,
      prospectsAdded:       acc.prospectsAdded        + r.prospectsAdded,
      tasksCompleted:       acc.tasksCompleted        + r.tasksCompleted,
      demosLogged:          acc.demosLogged           + r.demosLogged,
      timeInAppMinutes:     acc.timeInAppMinutes      + r.timeInAppMinutes,
    }),
    { emailsSent: 0, followUpsWorked: 0, prospectsContacted: 0, prospectsAdded: 0, tasksCompleted: 0, demosLogged: 0, timeInAppMinutes: 0 },
  )

  return NextResponse.json({
    period,
    totals,
    oppsWon,
    oppsLost,
    openPipeline: { count: openPipeline._count._all, value: Number(openPipeline._sum.value ?? 0) },
    dailyRows,
  })
}
