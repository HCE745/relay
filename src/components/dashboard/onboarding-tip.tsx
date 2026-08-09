"use client"

import { useState, useEffect } from "react"
import { Sparkles, X } from "lucide-react"

export function OnboardingTip() {
  const [tip, setTip]           = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch("/api/ai/onboarding-tip")
      .then(r => r.ok ? r.json() : { tip: null })
      .then((d: { tip: string | null }) => setTip(d.tip ?? null))
      .catch(() => {})
  }, [])

  if (!tip || dismissed) return null

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-200">
      <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
      <p className="flex-1 text-sm text-indigo-800">{tip}</p>
      <button
        onClick={() => setDismissed(true)}
        className="text-indigo-400 hover:text-indigo-600 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
