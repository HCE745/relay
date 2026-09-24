"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"

// Cleaner-facing: log supply usage on this job. One tap + a quantity — nothing
// heavier. No stock levels or costs are shown to the cleaner.
export function SupplyUsagePanel({ jobId, supplies }: { jobId: string; supplies: { id: string; name: string; unit: string }[] }) {
  const router = useRouter()
  const [qty, setQty] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function use(supplyId: string) {
    setBusyId(supplyId)
    setError(null)
    const quantity = (qty[supplyId] ?? "1").trim() || "1"
    const res = await apiSend(`/api/jobs/${jobId}/supply-usage`, "POST", { supplyId, quantity })
    setBusyId(null)
    if (!res.ok) return setError(res.error)
    setDoneId(supplyId)
    setQty((m) => ({ ...m, [supplyId]: "1" }))
    setTimeout(() => setDoneId((d) => (d === supplyId ? null : d)), 1800)
    router.refresh()
  }

  if (supplies.length === 0) return <p className="text-sm text-slate-500">No supplies set up.</p>

  return (
    <div className="space-y-2">
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {supplies.map((s) => (
        <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-900">{s.name}</div>
            <div className="text-xs text-slate-400">{s.unit}</div>
          </div>
          <input
            aria-label={`Quantity of ${s.name}`}
            inputMode="decimal"
            className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-center text-sm"
            value={qty[s.id] ?? "1"}
            onChange={(e) => setQty((m) => ({ ...m, [s.id]: e.target.value }))}
          />
          <button
            type="button"
            disabled={busyId === s.id}
            onClick={() => use(s.id)}
            className={`min-w-20 rounded-lg px-4 py-2 text-sm font-medium transition ${
              doneId === s.id ? "bg-emerald-600 text-white" : "bg-brand text-white hover:opacity-90"
            } disabled:opacity-60`}
          >
            {busyId === s.id ? "…" : doneId === s.id ? "Logged ✓" : "Use"}
          </button>
        </div>
      ))}
    </div>
  )
}
