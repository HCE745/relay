"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckSquare } from "lucide-react"

interface Props {
  enabled: boolean
  aiSuggestUnmatched: boolean
  confidenceThreshold: number
}

export function ApprovalIntelligenceSettingsForm({ enabled, aiSuggestUnmatched, confidenceThreshold }: Props) {
  const [isEnabled, setEnabled]           = useState(enabled)
  const [suggestUnmatched, setSuggest]    = useState(aiSuggestUnmatched)
  const [threshold, setThreshold]         = useState((confidenceThreshold * 100).toFixed(0))
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [error, setError]                 = useState("")

  async function handleSave() {
    setSaving(true); setError(""); setSaved(false)
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          approval_intelligence_enabled: isEnabled,
          ai_suggest_unmatched_items:    suggestUnmatched,
          ai_confidence_threshold:       Number(threshold) / 100,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? "Save failed")
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { setError("Network error") } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-indigo-600" />
            Enable Approval Intelligence
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Replaces the legacy purchase request flow with AI-powered catalog matching and policy-driven approval routing.
          </p>
        </div>
        <button
          onClick={() => setEnabled(!isEnabled)}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isEnabled ? "bg-indigo-600" : "bg-gray-200"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isEnabled ? "translate-x-5" : ""}`} />
        </button>
      </div>

      {isEnabled && (
        <>
          {/* Confidence threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AI Confidence Threshold
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range" min="50" max="100" step="5"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
                className="flex-1 accent-indigo-600"
              />
              <span className="text-sm font-semibold text-gray-900 w-10 text-right">{threshold}%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              When AI confidence is below this threshold, the request is flagged for manual human review instead of being auto-approved.
            </p>
          </div>

          {/* Suggest unmatched */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Allow AI to suggest items not in catalog</p>
              <p className="text-xs text-gray-400 mt-0.5">
                When off (recommended), AI only matches items already in your Approved Item Catalog.
              </p>
            </div>
            <button
              onClick={() => setSuggest(!suggestUnmatched)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${suggestUnmatched ? "bg-indigo-600" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${suggestUnmatched ? "translate-x-5" : ""}`} />
            </button>
          </div>

          {/* Quick links */}
          <div className="flex gap-3 pt-1">
            <Link href="/approval-intelligence/catalog" className="text-xs text-indigo-600 hover:underline">
              Manage Item Catalog →
            </Link>
            <Link href="/approval-intelligence/policies" className="text-xs text-indigo-600 hover:underline">
              Manage Approval Policies →
            </Link>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300"
      >
        {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  )
}
