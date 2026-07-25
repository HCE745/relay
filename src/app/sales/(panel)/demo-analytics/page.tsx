import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { subDays, startOfDay, format } from "date-fns"
import { BarChart2, Users, Clock, MousePointerClick, TrendingUp } from "lucide-react"

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

export default async function DemoAnalyticsPage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const since30 = startOfDay(subDays(new Date(), 30))

  const [all, recent, industries, ctaStats, conversions, dailyCounts] = await Promise.all([
    // Total sessions
    prisma.demoAnalytics.count(),
    // Last 30 days
    prisma.demoAnalytics.count({ where: { createdAt: { gte: since30 } } }),
    // Industry breakdown
    prisma.demoAnalytics.groupBy({
      by: ["industrySelected"],
      where: { industrySelected: { not: null } },
      _count: true,
      orderBy: { _count: { industrySelected: "desc" } },
      take: 10,
    }),
    // CTA stats (last 30d) — boolean fields can't use _sum, count with where filters
    Promise.all([
      prisma.demoAnalytics.count({ where: { createdAt: { gte: since30 }, clickedStartTrial: true } }),
      prisma.demoAnalytics.count({ where: { createdAt: { gte: since30 }, clickedBookDemo:   true } }),
      prisma.demoAnalytics.count({ where: { createdAt: { gte: since30 }, clickedExplore:    true } }),
    ]),
    // Conversions
    prisma.demoAnalytics.count({ where: { convertedToSignup: true, createdAt: { gte: since30 } } }),
    // Daily counts — last 14 days
    prisma.$queryRaw<{ day: string; cnt: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt")::date::text AS day, COUNT(*)::bigint AS cnt
      FROM "DemoAnalytics"
      WHERE "createdAt" >= ${startOfDay(subDays(new Date(), 13))}
      GROUP BY 1
      ORDER BY 1
    `,
  ])

  const [ctaStartTrial, ctaBookDemo, ctaExplore] = ctaStats

  const conversionRate = recent > 0 ? ((conversions / recent) * 100).toFixed(1) : "0"

  // Build 14-day bar data
  const dayMap = new Map(dailyCounts.map((d: { day: string; cnt: bigint }) => [d.day, Number(d.cnt)]))
  const days14 = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(new Date(), 13 - i)
    const key = format(d, "yyyy-MM-dd")
    return { label: format(d, "MMM d"), count: dayMap.get(key) ?? 0 }
  })
  const maxCount = Math.max(...days14.map((d: { count: number }) => d.count), 1)

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Demo Analytics</h1>
        <p className="text-gray-400 text-sm mt-0.5">Visitor behaviour on /demo and /tour pages</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Sessions"  value={all}              icon={Users}           color="bg-blue-900/40 text-blue-400"    />
        <StatCard label="Last 30 Days"    value={recent}           icon={TrendingUp}       color="bg-emerald-900/40 text-emerald-400" />
        <StatCard label="Conversion Rate" value={`${conversionRate}%`} sub="to signup"   icon={MousePointerClick} color="bg-purple-900/40 text-purple-400" />
        <StatCard label="Start Trial CTAs" value={ctaStartTrial} sub="last 30d" icon={BarChart2} color="bg-orange-900/40 text-orange-400" />
      </div>

      {/* Daily chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Daily Sessions — Last 14 Days</h2>
        <div className="flex items-end gap-1.5 h-32">
          {days14.map(day => (
            <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-emerald-600/70 rounded-t-sm"
                style={{ height: `${(day.count / maxCount) * 100}%`, minHeight: day.count > 0 ? "4px" : "0" }}
              />
              <span className="text-[9px] text-gray-600 rotate-45 origin-left translate-x-1">{day.label.split(" ")[1]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industry breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Industry Breakdown</h2>
          {industries.length === 0 ? (
            <p className="text-gray-600 text-sm">No industry data yet</p>
          ) : (
            <div className="space-y-2">
              {industries.map(row => {
                const pct = Math.round((row._count / (all || 1)) * 100)
                return (
                  <div key={row.industrySelected ?? "unknown"}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-300">{row.industrySelected ?? "Unknown"}</span>
                      <span className="text-gray-500">{row._count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600/70 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* CTA breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">CTA Clicks — Last 30 Days</h2>
          <div className="space-y-3">
            {[
              { label: "Start Trial",  value: ctaStartTrial, color: "bg-emerald-600" },
              { label: "Book Demo",    value: ctaBookDemo,   color: "bg-blue-600" },
              { label: "Explore",      value: ctaExplore,    color: "bg-purple-600" },
            ].map(cta => {
              const total = ctaStartTrial + ctaBookDemo + ctaExplore
              const pct   = total > 0 ? Math.round((cta.value / total) * 100) : 0
              return (
                <div key={cta.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300">{cta.label}</span>
                    <span className="text-gray-500">{cta.value} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full ${cta.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-800 text-xs text-gray-500">
            {conversions} visitor{conversions !== 1 ? "s" : ""} converted to signup in last 30 days
          </div>
        </div>
      </div>
    </div>
  )
}
