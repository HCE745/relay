"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"

type Site = { id: string; name: string }

// Portal issue reporting — posts to /api/portal/issues, which enforces that the
// site belongs to the signed-in customer.
export function ReportIssue({ sites }: { sites: Site[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serviceLocationId, setSite] = useState(sites[0]?.id ?? "")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await apiSend("/api/portal/issues", "POST", { serviceLocationId, title: title || undefined, description })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setDone(true); setTitle(""); setDescription(""); router.refresh()
  }

  if (sites.length === 0) return null
  if (!open) return <button onClick={() => { setOpen(true); setDone(false) }} className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Report an issue</button>

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Report an issue</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400">Close</button>
      </div>
      {done ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Thanks — your issue has been sent to the team.</p> : null}
      <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Site</span>
        <select value={serviceLocationId} onChange={(e) => setSite(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">{sites.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}</select></label>
      <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">Subject (optional)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
      <label className="block text-sm"><span className="mb-1 block font-medium text-slate-600">What&apos;s wrong?</span>
        <textarea required value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={busy || !serviceLocationId} className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Sending…" : "Send"}</button>
    </form>
  )
}
