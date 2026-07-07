"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"

interface BackfillResult {
  dry:           boolean
  total:         number
  converted:     number
  trialActive:   number
  trialExpired:  number
  cancelled:     number
  remainingLead: number
}

export function CrmBackfillButton() {
  const [running, setRunning]   = useState(false)
  const [result,  setResult]    = useState<BackfillResult | null>(null)
  const [done,    setDone]      = useState(false)

  async function runDry() {
    setRunning(true)
    setResult(null)
    const res  = await fetch("/api/super-admin/crm/backfill-lifecycle?dry=1", { method: "POST" })
    const data = await res.json() as BackfillResult
    setResult(data)
    setRunning(false)
  }

  async function runLive() {
    if (!confirm("This will update lifecycle statuses for all 'Lead' organizations based on their Stripe subscription state. Continue?")) return
    setRunning(true)
    const res  = await fetch("/api/super-admin/crm/backfill-lifecycle", { method: "POST" })
    const data = await res.json() as BackfillResult
    setResult(data)
    setDone(true)
    setRunning(false)
  }

  return (
    <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-amber-300">Data Fix: Backfill Lifecycle Statuses</p>
          <p className="text-xs text-amber-500 mt-0.5">
            Sets existing orgs from "Lead" to Converted / Trial Active / Trial Expired / Cancelled
            based on their current Stripe subscription state. Run once after initial CRM deploy.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!done && (
            <button
              onClick={runDry}
              disabled={running}
              className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {running ? "Running…" : "Dry Run"}
            </button>
          )}
          {result && !done && (
            <button
              onClick={runLive}
              disabled={running}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Apply Fix
            </button>
          )}
        </div>
      </div>

      {result && (
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Checked", value: result.total, color: "text-gray-300" },
            { label: "→ Converted", value: result.converted, color: "text-green-400" },
            { label: "→ Trial Active", value: result.trialActive, color: "text-teal-400" },
            { label: "→ Trial Expired", value: result.trialExpired, color: "text-orange-400" },
            { label: "→ Cancelled", value: result.cancelled, color: "text-red-400" },
            { label: "Stays Lead", value: result.remainingLead, color: "text-gray-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-gray-600">{label}</p>
            </div>
          ))}
        </div>
      )}

      {done && (
        <p className="text-xs text-green-400 mt-2 font-medium">
          ✓ Backfill applied. Reload the page to see updated pipeline counts.
        </p>
      )}
    </div>
  )
}
