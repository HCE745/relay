"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

interface Props {
  orgId:      string
  healthScore: number
  loginPts:   number
  issuePts:   number
  userPts:    number
  routingPts: number
  subPts:     number
}

export function HealthExplanation({ orgId, healthScore, loginPts, issuePts, userPts, routingPts, subPts }: Props) {
  const [loading, setLoading]           = useState(false)
  const [explanation, setExplanation]   = useState<string | null>(null)

  async function load() {
    if (explanation) { setExplanation(null); return }
    setLoading(true)
    try {
      const res = await fetch("/api/ai/health-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, healthScore, loginPts, issuePts, userPts, routingPts, subPts }),
      })
      if (res.ok) {
        const d = await res.json() as { explanation: string }
        setExplanation(d.explanation)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="ml-2 inline-flex items-center gap-1">
      <button
        onClick={load}
        disabled={loading}
        className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Why?"}
      </button>
      {explanation && (
        <span className="text-xs text-gray-400 italic ml-1">{explanation}</span>
      )}
    </span>
  )
}
