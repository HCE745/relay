"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

export function DemoResetButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleReset() {
    if (!confirm("This will delete all current demo data and restore the original sample dataset. Continue?")) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/sales/demo/reset", { method: "POST" })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? "Reset failed")
      }
      router.push("/sales")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed")
      setLoading(false)
    }
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
      <div className="flex items-start gap-3 mb-3">
        <RefreshCw className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-amber-300">Reset Demo Data</h2>
          <p className="text-xs text-amber-400/70 mt-0.5">
            Restore all prospects, emails, opportunities, tasks, and commission records to their original demo state.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-3">{error}</p>
      )}

      <button
        onClick={() => void handleReset()}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-lg transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Resetting…" : "Reset Demo Data"}
      </button>
    </div>
  )
}
