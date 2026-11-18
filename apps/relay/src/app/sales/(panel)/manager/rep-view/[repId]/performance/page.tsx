import { redirect } from "next/navigation"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { TrendingUp, Mail, Phone, Users, Briefcase, CheckSquare, Clock, DollarSign, Calendar } from "lucide-react"

export const dynamic = "force-dynamic"

type Period = "today" | "7d" | "30d" | "90d"

function periodStart(period: Period): Date {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === "today") return today
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90
  const d = new Date(today)
  d.setDate(d.getDate() - days + 1)
  return d
}

function fmtMoney(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function fmtMins(mins: number) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default async function RepViewPerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ repId: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const { repId } = await params
  const rawPeriod = (await searchParams).period ?? "30d"
  const period: Period = ["today", "7d", "30d", "90d"].includes(rawPeriod)
    ? (rawPeriod as Period)
    : "30d"

  const view = await getManagerRepView(repId)
  if (!view) redirect("/sales/manager/rep-view")

  const since = periodStart(period)
  const basePath = `/sales/manager/rep-view/${repId}`

  const [
    dailyRows,
    crmActivityRows,
    oppsCreated,
    oppsWon,
    oppsLost,
    openPipeline,
    emailsSentCount,
    emailsReceivedCount,
  ] = await Promise.all([
    // SalesDailyActivity — primary activity metrics, server-recorded
    prisma.salesDailyActivity.findMany({
      where: { salesUserId: repId, date: { gte: since } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        emailsSent: true,
        followUpsWorked: true,
        prospectsContacted: true,
        prospectsAdded: true,
        opportunitiesUpdated: true,
        tasksCompleted: true,
        demosLogged: true,
        timeInAppMinutes: true,
      },
    }),

    // SalesCrmActivity — event-level detail for calls and meetings
    prisma.salesCrmActivity.groupBy({
      by: ["activityType"],
      where: { salesUserId: repId, occurredAt: { gte: since } },
      _count: { _all: true },
    }),

    // Opportunities created in period
    prisma.crmOpportunity.count({
      where: { assignedToId: repId, createdAt: { gte: since } },
    }),

    // Opportunities won in period
    prisma.crmOpportunity.findMany({
      where: { assignedToId: repId, wonAt: { gte: since } },
      select: { id: true, title: true, value: true, wonAt: true, prospect: { select: { companyName: true } } },
    }),

    // Opportunities lost in period
    prisma.crmOpportunity.findMany({
      where: { assignedToId: repId, lostAt: { gte: since } },
      select: { id: true, title: true, lostAt: true, prospect: { select: { companyName: true } } },
    }),

    // Current open pipeline (snapshot, not period-bound)
    prisma.crmOpportunity.aggregate({
      where: { assignedToId: repId, wonAt: null, lostAt: null },
      _sum: { value: true },
      _count: { _all: true },
    }),

    // Emails sent (from CrmEmail — most accurate outbound count)
    prisma.crmEmail.count({
      where: { sentBySalesUserId: repId, direction: "sent", sentAt: { gte: since } },
    }),

    // Emails received — only messages that have an in-reply-to header (actual replies to outreach)
    prisma.crmEmail.count({
      where: { mailboxOwnerSalesUserId: repId, direction: "received", inReplyTo: { not: null }, sentAt: { gte: since } },
    }),
  ])

  // --- Aggregates from daily rows ---
  const totalFollowUpsWorked    = dailyRows.reduce((s, r) => s + r.followUpsWorked, 0)
  const totalProspectsContacted = dailyRows.reduce((s, r) => s + r.prospectsContacted, 0)
  const totalProspectsAdded     = dailyRows.reduce((s, r) => s + r.prospectsAdded, 0)
  const totalOppsUpdated        = dailyRows.reduce((s, r) => s + r.opportunitiesUpdated, 0)
  const totalTasksCompleted     = dailyRows.reduce((s, r) => s + r.tasksCompleted, 0)
  const totalDemosLogged        = dailyRows.reduce((s, r) => s + r.demosLogged, 0)
  const totalTimeInApp          = dailyRows.reduce((s, r) => s + r.timeInAppMinutes, 0)

  // --- CRM activity type counts ---
  const actMap: Record<string, number> = {}
  crmActivityRows.forEach(r => { actMap[r.activityType] = r._count._all })
  const callsAttempted = actMap["CALL_ATTEMPTED"] ?? 0
  const callsConnected = actMap["CALL_CONNECTED"] ?? 0

  // --- Won value ---
  const wonValue = oppsWon.reduce((s, o) => s + Number(o.value ?? 0), 0)

  // --- Pipeline ---
  const pipelineValue = Number(openPipeline._sum.value ?? 0)
  const pipelineCount = openPipeline._count._all

  const PERIOD_LABELS: Record<Period, string> = {
    today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days",
  }

  const statGroups = [
    {
      label: "Outreach",
      icon: Mail,
      iconColor: "text-blue-400",
      stats: [
        { label: "Emails Sent",          value: emailsSentCount,           note: "from CrmEmail records",    link: null },
        { label: "Replies Received",      value: emailsReceivedCount,       note: "inbound with reply-to header", link: null },
        { label: "Prospects Contacted",   value: totalProspectsContacted,   note: "from activity log",        link: `${basePath}/prospects` },
        { label: "Prospects Added",       value: totalProspectsAdded,       note: "new records created",      link: `${basePath}/prospects` },
      ],
    },
    {
      label: "Calls & Meetings",
      icon: Phone,
      iconColor: "text-purple-400",
      stats: [
        { label: "Calls Attempted",       value: callsAttempted,            note: "from CRM events",          link: null },
        { label: "Calls Connected",       value: callsConnected,            note: "from CRM events",          link: null },
        { label: "Meetings / Demos",      value: totalDemosLogged,               note: "MEETING_HELD events (activity log)", link: null },
      ],
    },
    {
      label: "Tasks & Follow-Ups",
      icon: CheckSquare,
      iconColor: "text-teal-400",
      stats: [
        { label: "Tasks Completed",       value: totalTasksCompleted,       note: "from activity log",        link: `${basePath}/follow-ups?filter=done` },
        { label: "Follow-Ups Worked",     value: totalFollowUpsWorked,      note: "from activity log",        link: `${basePath}/follow-ups` },
      ],
    },
    {
      label: "Pipeline",
      icon: Briefcase,
      iconColor: "text-emerald-400",
      stats: [
        { label: "Opps Created",          value: oppsCreated,               note: "in period",                link: `${basePath}/opportunities` },
        { label: "Opps Updated",          value: totalOppsUpdated,          note: "from activity log",        link: `${basePath}/opportunities` },
        { label: "Deals Won",             value: oppsWon.length,            note: "in period",                link: `${basePath}/opportunities` },
        { label: "Deals Lost",            value: oppsLost.length,           note: "in period",                link: `${basePath}/opportunities` },
        { label: "Won Value",             value: fmtMoney(wonValue),        note: "closed-won in period",     link: `${basePath}/pipeline` },
        { label: "Open Pipeline",         value: fmtMoney(pipelineValue),   note: `${pipelineCount} open opps (current)`, link: `${basePath}/pipeline` },
      ],
    },
    {
      label: "Session Time",
      icon: Clock,
      iconColor: "text-amber-400",
      stats: [
        { label: "Time in App",           value: fmtMins(totalTimeInApp),   note: "session time (not active working time)", link: null },
        { label: "Active Days",           value: dailyRows.filter(r =>
            r.emailsSent + r.followUpsWorked + r.prospectsContacted +
            r.prospectsAdded + r.opportunitiesUpdated + r.tasksCompleted > 0
          ).length,                                                          note: "days with any recorded activity",  link: null },
      ],
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Performance</h2>
          <p className="text-xs text-gray-500 mt-0.5">{PERIOD_LABELS[period]}</p>
        </div>
        <div className="flex items-center gap-1">
          {(["today", "7d", "30d", "90d"] as Period[]).map(p => (
            <Link
              key={p}
              href={`?period=${p}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === p ? "bg-amber-700/40 text-amber-300 border border-amber-700/50" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
              }`}
            >
              {p === "today" ? "Today" : p}
            </Link>
          ))}
        </div>
      </div>

      {/* Stat groups */}
      {statGroups.map(group => (
        <div key={group.label} className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800">
            <group.icon className={`w-4 h-4 ${group.iconColor}`} />
            <h3 className="text-sm font-semibold text-white">{group.label}</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-gray-800">
            {group.stats.map(stat => {
              const inner = (
                <>
                  <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                  <p className="text-2xl font-semibold text-white">{typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{stat.note}</p>
                </>
              )
              return stat.link ? (
                <Link key={stat.label} href={stat.link} className="bg-gray-900/60 px-4 py-4 hover:bg-gray-800/60 transition-colors group">
                  {inner}
                  <p className="text-[10px] text-amber-600 group-hover:text-amber-400 mt-1 transition-colors">View records →</p>
                </Link>
              ) : (
                <div key={stat.label} className="bg-gray-900/60 px-4 py-4">
                  {inner}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Deals won */}
      {oppsWon.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Deals Won ({oppsWon.length})</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {oppsWon.map(o => (
              <Link key={o.id} href={`${basePath}/opportunities/${o.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-800/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{o.title}</p>
                  {o.prospect && <p className="text-xs text-gray-500">{o.prospect.companyName}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-emerald-400">{fmtMoney(Number(o.value ?? 0))}</p>
                  {o.wonAt && <p className="text-xs text-gray-600">{fmtDate(o.wonAt)}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Deals lost */}
      {oppsLost.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800">
            <TrendingUp className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">Deals Lost ({oppsLost.length})</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {oppsLost.map(o => (
              <Link key={o.id} href={`${basePath}/opportunities/${o.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-800/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-400 truncate">{o.title}</p>
                  {o.prospect && <p className="text-xs text-gray-600">{o.prospect.companyName}</p>}
                </div>
                {o.lostAt && <p className="text-xs text-gray-600 shrink-0">{fmtDate(o.lostAt)}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Daily activity trend */}
      {dailyRows.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800">
            <Calendar className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-white">Daily Activity Trend</h3>
            <span className="text-xs text-gray-600">({dailyRows.length} days)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-2 text-left text-gray-500 font-medium">Date</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Emails</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Contacted</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Added</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Follow-Ups</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Tasks</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Demos</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {[...dailyRows].reverse().map((row, i) => {
                  const hasActivity = row.emailsSent + row.followUpsWorked + row.prospectsContacted +
                    row.prospectsAdded + row.opportunitiesUpdated + row.tasksCompleted > 0
                  return (
                    <tr key={i} className={`${hasActivity ? "" : "opacity-40"}`}>
                      <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                        {fmtDate(row.date)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">{row.emailsSent || "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{row.prospectsContacted || "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{row.prospectsAdded || "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{row.followUpsWorked || "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{row.tasksCompleted || "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{row.demosLogged || "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-400">{row.timeInAppMinutes ? fmtMins(row.timeInAppMinutes) : "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-700">
                  <td className="px-4 py-2 text-gray-500 font-semibold">Total</td>
                  <td className="px-3 py-2 text-right text-white font-semibold">{emailsSentCount || "—"}</td>
                  <td className="px-3 py-2 text-right text-white font-semibold">{totalProspectsContacted || "—"}</td>
                  <td className="px-3 py-2 text-right text-white font-semibold">{totalProspectsAdded || "—"}</td>
                  <td className="px-3 py-2 text-right text-white font-semibold">{totalFollowUpsWorked || "—"}</td>
                  <td className="px-3 py-2 text-right text-white font-semibold">{totalTasksCompleted || "—"}</td>
                  <td className="px-3 py-2 text-right text-white font-semibold">{totalDemosLogged || "—"}</td>
                  <td className="px-3 py-2 text-right text-amber-300 font-semibold">{totalTimeInApp ? fmtMins(totalTimeInApp) : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {dailyRows.length === 0 && oppsWon.length === 0 && oppsLost.length === 0 &&
        emailsSentCount === 0 && callsAttempted === 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-6 py-8 text-center">
          <TrendingUp className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No activity recorded for this period.</p>
        </div>
      )}
    </div>
  )
}
