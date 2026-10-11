"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Extra = { id: string; description: string; amount: string }

// Customer self-service approval of billable extras (Phase 20). Degrades to
// manager-records-approval on the staff side when the portal isn't used.
export function PortalExtras({ extras }: { extras: Extra[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function decide(id: string, decision: "APPROVED" | "DECLINED") {
    setBusy(id)
    await fetch(`/api/portal/change-orders/${id}/decision`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }),
    })
    setBusy(null)
    router.refresh()
  }

  return (
    <ul className="divide-y divide-slate-100">
      {extras.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
          <div className="min-w-0">
            <span className="font-medium text-slate-800">{e.description}</span>
            <span className="ml-2 tabular-nums text-slate-600">${e.amount}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => decide(e.id, "APPROVED")} disabled={busy === e.id} className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Approve</button>
            <button onClick={() => decide(e.id, "DECLINED")} disabled={busy === e.id} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60">Decline</button>
          </div>
        </li>
      ))}
    </ul>
  )
}
