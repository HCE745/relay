"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"

// Cleaner-facing: log supply usage on this job, in familiar units (e.g. "1 bottle
// refill", "2 bags"), with +/- steppers. One tap + a quantity. No stock levels or
// costs. Also lets a cleaner request more of a supply when it's running low.
type Supply = { id: string; name: string; unit: string; usageUnit: string | null; stockPerUsage: number | null }

export function SupplyUsagePanel({ jobId, supplies }: { jobId: string; supplies: Supply[] }) {
  const router = useRouter()
  const [qty, setQty] = useState<Record<string, number>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [reqNote, setReqNote] = useState("")

  const get = (id: string) => qty[id] ?? 1

  async function use(s: Supply) {
    setBusyId(s.id); setError(null)
    const picked = get(s.id)
    // Convert the employee-facing usage unit to stock units for the ledger.
    const stockQty = s.usageUnit && s.stockPerUsage ? picked * s.stockPerUsage : picked
    const res = await apiSend(`/api/jobs/${jobId}/supply-usage`, "POST", { supplyId: s.id, quantity: String(stockQty) })
    setBusyId(null)
    if (!res.ok) return setError(res.error)
    setDoneId(s.id); setQty((m) => ({ ...m, [s.id]: 1 }))
    setTimeout(() => setDoneId((d) => (d === s.id ? null : d)), 1800)
    router.refresh()
  }

  async function request(s: Supply) {
    setBusyId(s.id); setError(null)
    const res = await apiSend(`/api/replenishment`, "POST", { supplyId: s.id, note: reqNote || `Running low on ${s.name}` })
    setBusyId(null)
    if (!res.ok) return setError(res.error)
    setRequesting(null); setReqNote(""); setDoneId(`req-${s.id}`)
    setTimeout(() => setDoneId((d) => (d === `req-${s.id}` ? null : d)), 2000)
  }

  if (supplies.length === 0) return <p className="text-sm text-slate-500">No supplies set up.</p>

  return (
    <div className="space-y-2">
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {supplies.map((s) => {
        const label = s.usageUnit || s.unit
        return (
          <div key={s.id} className="rounded-xl border border-slate-200 p-2.5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">{s.name}</div>
                <div className="text-xs text-slate-400">per {label}</div>
              </div>
              <button aria-label="less" onClick={() => setQty((m) => ({ ...m, [s.id]: Math.max(0, get(s.id) - 1) }))} className="h-9 w-9 rounded-lg bg-slate-100 text-lg">−</button>
              <input aria-label={`Quantity of ${s.name}`} inputMode="decimal" className="w-12 rounded-lg border border-slate-300 px-1 py-2 text-center text-sm" value={get(s.id)} onChange={(e) => setQty((m) => ({ ...m, [s.id]: Number(e.target.value) || 0 }))} />
              <button aria-label="more" onClick={() => setQty((m) => ({ ...m, [s.id]: get(s.id) + 1 }))} className="h-9 w-9 rounded-lg bg-slate-100 text-lg">+</button>
              <button type="button" disabled={busyId === s.id} onClick={() => use(s)} className={`min-w-16 rounded-lg px-3 py-2 text-sm font-medium transition ${doneId === s.id ? "bg-emerald-600 text-white" : "bg-brand text-white"} disabled:opacity-60`}>{busyId === s.id ? "…" : doneId === s.id ? "✓" : "Use"}</button>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-xs">
              {requesting === s.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input value={reqNote} onChange={(e) => setReqNote(e.target.value)} placeholder="Note (optional)" className="flex-1 rounded-lg border border-slate-300 px-2 py-1" />
                  <button onClick={() => request(s)} disabled={busyId === s.id} className="rounded-lg bg-amber-500 px-2.5 py-1 font-medium text-white">Send</button>
                  <button onClick={() => setRequesting(null)} className="text-slate-400">cancel</button>
                </div>
              ) : doneId === `req-${s.id}` ? (
                <span className="font-medium text-amber-700">Request sent ✓</span>
              ) : (
                <button onClick={() => setRequesting(s.id)} className="font-medium text-amber-700">Request more</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
