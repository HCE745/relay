"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, RefreshCw, AlertTriangle, TrendingUp, Lightbulb, CheckCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Theme {
  label: string
  description: string
  severity: "high" | "medium" | "low"
}

interface VoiceAnalysis {
  themes: Theme[]
  overallSentiment: "positive" | "neutral" | "concerning"
  topInsight: string
  recommendation: string
  submissionCount: number
  generatedAt: string
}

interface Props {
  initialAnalysis: VoiceAnalysis | null
}

const SEVERITY_STYLE: Record<string, string> = {
  high:   "bg-red-50 border-red-200 text-red-800",
  medium: "bg-amber-50 border-amber-200 text-amber-800",
  low:    "bg-blue-50 border-blue-200 text-blue-800",
}

const SENTIMENT_CONFIG = {
  positive:   { label: "Positive",   color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", Icon: CheckCircle },
  neutral:    { label: "Neutral",    color: "text-gray-600",    bg: "bg-gray-50 border-gray-200",       Icon: TrendingUp },
  concerning: { label: "Concerning", color: "text-red-600",     bg: "bg-red-50 border-red-200",         Icon: AlertTriangle },
}

export function AiInsightsPanel({ initialAnalysis }: Props) {
  const [analysis, setAnalysis] = useState<VoiceAnalysis | null>(initialAnalysis)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  async function generate() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/voice/ai-insights", { method: "POST" })
      if (res.ok) {
        const data = await res.json() as VoiceAnalysis
        setAnalysis(data)
        router.refresh()
      } else {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setError(d.error ?? "Analysis failed. Please try again.")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!analysis) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <h2 className="font-semibold text-gray-900">AI Voice Analysis</h2>
          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">Pro+</span>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Automatically identify recurring themes, sentiment, and actionable insights from employee submissions.
        </p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-60 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          {loading ? "Analyzing submissions…" : "Generate AI Analysis"}
        </button>
      </div>
    )
  }

  const sentiment = SENTIMENT_CONFIG[analysis.overallSentiment] ?? SENTIMENT_CONFIG.neutral
  const SentimentIcon = sentiment.Icon

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <h2 className="font-semibold text-gray-900">AI Voice Analysis</h2>
          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">Pro+</span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          title="Regenerate analysis"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analyzing…" : "Regenerate"}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Sentiment + count */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${sentiment.bg}`}>
        <SentimentIcon className={`w-5 h-5 ${sentiment.color} shrink-0`} />
        <div>
          <div className={`text-sm font-semibold ${sentiment.color}`}>Overall sentiment: {sentiment.label}</div>
          <div className="text-xs text-gray-500">Based on {analysis.submissionCount} submission{analysis.submissionCount !== 1 ? "s" : ""} in the last 90 days</div>
        </div>
      </div>

      {/* Top insight */}
      <div className="flex items-start gap-2.5 p-4 bg-purple-50 border border-purple-100 rounded-xl">
        <Lightbulb className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
        <div>
          <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Key Insight</div>
          <p className="text-sm text-purple-900">{analysis.topInsight}</p>
        </div>
      </div>

      {/* Themes */}
      {analysis.themes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Recurring Themes</h3>
          <div className="space-y-2">
            {analysis.themes.map((theme, i) => (
              <div key={i} className={`rounded-xl border px-4 py-3 ${SEVERITY_STYLE[theme.severity] ?? "bg-gray-50 border-gray-200 text-gray-800"}`}>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-medium text-sm">{theme.label}</span>
                  <span className="text-xs font-semibold opacity-60 uppercase">{theme.severity}</span>
                </div>
                <p className="text-xs opacity-80 leading-relaxed">{theme.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Recommendation for Leadership</div>
        <p className="text-sm text-gray-700 leading-relaxed">{analysis.recommendation}</p>
      </div>

      <div className="text-xs text-gray-400">
        Generated {formatDistanceToNow(new Date(analysis.generatedAt), { addSuffix: true })} · Refreshes every 6 hours
      </div>
    </div>
  )
}
