import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { subDays, startOfDay, format } from "date-fns"
import { Users, Mail, TrendingUp, GitBranch, CheckCircle2, XCircle } from "lucide-react"

export const dynamic = "force-dynamic"

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-400">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default async function SalesAnalyticsPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const since30  = startOfDay(subDays(new Date(), 30))
  const since90  = startOfDay(subDays(new Date(), 90))

  const [
    totalLeads,
    newLast30,
    converted,
    lost,
    stageBreakdown,
    industryBreakdown,
    emailsSent30,
    followUpsPending,
    avgTimeToConvert,
    recentLeads,
  ] = await Promise.all([
    prisma.demoCall.count(),
    prisma.demoCall.count({ where: { createdAt: { gte: since30 } } }),
    prisma.demoCall.count({ where: { callStatus: "Converted" } }),
    prisma.demoCall.count({ where: { callStatus: "Lost" } }),
    prisma.demoCall.groupBy({
      by: ["callStatus"],
      _count: true,
      orderBy: { _count: { callStatus: "desc" } },
    }),
    prisma.demoCall.groupBy({
      by: ["industry"],
      where: { industry: { not: null } },
      _count: true,
      orderBy: { _count: { industry: "desc" } },
      take: 8,
    }),
    prisma.crmEmail.count({
      where: { direction: "sent", sentAt: { gte: since30 } },
    }),
    prisma.crmEmail.count({
      where: { followUpDate: { lte: new Date() }, followUpDoneAt: null, isDeleted: false },
    }),
    // Avg days from createdAt to Converted (approximate with updatedAt)
    prisma.$queryRaw<{ avg_days: number }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400)::float AS avg_days
      FROM "DemoCall"
      WHERE "callStatus" = 'Converted'
    `,
    prisma.demoCall.findMany({
      where:   { createdAt: { gte: since30 } },
      orderBy: { createdAt: "desc" },
      take:    10,
      select: {
        id: true, companyName: true, contactName: true,
        callStatus: true, createdAt: true, industry: true,
      },
    }),
  ])

  const conversionRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : "0"
  const avgDays = avgTimeToConvert[0]?.avg_days
  const avgDaysStr = avgDays != null ? `${Math.round(avgDays)}d avg` : "—"

  const STATUS_COLORS: Record<string, string> = {
    "Converted":      "text-green-400",
    "Trial Active":   "text-emerald-400",
    "Trial Expired":  "text-orange-400",
    "Demo Completed": "text-purple-400",
    "Scheduled":      "text-indigo-400",
    "New Lead":       "text-blue-400",
    "Pending":        "text-yellow-400",
    "Lost":           "text-gray-500",
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Sales Analytics</h1>
        <p className="text-gray-400 text-sm mt-0.5">Pipeline health and outreach performance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Leads"      value={totalLeads}          sub={`+${newLast30} last 30d`} icon={Users}        color="bg-blue-900/40 text-blue-400"     />
        <StatCard label="Converted"        value={converted}           sub={`${conversionRate}% rate`} icon={CheckCircle2} color="bg-green-900/40 text-green-400"   />
        <StatCard label="Lost"             value={lost}                                icon={XCircle}     color="bg-red-900/40 text-red-400"       />
        <StatCard label="Emails Sent"      value={emailsSent30}        sub="last 30d"  icon={Mail}        color="bg-purple-900/40 text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Stage breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-500" />
            Pipeline by Stage
          </h2>
          <div className="space-y-2.5">
            {stageBreakdown.map(row => {
              const pct = Math.round(((row._count) / (totalLeads || 1)) * 100)
              const colorClass = STATUS_COLORS[row.callStatus ?? ""] ?? "text-gray-400"
              return (
                <div key={row.callStatus ?? "null"}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`font-medium ${colorClass}`}>{row.callStatus ?? "Unknown"}</span>
                    <span className="text-gray-500">{row._count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600/60 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick stats */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">Avg. Time to Convert</p>
            <p className="text-2xl font-bold text-white">{avgDaysStr}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">Follow-Ups Overdue</p>
            <p className={`text-2xl font-bold ${followUpsPending > 0 ? "text-orange-400" : "text-white"}`}>
              {followUpsPending}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">New Leads (30d)</p>
            <p className="text-2xl font-bold text-white">{newLast30}</p>
          </div>
        </div>
      </div>

      {/* Industry breakdown + recent leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Top Industries</h2>
          <div className="space-y-2">
            {industryBreakdown.map(row => {
              const pct = Math.round((row._count / (totalLeads || 1)) * 100)
              return (
                <div key={row.industry ?? "unknown"}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300">{row.industry ?? "Unknown"}</span>
                    <span className="text-gray-500">{row._count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600/60 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Recent Leads (30d)
          </h2>
          <div className="space-y-2">
            {recentLeads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-800/60 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-gray-300 font-medium truncate">{lead.companyName}</p>
                  <p className="text-gray-600 truncate">{lead.contactName}</p>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <p className={`font-medium ${STATUS_COLORS[lead.callStatus ?? ""] ?? "text-gray-400"}`}>
                    {lead.callStatus}
                  </p>
                  <p className="text-gray-600">{format(lead.createdAt, "MMM d")}</p>
                </div>
              </div>
            ))}
            {recentLeads.length === 0 && (
              <p className="text-gray-600 text-sm">No new leads in last 30 days</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
