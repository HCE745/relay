"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  return res.ok ? null : ((await res.json().catch(() => null))?.error ?? "Something went wrong")
}

// Request a reschedule or cancellation for an upcoming visit (needs staff approval).
export function PortalRequestChange({ jobId, label }: { jobId: string; label: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<"none" | "reschedule" | "cancel">("none")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("09:00")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(type: "RESCHEDULE" | "CANCEL") {
    setBusy(true); setError(null)
    const err = await post("/api/portal/service-requests", { jobId, type, requestedDate: date || undefined, requestedTime: time || undefined })
    setBusy(false)
    if (err) return setError(err)
    setDone(true); setMode("none"); router.refresh()
  }

  if (done) return <span className="text-xs text-emerald-600">Request sent for approval</span>
  return (
    <div className="text-sm">
      <div className="flex gap-2">
        <button onClick={() => setMode(mode === "reschedule" ? "none" : "reschedule")} className="text-xs font-medium text-brand hover:underline">Reschedule</button>
        <button onClick={() => submit("CANCEL")} disabled={busy} className="text-xs font-medium text-slate-500 hover:text-red-600">Cancel visit</button>
      </div>
      {mode === "reschedule" ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs" />
          <button onClick={() => submit("RESCHEDULE")} disabled={busy || !date} className="rounded bg-brand-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60">Request</button>
          <span className="sr-only">{label}</span>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

export function PortalSurvey({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!rating) return
    setBusy(true); setError(null)
    const err = await post("/api/portal/surveys", { jobId, rating, comment: comment || undefined })
    setBusy(false)
    if (err) return setError(err)
    setDone(true); router.refresh()
  }
  if (done) return <span className="text-xs text-emerald-600">Thanks for your feedback!</span>
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} className={`text-lg ${n <= rating ? "text-amber-500" : "text-slate-300"}`} aria-label={`${n} stars`}>★</button>
        ))}
      </div>
      <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs" />
      <button onClick={submit} disabled={busy || !rating} className="rounded bg-brand-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60">Submit</button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}

export function PortalQuoteDecision({ estimateId }: { estimateId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function decide(decision: "APPROVED" | "DECLINED") {
    setBusy(true)
    await post(`/api/portal/quotes/${estimateId}/decision`, { decision })
    setBusy(false); router.refresh()
  }
  return (
    <div className="flex gap-2">
      <button onClick={() => decide("APPROVED")} disabled={busy} className="rounded-lg bg-brand-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Approve</button>
      <button onClick={() => decide("DECLINED")} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600">Decline</button>
    </div>
  )
}
