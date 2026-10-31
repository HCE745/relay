"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Field, Input } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

// Labor burden (Phase 43): a percent applied to labor for costing/profitability.
export function BurdenForm({ currentPct }: { currentPct: number }) {
  const router = useRouter()
  const [pct, setPct] = useState(String(currentPct))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true); setSaved(false); setError(null)
    const res = await apiSend("/api/org/settings", "PATCH", { laborBurdenPct: pct })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setSaved(true); router.refresh()
  }

  return (
    <div className="space-y-3">
      <Field label="Labor burden (%)" htmlFor="lb-pct" hint="employer taxes, insurance, workers comp">
        <Input id="lb-pct" value={pct} onChange={(e) => { setPct(e.target.value); setSaved(false) }} placeholder="25" className="max-w-[12rem]" />
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save burden"}</Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
      <p className="text-xs text-slate-400">Applied to labor cost in profitability only (not payroll). 0 shows unburdened labor; the pre-burden figure stays visible in reports.</p>
    </div>
  )
}
