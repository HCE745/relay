"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"

export function CollectionsHoldToggle({ invoiceId, held }: { invoiceId: string; held: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setBusy(true); setError(null)
    const res = await apiSend(`/api/invoices/${invoiceId}/collections-hold`, "PATCH", { hold: !held })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={busy}
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${held ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
      >
        {held ? "Resume collections" : "Hold collections"}
      </button>
      {held ? <span className="text-xs text-amber-700">On hold — no reminders will be sent for this invoice.</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
