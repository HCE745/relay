"use client"

import { useState } from "react"
import { apiSend } from "@/lib/client"

// Cleaner-side time-off request (field app). Keeps the field UI simple: a single
// collapsible form that posts a request for a manager to approve.
export function TimeOffRequest() {
  const [open, setOpen] = useState(false)
  const [startDate, setStart] = useState("")
  const [endDate, setEnd] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await apiSend("/api/time-off", "POST", { startDate, endDate, reason: reason || undefined })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setDone(true); setStart(""); setEnd(""); setReason("")
  }

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setDone(false) }} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm font-medium text-slate-700 active:bg-slate-50">
        Request time off →
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Request time off</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400">Close</button>
      </div>
      {done ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Request sent — your manager will review it.</p> : null}
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-600">From</span>
        <input type="date" required value={startDate} onChange={(e) => setStart(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-600">To</span>
        <input type="date" required value={endDate} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-600">Reason (optional)</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base" />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-brand-700 py-3 text-center font-semibold text-white disabled:opacity-60">
        {busy ? "Sending…" : "Send request"}
      </button>
    </form>
  )
}
