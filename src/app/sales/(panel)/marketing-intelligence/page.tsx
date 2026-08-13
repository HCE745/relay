import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import Link from "next/link"
import { Eye, Target, Clock, BarChart2, ChevronRight, TrendingUp, AlertCircle, DollarSign, Link2, Share2, Trophy } from "lucide-react"
import { RunModal } from "./RunModal"

export const dynamic = "force-dynamic"

const CATEGORY_LABELS: Record<string, string> = {
  brand: "Brand", use_case: "Use Case", industry: "Industry",
  competitor: "Competitor", pain_point: "Pain Point",
}

const STATUS_STYLES: Record<string, string> = {
  running:   "text-yellow-400 bg-yellow-900/30 border-yellow-700/40",
  completed: "text-emerald-400 bg-emerald-900/20 border-emerald-700/40",
  failed:    "text-red-400 bg-red-900/20 border-red-700/40",
}

export default async function MarketingIntelligencePage() {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  // Auto-seed on first visit
  const [promptCount, competitorCount] = await Promise.all([
    prisma.visibilityPrompt.count(),
    prisma.visibilityCompetitor.count(),
  ])
  if (promptCount === 0 || competitorCount === 0) {
    if (promptCount === 0) {
      await prisma.visibilityPrompt.createMany({
        data: [
          { promptText: "What is Relay software",                                             category: "brand"      },
          { promptText: "Relay operations management software review",                         category: "brand"      },
          { promptText: "getrelay.software",                                                   category: "brand"      },
          { promptText: "Best software for tracking operational issues in manufacturing",       category: "use_case"   },
          { promptText: "How to prevent maintenance requests from falling through the cracks",  category: "use_case"   },
          { promptText: "Software for managing recurring equipment problems",                   category: "use_case"   },
          { promptText: "Best plant manager software",                                          category: "use_case"   },
          { promptText: "How to track facility issues across multiple locations",               category: "use_case"   },
          { promptText: "Best manufacturing operations software",                               category: "industry"   },
          { promptText: "Warehouse operations management software",                             category: "industry"   },
          { promptText: "Property management issue tracking software",                          category: "industry"   },
          { promptText: "Restaurant operations management software",                            category: "industry"   },
          { promptText: "MaintainX alternatives",                                               category: "competitor" },
          { promptText: "Best alternative to SafetyCulture",                                   category: "competitor" },
          { promptText: "UpKeep competitors",                                                   category: "competitor" },
          { promptText: "Limble CMMS alternatives",                                             category: "competitor" },
          { promptText: "How to stop operational issues from being forgotten",                  category: "pain_point" },
          { promptText: "Software for shift handoff communication in manufacturing",            category: "pain_point" },
          { promptText: "How to track who is responsible for fixing problems at work",          category: "pain_point" },
          { promptText: "Best tool for managing work orders and maintenance tasks",             category: "pain_point" },
        ],
      })
    }
    if (competitorCount === 0) {
      await prisma.visibilityCompetitor.createMany({
        data: [
          { name: "MaintainX",             website: "https://www.getmaintainx.com" },
          { name: "SafetyCulture",         website: "https://safetyculture.com" },
          { name: "UpKeep",                website: "https://upkeep.com" },
          { name: "Limble",                website: "https://limblecmms.com" },
          { name: "Fiix",                  website: "https://fiixsoftware.com" },
          { name: "Maintenance Connection",website: "https://maintenanceconnection.com" },
          { name: "FMX",                   website: "https://gofmx.com" },
          { name: "Facilio",               website: "https://facilio.com" },
        ],
      })
    }
  }

  // Calendar month start for spend calculation
  const now          = new Date()
  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1)

  const [runs, competitors, allChecks, monthlySpend] = await Promise.all([
    prisma.visibilityRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
    prisma.visibilityCompetitor.findMany({ orderBy: { name: "asc" } }),
    prisma.visibilityCheck.findMany({
      select: {
        relayMentioned:       true,
        competitorsMentioned: true,
        citationToRelay:      true,
        estimatedCostUsd:     true,
        createdAt:            true,
      },
    }),
    prisma.visibilityCheck.aggregate({
      _sum: { estimatedCostUsd: true },
      where: { createdAt: { gte: monthStart } },
    }),
  ])

  const lastRun       = runs[0] ?? null
  const completedRuns = runs.filter(r => r.status === "completed")
  const currentScore  = lastRun?.relayVisibilityScore
    ? Number(lastRun.relayVisibilityScore)
    : null

  // Core counts
  const totalChecksAll = allChecks.length
  let relayTotal       = 0
  let citationTotal    = 0
  let totalCompMentions = 0
  const competitorFreq: Record<string, number> = {}

  for (const check of allChecks) {
    if (check.relayMentioned) relayTotal++
    if (check.citationToRelay) citationTotal++
    const names = (check.competitorsMentioned as string[]) ?? []
    totalCompMentions += names.length
    for (const name of names) {
      competitorFreq[name] = (competitorFreq[name] ?? 0) + 1
    }
  }

  const relayFreq    = totalChecksAll > 0 ? Math.round((relayTotal / totalChecksAll) * 100) : 0
  const citationRate = totalChecksAll > 0 ? ((citationTotal / totalChecksAll) * 100).toFixed(1) : "0"

  // Share of voice: relay mentions / (relay + all competitor) mentions
  const totalAllMentions = relayTotal + totalCompMentions
  const shareOfMentions  = totalAllMentions > 0
    ? Math.round((relayTotal / totalAllMentions) * 100)
    : 0

  // Won vs never mentioned
  const promptsWon           = relayTotal
  const promptsNeverMentioned = totalChecksAll - relayTotal

  // Top competitor by raw frequency
  const topCompetitor = Object.entries(competitorFreq).sort((a, b) => b[1] - a[1])[0] ?? null
  const topCompPct    = topCompetitor && totalChecksAll > 0
    ? Math.round((topCompetitor[1] / totalChecksAll) * 100)
    : 0

  // Monthly API spend
  const monthlySpendUsd = Number(monthlySpend._sum.estimatedCostUsd ?? 0)

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Visibility</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Track how often Relay appears when people ask AI systems about operational software
          </p>
        </div>
        <RunModal />
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm text-gray-400">Visibility Score</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-900/40 text-emerald-400 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">
            {currentScore !== null ? `${Number(currentScore).toFixed(0)}%` : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {lastRun ? `Last run ${format(new Date(lastRun.startedAt), "MMM d")}` : "No runs yet"}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm text-gray-400">Total Checks</p>
            <div className="w-8 h-8 rounded-lg bg-blue-900/40 text-blue-400 flex items-center justify-center">
              <BarChart2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{totalChecksAll}</p>
          <p className="text-xs text-gray-500 mt-1">across {completedRuns.length} runs</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm text-gray-400">All-Time Mention Rate</p>
            <div className="w-8 h-8 rounded-lg bg-purple-900/40 text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{totalChecksAll > 0 ? `${relayFreq}%` : "—"}</p>
          <p className="text-xs text-gray-500 mt-1">{relayTotal} of {totalChecksAll} checks</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm text-gray-400">Runs This Month</p>
            <div className="w-8 h-8 rounded-lg bg-orange-900/40 text-orange-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">
            {runs.filter(r => new Date(r.startedAt) >= monthStart).length}
          </p>
          <p className="text-xs text-gray-500 mt-1">this calendar month</p>
        </div>
      </div>

      {/* Enhanced metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-gray-400">Citation Rate</p>
            <Link2 className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{totalChecksAll > 0 ? `${citationRate}%` : "—"}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">getrelay.software cited</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-gray-400">Share of Mentions</p>
            <Share2 className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white">{totalAllMentions > 0 ? `${shareOfMentions}%` : "—"}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">vs all competitors</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-gray-400">Prompts Won</p>
            <Trophy className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white">{promptsWon}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">{promptsNeverMentioned} never mentioned</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-gray-400">Top Competitor</p>
            <TrendingUp className="w-3.5 h-3.5 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-white truncate">{topCompetitor ? topCompetitor[0] : "—"}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">{topCompetitor ? `${topCompPct}% mention rate` : "no data yet"}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-2">
            <p className="text-xs text-gray-400">API Spend (month)</p>
            <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-white">${monthlySpendUsd.toFixed(3)}</p>
          <p className="text-[11px] text-gray-600 mt-0.5">current calendar month</p>
        </div>
      </div>

      {/* AI Analysis from last run */}
      {lastRun?.aiAnalysis && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-gray-300">Latest AI Analysis</h2>
            <span className="text-[10px] text-gray-600 ml-1">{format(new Date(lastRun.startedAt), "MMM d, yyyy")}</span>
          </div>
          <p className="text-sm text-gray-400 mb-3">{lastRun.aiAnalysis}</p>
          {Array.isArray(lastRun.aiRecommendations) && (lastRun.aiRecommendations as string[]).length > 0 && (
            <div className="space-y-1.5">
              {(lastRun.aiRecommendations as string[]).map((rec, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-900/50 text-emerald-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-gray-300">{rec}</p>
                </div>
              ))}
            </div>
          )}
          <Link
            href={`/sales/marketing-intelligence/results/${lastRun.runId}`}
            className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
          >
            View full results <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Competitor frequency chart */}
      {totalChecksAll > 0 && competitors.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">AI Mention Frequency vs Competitors</h2>
          <div className="space-y-2.5">
            {/* Relay row */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-emerald-400 font-semibold">Relay</span>
                <span className="text-gray-400">{relayTotal} / {totalChecksAll} ({relayFreq}%)</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${relayFreq}%` }} />
              </div>
            </div>
            {competitors.map(c => {
              const freq = competitorFreq[c.name] ?? 0
              const pct  = totalChecksAll > 0 ? Math.round((freq / totalChecksAll) * 100) : 0
              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300">{c.name}</span>
                    <span className="text-gray-500">{freq} / {totalChecksAll} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-600 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent runs */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300">Recent Runs</h2>
          <Link href="/sales/marketing-intelligence/prompts" className="text-xs text-emerald-400 hover:text-emerald-300">
            Manage prompts →
          </Link>
        </div>
        {runs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <AlertCircle className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No runs yet.</p>
            <p className="text-gray-600 text-xs mt-1">Click &quot;Run Visibility Check&quot; to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {runs.map(run => (
              <Link
                key={run.id}
                href={`/sales/marketing-intelligence/results/${run.runId}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/40 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[run.status] ?? ""}`}>
                      {run.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(run.startedAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">
                    {run.promptsChecked} prompt{run.promptsChecked !== 1 ? "s" : ""} checked
                    {run.status === "completed" && (
                      <span className="text-gray-500"> · </span>
                    )}
                    {run.status === "completed" && (
                      <span className="text-emerald-400 font-medium">
                        {Number(run.relayVisibilityScore).toFixed(0)}% score
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer links */}
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <Link href="/sales/marketing-intelligence/prompts"     className="hover:text-gray-400">Manage Prompts</Link>
        <span>·</span>
        <Link href="/sales/marketing-intelligence/competitors" className="hover:text-gray-400">Competitors</Link>
        <span>·</span>
        <Link href="/sales/marketing-intelligence/settings"   className="hover:text-gray-400">Settings</Link>
      </div>
    </div>
  )
}
