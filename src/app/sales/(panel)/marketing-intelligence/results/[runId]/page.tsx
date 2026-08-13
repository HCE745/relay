import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, XCircle, Clock, Target, Zap } from "lucide-react"
import { ResultsClient } from "./ResultsClient"

export const dynamic = "force-dynamic"

const CATEGORY_LABELS: Record<string, string> = {
  brand: "Brand", use_case: "Use Case", industry: "Industry",
  competitor: "Competitor", pain_point: "Pain Point",
}

const CATEGORY_COLORS: Record<string, string> = {
  brand:      "bg-blue-900/40 text-blue-300",
  use_case:   "bg-purple-900/40 text-purple-300",
  industry:   "bg-orange-900/40 text-orange-300",
  competitor: "bg-red-900/40 text-red-300",
  pain_point: "bg-yellow-900/40 text-yellow-300",
}

export default async function ResultsPage({ params }: { params: Promise<{ runId: string }> }) {
  const session = await getSession()
  if (!session?.superAdmin) redirect("/super-admin/login")

  const { runId } = await params

  const [run, checks, prompts] = await Promise.all([
    prisma.visibilityRun.findUnique({ where: { runId } }),
    prisma.visibilityCheck.findMany({ where: { runId }, orderBy: { createdAt: "asc" } }),
    prisma.visibilityPrompt.findMany(),
  ])

  if (!run) redirect("/sales/marketing-intelligence")

  const promptMap = Object.fromEntries(prompts.map(p => [p.id, p]))
  const enriched = checks.map(c => ({ ...c, prompt: promptMap[c.promptId] ?? null }))

  const score         = Number(run.relayVisibilityScore)
  const mentionedCount = checks.filter(c => c.relayMentioned).length
  const recommendations = (run.aiRecommendations as string[]) ?? []
  const providers = (run.providersUsed as string[]) ?? []

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/sales/marketing-intelligence"
          className="mt-1 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white">Visibility Run</h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              run.status === "completed" ? "text-emerald-400 bg-emerald-900/20 border-emerald-700/40" :
              run.status === "running"   ? "text-yellow-400 bg-yellow-900/20 border-yellow-700/40" :
              "text-red-400 bg-red-900/20 border-red-700/40"
            }`}>
              {run.status}
            </span>
          </div>
          <p className="text-gray-400 text-sm">
            {format(new Date(run.startedAt), "MMMM d, yyyy 'at' h:mm a")}
            {run.completedAt && (
              <> · completed in {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s</>
            )}
          </p>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Visibility Score</p>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-4xl font-bold text-white">{score.toFixed(0)}%</p>
          <p className="text-xs text-gray-500 mt-1">Relay mentioned rate</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Prompts Checked</p>
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-4xl font-bold text-white">{run.promptsChecked}</p>
          <p className="text-xs text-gray-500 mt-1">via {providers.join(", ")}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Relay Mentioned</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-4xl font-bold text-white">{mentionedCount}</p>
          <p className="text-xs text-gray-500 mt-1">of {checks.length} checks</p>
        </div>
      </div>

      {/* AI Analysis */}
      {run.aiAnalysis && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            AI Analysis
          </h2>
          <p className="text-sm text-gray-400 mb-4">{run.aiAnalysis}</p>
          {recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recommendations</p>
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-900/50 text-emerald-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-gray-300">{rec}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Per-prompt results */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300">Results by Prompt</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {enriched.map(check => {
            const compMentioned = (check.competitorsMentioned as string[]) ?? []
            const sources = (check.sourcesCited as string[]) ?? []
            const cat = check.prompt?.category ?? ""
            return (
              <ResultsClient
                key={check.id}
                checkId={check.id}
                promptText={check.prompt?.promptText ?? check.promptId}
                category={cat}
                categoryLabel={CATEGORY_LABELS[cat] ?? cat}
                categoryColor={CATEGORY_COLORS[cat] ?? "bg-gray-700 text-gray-300"}
                relayMentioned={check.relayMentioned}
                relayPosition={check.relayPosition}
                competitors={compMentioned}
                sources={sources}
                rawResponse={check.rawResponse}
                provider={check.provider}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
