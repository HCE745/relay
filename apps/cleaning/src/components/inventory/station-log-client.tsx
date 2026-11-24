"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"

type Supply = { id: string; name: string; unit: string; usageUnit: string | null; onHand: string | null }
type Line = { supplyId: string; action: string; quantity: number; unit?: "stock" | "usage" }

const ACTIONS = [
  { v: "TAKEN", label: "Took" },
  { v: "REFILLED", label: "Refilled" },
  { v: "RETURN_CLEAN", label: "Returned clean" },
  { v: "RETURN_DIRTY", label: "Returned dirty" },
  { v: "DAMAGED", label: "Damaged/missing" },
]

export function StationLogClient({ stationId, stationName, frequent, others }: { stationId: string; stationName: string; frequent: Supply[]; others: Supply[] }) {
  const router = useRouter()
  const all = [...frequent, ...others]
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addLine(supplyId: string, action: string) {
    setLines((ls) => [...ls, { supplyId, action, quantity: 1 }])
    setDone(false)
  }
  function setQty(i: number, q: number) { setLines((ls) => ls.map((l, j) => (j === i ? { ...l, quantity: Math.max(0, q) } : l))) }
  function remove(i: number) { setLines((ls) => ls.filter((_, j) => j !== i)) }

  async function submit() {
    if (lines.length === 0) return
    setBusy(true); setError(null)
    // "Refilled" is measured in employee usage units (e.g. one bottle refill).
    const payload = { lines: lines.map((l) => ({ ...l, unit: l.action === "REFILLED" ? "usage" : "stock" })) }
    const res = await apiSend(`/api/inventory/station/${stationId}`, "POST", payload)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setLines([]); setDone(true); router.refresh()
  }

  const nameOf = (id: string) => all.find((s) => s.id === id)?.name ?? "Supply"
  const [picker, setPicker] = useState(false)

  return (
    <div className="space-y-4">
      <div>
        <Link href="/today" className="text-sm text-slate-500">← Today</Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{stationName}</h1>
        <p className="text-sm text-slate-500">Supply station log — tap what you took, refilled or returned.</p>
      </div>

      {/* Quick-add from frequently stocked items */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">At this station</h2>
        {frequent.length === 0 ? <p className="text-sm text-slate-400">Nothing recorded here yet — add from the full list below.</p> : frequent.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-900">{s.name}</div>
              {s.onHand != null ? <div className="text-xs text-slate-400">{s.onHand} {s.unit} on hand</div> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ACTIONS.map((a) => <button key={a.v} onClick={() => addLine(s.id, a.v)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 active:bg-slate-200">{a.label}</button>)}
            </div>
          </div>
        ))}
      </div>

      <div>
        <button onClick={() => setPicker((p) => !p)} className="text-sm font-medium text-brand-700">{picker ? "Hide" : "+ Add another supply"}</button>
        {picker ? (
          <div className="mt-2 grid grid-cols-1 gap-1.5">
            {others.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-sm text-slate-800">{s.name}</span>
                <div className="flex gap-1">{ACTIONS.slice(0, 2).map((a) => <button key={a.v} onClick={() => addLine(s.id, a.v)} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{a.label}</button>)}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Pending lines */}
      {lines.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-brand-200 bg-brand-50/40 p-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">To record ({lines.length})</h2>
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl bg-white p-2">
              <div className="min-w-0 flex-1 text-sm"><span className="font-medium text-slate-900">{ACTIONS.find((a) => a.v === l.action)?.label}</span> {nameOf(l.supplyId)}</div>
              <button onClick={() => setQty(i, l.quantity - 1)} className="h-8 w-8 rounded-lg bg-slate-100 text-lg">−</button>
              <input inputMode="decimal" value={l.quantity} onChange={(e) => setQty(i, Number(e.target.value) || 0)} className="w-12 rounded-lg border border-slate-300 px-1 py-1 text-center text-sm" />
              <button onClick={() => setQty(i, l.quantity + 1)} className="h-8 w-8 rounded-lg bg-slate-100 text-lg">+</button>
              <button onClick={() => remove(i)} className="px-1 text-slate-400">✕</button>
            </div>
          ))}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button onClick={submit} disabled={busy} className="w-full rounded-2xl bg-brand py-3 text-center text-base font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Submit log"}</button>
        </div>
      ) : done ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700">Logged ✓ — thanks!</p>
      ) : null}
    </div>
  )
}
