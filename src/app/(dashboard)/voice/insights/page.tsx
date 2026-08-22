import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { startOfMonth } from "date-fns"
import { SUGGESTION_CATEGORY_LABEL, SUGGESTION_TYPE_LABEL } from "@/lib/suggestion-constants"
import Link from "next/link"
import { AlertCircle, CheckCircle, ClipboardList, Clock, ChevronRight, TrendingUp } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function VoiceInsightsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  if (!["ADMIN", "HR", "MANAGER"].includes(session.role)) redirect("/voice")

  const orgId = session.organizationId
  const monthStart = startOfMonth(new Date())

  const [allSuggestions, thisMonthSuggestions, trendAlerts, recentSuggestions] = await Promise.all([
    prisma.suggestion.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: { id: true },
    }),
    prisma.suggestion.findMany({
      where: { organizationId: orgId, createdAt: { gte: monthStart } },
      select: { id: true, type: true, status: true, detectedCategory: true },
    }),
    prisma.trendAlert.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
      take: 5,
      select: { id: true, title: true, description: true, severity: true, trendType: true, detectedAt: true },
    }),
    prisma.suggestion.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, type: true, status: true, content: true, createdAt: true, detectedCategory: true,
        submittedBy: { select: { name: true } },
      },
    }),
  ])

  // Aggregate status counts from groupBy
  const statusCounts: Record<string, number> = {}
  for (const row of allSuggestions) { statusCounts[row.status] = row._count.id }

  const totalAll   = Object.values(statusCounts).reduce((a, b) => a + b, 0)
  const pending    = statusCounts["PENDING"]    ?? 0
  const implemented = statusCounts["IMPLEMENTED"] ?? 0
  const converted  = statusCounts["CONVERTED"]  ?? 0

  // This-month counts
  const thisMonth         = thisMonthSuggestions.length
  const thisMonthPending  = thisMonthSuggestions.filter(s => s.status === "PENDING").length

  // Category breakdown (all time)
  const categoryMap: Record<string, number> = {}
  for (const s of recentSuggestions) {
    if (s.detectedCategory) categoryMap[s.detectedCategory] = (categoryMap[s.detectedCategory] ?? 0) + 1
  }

  // Type breakdown (all time)
  const typeCounts: Record<string, number> = {}
  for (const s of thisMonthSuggestions) {
    typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1
  }

  const SEVERITY_COLOR: Record<string, string> = {
    HIGH:   "bg-red-50 border-red-200 text-red-800",
    MEDIUM: "bg-amber-50 border-amber-200 text-amber-800",
    LOW:    "bg-blue-50 border-blue-200 text-blue-800",
  }

  const STATUS_LABEL: Record<string, string> = {
    PENDING: "Pending", REVIEWED: "Reviewed", DISMISSED: "Dismissed",
    CONVERTED: "Converted", IMPLEMENTED: "Implemented",
  }
  const STATUS_COLOR: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    REVIEWED: "bg-green-100 text-green-800",
    DISMISSED: "bg-gray-100 text-gray-500",
    CONVERTED: "bg-blue-100 text-blue-800",
    IMPLEMENTED: "bg-emerald-100 text-emerald-800",
  }

  return (
    <div>
      <Header title="Voice Insights" />
      <div className="md:hidden px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-gray-900">Voice Insights</h1>
      </div>

      <div className="px-3 md:px-6 py-4 md:py-8 max-w-4xl space-y-8">

        {/* Stats overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">This month</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{thisMonth}</div>
            <div className="text-xs text-gray-400 mt-0.5">submissions</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-gray-500 font-medium">Pending review</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{pending}</div>
            <div className="text-xs text-gray-400 mt-0.5">awaiting action</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-gray-500 font-medium">Implemented</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{implemented}</div>
            <div className="text-xs text-gray-400 mt-0.5">all time</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-500 font-medium">Converted</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{converted}</div>
            <div className="text-xs text-gray-400 mt-0.5">to work orders</div>
          </div>
        </div>

        {/* Type breakdown + Category breakdown side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Type breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm">This Month by Type</h3>
            {thisMonth === 0 ? (
              <p className="text-sm text-gray-400">No submissions this month</p>
            ) : (
              <div className="space-y-3">
                {(["SUGGESTION", "FEEDBACK", "CONCERN"] as const).map(t => {
                  const count = typeCounts[t] ?? 0
                  const pct = thisMonth > 0 ? Math.round((count / thisMonth) * 100) : 0
                  return (
                    <div key={t}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700 font-medium">{SUGGESTION_TYPE_LABEL[t]}</span>
                        <span className="text-gray-500">{count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${t === "SUGGESTION" ? "bg-blue-400" : t === "FEEDBACK" ? "bg-purple-400" : "bg-amber-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Category breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm">Top Categories</h3>
            {Object.keys(categoryMap).length === 0 ? (
              <p className="text-sm text-gray-400">No category data yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(categoryMap)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {SUGGESTION_CATEGORY_LABEL[cat as keyof typeof SUGGESTION_CATEGORY_LABEL] ?? cat}
                      </span>
                      <span className="font-medium text-gray-900">{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Active Trend Alerts */}
        {trendAlerts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                Active Trend Alerts
              </h2>
              <Link href="/trend-alerts" className="text-xs text-blue-600 hover:underline">View all</Link>
            </div>
            <div className="space-y-2">
              {trendAlerts.map(alert => (
                <div key={alert.id} className={`rounded-xl border p-3.5 ${SEVERITY_COLOR[alert.severity] ?? "bg-gray-50 border-gray-200 text-gray-800"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{alert.title}</div>
                      <div className="text-xs mt-0.5 opacity-75 leading-relaxed">{alert.description}</div>
                    </div>
                    <span className="text-xs font-semibold shrink-0 opacity-60 uppercase">{alert.severity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent submissions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Recent Submissions</h2>
            <Link href="/suggestions" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              Manage in inbox <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {recentSuggestions.length === 0 ? (
            <p className="text-sm text-gray-400">No submissions yet</p>
          ) : (
            <div className="space-y-2">
              {recentSuggestions.map(s => (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-3.5">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs text-gray-500 font-medium">{s.submittedBy.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded border font-medium bg-gray-50 text-gray-600 border-gray-100">
                      {SUGGESTION_TYPE_LABEL[s.type] ?? s.type}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLOR[s.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 truncate">{s.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
