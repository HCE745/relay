"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Field, Input } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

// Org overtime rules (Phase 24). Hours + multiplier only — never payroll.
export function OvertimeForm({ weekly, daily, multiplier }: { weekly: number | null; daily: number | null; multiplier: string }) {
  const router = useRouter()
  const [w, setW] = useState(weekly == null ? "" : String(weekly))
  const [d, setD] = useState(daily == null ? "" : String(daily))
  const [m, setM] = useState(multiplier)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true); setSaved(false); setError(null)
    const res = await apiSend("/api/org/settings", "PATCH", {
      otWeeklyThresholdHours: w === "" ? null : Number(w),
      otDailyThresholdHours: d === "" ? null : Number(d),
      otMultiplier: m,
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setSaved(true); router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Weekly OT after (hours)" htmlFor="ot-w" hint="blank = off"><Input id="ot-w" type="number" min={0} max={168} value={w} onChange={(e) => { setW(e.target.value); setSaved(false) }} placeholder="40" /></Field>
        <Field label="Daily OT after (hours)" htmlFor="ot-d" hint="blank = off"><Input id="ot-d" type="number" min={0} max={24} value={d} onChange={(e) => { setD(e.target.value); setSaved(false) }} placeholder="— off —" /></Field>
        <Field label="OT multiplier" htmlFor="ot-m" hint="1.5 = time-and-a-half"><Input id="ot-m" value={m} onChange={(e) => { setM(e.target.value); setSaved(false) }} inputMode="decimal" /></Field>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save overtime rules"}</Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
      <p className="text-xs text-slate-400">Overtime is computed from approved time per employee per week. Hours and premium only — payroll itself stays in your payroll system.</p>
    </div>
  )
}
