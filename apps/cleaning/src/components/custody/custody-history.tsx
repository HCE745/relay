"use client"

import { useState } from "react"

type Ev = {
  id: string
  action: "CHECKED_OUT" | "CHECKED_IN" | "TRANSFERRED" | "REPORTED_LOST" | "REPLACED" | "NOT_RETURNED"
  holder: { name: string } | null
  fromUser: { name: string } | null
  job: { id: string; title: string } | null
  serviceLocation: { name: string } | null
  notes: string | null
  recordedBy: { name: string } | null
  createdAt: string
}

export function describeCustody(e: Ev): string {
  switch (e.action) {
    case "CHECKED_OUT": return `Checked out to ${e.holder?.name ?? "someone"}${e.job ? ` for ${e.job.title}` : ""}`
    case "CHECKED_IN": return `Checked in${e.fromUser ? ` by ${e.fromUser.name}` : ""}`
    case "TRANSFERRED": return `Transferred from ${e.fromUser?.name ?? "someone"} to ${e.holder?.name ?? "someone"}`
    case "REPORTED_LOST": return `Reported lost${e.fromUser ? ` (was held by ${e.fromUser.name})` : ""}`
    case "REPLACED": return "Replacement cut"
    case "NOT_RETURNED": return `Not returned at offboarding${e.fromUser ? ` (was held by ${e.fromUser.name})` : ""}`
  }
}

/** Collapsible full custody history for one item, fetched on demand. */
export function CustodyHistory({ kind, itemId }: { kind: "ACCESS" | "ASSET"; itemId: string }) {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<Ev[] | null>(null)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (events) return
    setBusy(true)
    const param = kind === "ACCESS" ? "accessItemId" : "assetId"
    const res = await fetch(`/api/custody/history?${param}=${itemId}`)
    const data = res.ok ? await res.json().catch(() => null) : null
    setBusy(false)
    setEvents(Array.isArray(data) ? data : [])
  }

  return (
    <div>
      <button onClick={toggle} className="text-xs font-medium text-brand hover:underline">{open ? "Hide history" : "History"}</button>
      {open ? (
        busy ? <p className="mt-1 text-xs text-slate-400">Loading…</p> : !events || events.length === 0 ? (
          <p className="mt-1 text-xs text-slate-400">No custody events yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 border-l-2 border-slate-100 pl-3">
            {events.map((e) => (
              <li key={e.id} className="text-xs text-slate-600">
                <span className="text-slate-800">{describeCustody(e)}</span>
                <span className="text-slate-400">
                  {" · "}{new Date(e.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {e.recordedBy ? ` · by ${e.recordedBy.name}` : ""}
                </span>
                {e.notes ? <div className="text-slate-500">{e.notes}</div> : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  )
}
