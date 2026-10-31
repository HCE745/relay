"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Field, Input } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

// Automatic corrective work orders (Phase 42): rule + due-day config.
export function CorrectiveForm({
  enabled, criticalOnly, dueStandard, dueCritical,
}: { enabled: boolean; criticalOnly: boolean; dueStandard: number; dueCritical: number }) {
  const router = useRouter()
  const [on, setOn] = useState(enabled)
  const [critOnly, setCritOnly] = useState(criticalOnly)
  const [std, setStd] = useState(String(dueStandard))
  const [crit, setCrit] = useState(String(dueCritical))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true); setSaved(false); setError(null)
    const res = await apiSend("/api/org/settings", "PATCH", {
      autoCorrectiveWorkOrders: on,
      correctiveOnCriticalOnly: critOnly,
      correctiveDueDaysStandard: Number(std),
      correctiveDueDaysCritical: Number(crit),
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setSaved(true); router.refresh()
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); setSaved(false) }} />
        Automatically create a corrective work order when an inspection fails
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={critOnly} disabled={!on} onChange={(e) => { setCritOnly(e.target.checked); setSaved(false) }} />
        Only when a <strong className="font-medium">critical</strong> item fails (not every failed inspection)
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Due within (days) — standard" htmlFor="cf-std"><Input id="cf-std" type="number" min={1} max={60} value={std} disabled={!on} onChange={(e) => { setStd(e.target.value); setSaved(false) }} /></Field>
        <Field label="Due within (days) — critical failure" htmlFor="cf-crit"><Input id="cf-crit" type="number" min={1} max={60} value={crit} disabled={!on} onChange={(e) => { setCrit(e.target.value); setSaved(false) }} /></Field>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save corrective settings"}</Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
      <p className="text-xs text-slate-400">Corrective work orders are non-billable by default (rework is on you) and must be verified by someone other than whoever resolved them.</p>
    </div>
  )
}
