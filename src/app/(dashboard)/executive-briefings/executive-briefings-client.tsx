"use client"

import { useState } from "react"
import { FileText, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"

type Briefing = {
  id: string
  briefingType: string
  periodStart: Date | string
  periodEnd: Date | string
  content: string
  status: string
  createdAt: Date | string
}

type Props = {
  briefings: Briefing[]
  orgId: string
}

const TABS = ["DAILY", "WEEKLY", "MONTHLY"] as const
type Tab = (typeof TABS)[number]

function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETE") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
        <CheckCircle2 className="w-3 h-3" /> Complete
      </span>
    )
  }
  if (status === "GENERATING") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">
        <Loader2 className="w-3 h-3 animate-spin" /> Generating
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
      <XCircle className="w-3 h-3" /> Failed
    </span>
  )
}

function BriefingCard({ briefing }: { briefing: Briefing }) {
  const [expanded, setExpanded] = useState(false)

  const date = new Date(briefing.createdAt)
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })

  const preview = briefing.content
    ? briefing.content.replace(/#+\s/g, "").replace(/\*\*/g, "").slice(0, 160) + (briefing.content.length > 160 ? "…" : "")
    : ""

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        className="w-full px-6 py-4 flex items-start justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {dateStr} at {timeStr}
            </span>
            <StatusBadge status={briefing.status} />
          </div>
          {preview && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{preview}</p>
          )}
        </div>
        <div className="ml-4 flex-shrink-0 text-gray-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {expanded && briefing.status === "COMPLETE" && briefing.content && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4">
          <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-mono">
            {briefing.content}
          </div>
        </div>
      )}
      {expanded && briefing.status === "FAILED" && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4">
          <p className="text-sm text-red-600">This briefing failed to generate. Please try again.</p>
        </div>
      )}
    </div>
  )
}

export function ExecutiveBriefingsClient({ briefings: initial, orgId }: Props) {
  const [briefings, setBriefings] = useState<Briefing[]>(initial)
  const [activeTab, setActiveTab] = useState<Tab>("DAILY")
  const [generating, setGenerating] = useState<Record<string, boolean>>({})

  const filteredBriefings = briefings.filter(b => b.briefingType === activeTab)

  async function handleGenerate(type: Tab) {
    setGenerating(prev => ({ ...prev, [type]: true }))
    try {
      const res = await fetch("/api/executive-briefings/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      if (res.ok) {
        const newBriefing = await res.json()
        setBriefings(prev => [newBriefing, ...prev])
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? "Failed to generate briefing")
      }
    } catch {
      alert("Network error generating briefing")
    } finally {
      setGenerating(prev => ({ ...prev, [type]: false }))
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Generate button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {filteredBriefings.length > 0
            ? `${filteredBriefings.length} briefing${filteredBriefings.length !== 1 ? "s" : ""}`
            : "No briefings yet"}
        </p>
        <button
          onClick={() => handleGenerate(activeTab)}
          disabled={generating[activeTab]}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {generating[activeTab] ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Generate Now
        </button>
      </div>

      {/* Briefings list */}
      {filteredBriefings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No briefings yet. Click &quot;Generate Now&quot; to create your first.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBriefings.map(b => (
            <BriefingCard key={b.id} briefing={b} />
          ))}
        </div>
      )}
    </div>
  )
}
