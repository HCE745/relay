"use client"

import { useState } from "react"

// Pay-period export: pick a date range, download approved-time CSV for it.
export function ExportBar() {
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(today)

  const href = `/api/time/export?from=${from}&to=${new Date(`${to}T23:59:59`).toISOString()}`

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-slate-500">
        From
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="block rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="text-xs text-slate-500">
        To
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="block rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <a href={href} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
        Export approved (CSV)
      </a>
    </div>
  )
}
