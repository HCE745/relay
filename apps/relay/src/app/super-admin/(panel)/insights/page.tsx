import { prisma } from "@/lib/prisma"
import { TrendingUp, BarChart2, Clock, AlertTriangle } from "lucide-react"

export const dynamic = "force-dynamic"

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL:            "General",
  EQUIPMENT_BREAKDOWN:"Equipment Breakdown",
  SAFETY:             "Safety",
  MAINTENANCE:        "Maintenance",
  CLEANING:           "Cleaning",
  IT_SUPPORT:         "IT Support",
  FACILITIES:         "Facilities",
  HR:                 "HR",
  COMPLIANCE:         "Compliance",
  OTHER:              "Other",
}

const INDUSTRY_LABELS: Record<string, string> = {
  manufacturing: "Manufacturing",
  healthcare:    "Healthcare",
  retail:        "Retail",
  hospitality:   "Hospitality",
  education:     "Education",
  construction:  "Construction",
  logistics:     "Logistics",
  technology:    "Technology",
  finance:       "Finance",
  real_estate:   "Real Estate",
  government:    "Government",
  nonprofit:     "Nonprofit",
  other:         "Other",
}

async function getData() {
  const [
    totalPatterns,
    resolvedPatterns,
    topCategories,
    industryBreakdown,
    resolutionStats,
    escalationRate,
  ] = await Promise.all([
    prisma.issuePattern.count(),
    prisma.issuePattern.count({ where: { resolvedAt: { not: null } } }),

    prisma.issuePattern.groupBy({
      by: ["category"],
      _count: { category: true },
      orderBy: { _count: { category: "desc" } },
      take: 8,
    }),

    prisma.issuePattern.groupBy({
      by: ["industryBucket", "category"],
      _count: { id: true },
      where: { industryBucket: { not: null } },
      orderBy: { _count: { id: "desc" } },
      take: 30,
    }),

    prisma.issuePattern.groupBy({
      by: ["category"],
      _avg: { resolvedInDays: true },
      _count: { id: true },
      where: { resolvedAt: { not: null } },
      orderBy: { _avg: { resolvedInDays: "asc" } },
      take: 8,
    }),

    prisma.issuePattern.aggregate({
      _count: { id: true },
      where: { wasEscalated: true },
    }),
  ])

  return { totalPatterns, resolvedPatterns, topCategories, industryBreakdown, resolutionStats, escalationRate }
}

export default async function InsightsPage() {
  const { totalPatterns, resolvedPatterns, topCategories, industryBreakdown, resolutionStats, escalationRate } = await getData()

  const resolveRate   = totalPatterns > 0 ? Math.round((resolvedPatterns / totalPatterns) * 100) : 0
  const escalateRate  = totalPatterns > 0 ? Math.round((escalationRate._count.id / totalPatterns) * 100) : 0

  const validResTimes = resolutionStats.filter(r => r._avg.resolvedInDays != null)
  const overallAvgDays = validResTimes.length > 0
    ? (validResTimes.reduce((s, r) => s + r._avg.resolvedInDays!, 0) / validResTimes.length).toFixed(1)
    : null

  // Group industry breakdown by industry
  const byIndustry: Record<string, { category: string; count: number }[]> = {}
  for (const row of industryBreakdown) {
    const ind = row.industryBucket ?? "other"
    if (!byIndustry[ind]) byIndustry[ind] = []
    byIndustry[ind].push({ category: row.category, count: row._count.id })
  }
  const topIndustries = Object.entries(byIndustry)
    .map(([ind, cats]) => ({ ind, total: cats.reduce((s, c) => s + c.count, 0), cats }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  const maxCategoryCount = topCategories[0]?._count.category ?? 1

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Pattern Insights</h1>
        <p className="text-gray-400 text-sm mt-1">
          Anonymized cross-organization data — no company names or identifying information
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Patterns",   value: totalPatterns.toLocaleString(),                              icon: BarChart2,     color: "text-blue-400"   },
          { label: "Resolution Rate",  value: `${resolvedPatterns.toLocaleString()} (${resolveRate}%)`,   icon: TrendingUp,    color: "text-green-400"  },
          { label: "Avg Resolution",   value: overallAvgDays ? `${overallAvgDays}d` : "—",                icon: Clock,         color: "text-amber-400"  },
          { label: "Escalation Rate",  value: `${escalateRate}%`,                                          icon: AlertTriangle, color: "text-red-400"    },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {totalPatterns === 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <BarChart2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No pattern data yet. Patterns accumulate as organizations submit and resolve issues.</p>
        </div>
      )}

      {totalPatterns > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top categories */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Most Common Issue Categories</h2>
            <div className="space-y-3">
              {topCategories.map((row) => {
                const pct = Math.round((row._count.category / maxCategoryCount) * 100)
                return (
                  <div key={row.category}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-gray-300">{CATEGORY_LABELS[row.category] ?? row.category}</span>
                      <span className="text-xs text-gray-500">{row._count.category.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Resolution time per category */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Avg Days to Resolve by Category</h2>
            {resolutionStats.length === 0 ? (
              <p className="text-gray-500 text-sm">No resolved issues yet</p>
            ) : (
              <div className="space-y-3">
                {resolutionStats.map((row) => (
                  <div key={row.category} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{CATEGORY_LABELS[row.category] ?? row.category}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{row._count.id} resolved</span>
                      <span className="text-sm font-semibold text-white w-12 text-right">
                        {row._avg.resolvedInDays != null ? `${row._avg.resolvedInDays.toFixed(1)}d` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Industry breakdown */}
          <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Top Issue Categories by Industry</h2>
            {topIndustries.length === 0 ? (
              <p className="text-gray-500 text-sm">Not enough industry data yet</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {topIndustries.map(({ ind, total, cats }) => (
                  <div key={ind}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                        {INDUSTRY_LABELS[ind] ?? ind}
                      </h3>
                      <span className="text-xs text-gray-600">{total}</span>
                    </div>
                    <div className="space-y-1">
                      {cats.slice(0, 5).map(({ category, count }) => (
                        <div key={category} className="flex justify-between items-center">
                          <span className="text-xs text-gray-400 truncate mr-2">{CATEGORY_LABELS[category] ?? category}</span>
                          <span className="text-xs text-gray-500 shrink-0">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
