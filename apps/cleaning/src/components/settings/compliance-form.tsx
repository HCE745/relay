"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Field, Input } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export function ComplianceForm({ currentLeadDays, currentBlock }: { currentLeadDays: number; currentBlock: boolean }) {
  const router = useRouter()
  const [days, setDays] = useState(String(currentLeadDays))
  const [block, setBlock] = useState(currentBlock)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true); setSaved(false); setError(null)
    const res = await apiSend("/api/org/settings", "PATCH", { credentialExpiryLeadDays: Number(days), blockAssignmentOnExpiredCredential: block })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setSaved(true); router.refresh()
  }

  return (
    <div className="space-y-3">
      <Field label="Warn this many days before a credential expires" htmlFor="k-clead" hint="1–365">
        <Input id="k-clead" type="number" min={1} max={365} value={days} onChange={(e) => { setDays(e.target.value); setSaved(false) }} className="w-32" />
      </Field>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={block} onChange={(e) => { setBlock(e.target.checked); setSaved(false) }} className="h-4 w-4 rounded border-slate-300" />
        Block assigning a cleaner who is missing/expired on a site-required credential (otherwise warn)
      </label>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save compliance settings"}</Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </div>
  )
}
