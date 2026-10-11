"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Field, Input } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

// Exception-alert tuning (Phase 25): uncovered-shift lead time + missed-clock-in grace.
export function AlertsForm({ uncoveredLeadHours, missedGraceMin }: { uncoveredLeadHours: number; missedGraceMin: number }) {
  const router = useRouter()
  const [lead, setLead] = useState(String(uncoveredLeadHours))
  const [grace, setGrace] = useState(String(missedGraceMin))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true); setSaved(false); setError(null)
    const res = await apiSend("/api/org/settings", "PATCH", { uncoveredAlertLeadHours: Number(lead), missedClockInGraceMin: Number(grace) })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setSaved(true); router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Alert on uncovered shifts within (hours)" htmlFor="al-lead"><Input id="al-lead" type="number" min={1} max={336} value={lead} onChange={(e) => { setLead(e.target.value); setSaved(false) }} /></Field>
        <Field label="Missed clock-in grace (minutes)" htmlFor="al-grace" hint="after scheduled start"><Input id="al-grace" type="number" min={0} max={1440} value={grace} onChange={(e) => { setGrace(e.target.value); setSaved(false) }} /></Field>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save alert settings"}</Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
      <p className="text-xs text-slate-400">Alerts go to managers (and supervisors for missed clock-ins) by each person&apos;s notification channels.</p>
    </div>
  )
}
