"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"

export function CollectionsOptOutToggle({ customerId, optedOut }: { customerId: string; optedOut: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setBusy(true); setError(null)
    const res = await apiSend(`/api/customers/${customerId}/collections-opt-out`, "PATCH", { optOut: !optedOut })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={optedOut} disabled={busy} onChange={toggle} />
      Exclude from the collections sequence
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  )
}
