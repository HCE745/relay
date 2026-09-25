"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Field, Input } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

// Configurable lead time for the expiring-contracts dashboard warning.
export function ContractExpiryForm({ current }: { current: number }) {
  const router = useRouter()
  const [days, setDays] = useState(String(current))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setSaved(false)
    setError(null)
    const res = await apiSend("/api/org/settings", "PATCH", { contractExpiryLeadDays: Number(days) })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <Field label="Warn me this many days before a contract expires" htmlFor="k-lead" hint="Active contracts ending within this window show on the dashboard (1–365).">
        <Input
          id="k-lead"
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(e) => {
            setDays(e.target.value)
            setSaved(false)
          }}
          className="w-32"
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy || days === String(current) || !days}>
          {busy ? "Saving…" : "Save lead time"}
        </Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </div>
  )
}
