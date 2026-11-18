import { redirect } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"
import { Briefcase, CheckCircle2, Mail, TrendingUp, Calendar, Clock } from "lucide-react"

export const dynamic = "force-dynamic"

function fmtMoney(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

export default async function RepViewOverviewPage({
  params,
}: {
  params: Promise<{ repId: string }>
}) {
  const { repId } = await params
  const view = await getManagerRepView(repId)
  if (!view) redirect("/sales/manager/rep-view")

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000)

  const [openOpps, wonOpps, tasks, recentActivity, dailyActivity] = await Promise.all([
    prisma.crmOpportunity.findMany({
      where: { assignedToId: repId, wonAt: null, lostAt: null },
      select: { value: true, stage: true },
    }),

    prisma.crmOpportunity.findMany({
      where: { assignedToId: repId, wonAt: { gte: thirtyDaysAgo } },
      select: { value: true },
    }),

    prisma.crmTask.aggregate({
      where: { assignedToId: repId },
      _count: { _all: true },
      // completed last 7 days
    }),

    prisma.salesCrmActivity.findMany({
      where: { salesUserId: repId, occurredAt: { gte: sevenDaysAgo } },
      select: { activityType: true, occurredAt: true },
      orderBy: { occurredAt: "desc" },
      take: 10,
    }),

    prisma.salesDailyActivity.findFirst({
      where: { salesUserId: repId },
      orderBy: { date: "desc" },
      select: {
        date: true,
        emailsSent: true,
        followUpsWorked: true,
        prospectsContacted: true,
        timeInAppMinutes: true,
      },
    }),
  ])

  const openPipeline = openOpps.reduce((s, o) => s + Number(o.value ?? 0), 0)
  const wonRevenue   = wonOpps.reduce((s, o) => s + Number(o.value ?? 0), 0)

  const stats = [
    { label: "Open Pipeline",   value: fmtMoney(openPipeline), icon: TrendingUp,   color: "text-emerald-400" },
    { label: "Won (30d)",       value: fmtMoney(wonRevenue),   icon: CheckCircle2, color: "text-blue-400" },
    { label: "Open Opps",       value: String(openOpps.length), icon: Briefcase,   color: "text-purple-400" },
    { label: "Emails Sent (today)", value: String(dailyActivity?.emailsSent ?? 0), icon: Mail, color: "text-amber-400" },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-gray-500 font-medium">{s.label}</span>
            </div>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Today's activity */}
      {dailyActivity && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-white">Today&apos;s Activity</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs mb-0.5">Emails Sent</p>
              <p className="text-white font-medium">{dailyActivity.emailsSent}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-0.5">Prospects Contacted</p>
              <p className="text-white font-medium">{dailyActivity.prospectsContacted}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-0.5">Follow-Ups Worked</p>
              <p className="text-white font-medium">{dailyActivity.followUpsWorked}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Time in App
                </span>
              </p>
              <p className="text-white font-medium">{dailyActivity.timeInAppMinutes}m</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent CRM events */}
      {recentActivity.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4">
          <h2 className="text-sm font-semibold text-white mb-3">Recent Activity (7 days)</h2>
          <div className="space-y-2">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-xs text-gray-500 w-32 shrink-0">
                  {new Date(a.occurredAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-gray-300">{a.activityType.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
