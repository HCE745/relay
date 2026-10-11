"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Field, Input } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

// Customer communications config (Phase 26): visit-reminder lead time + whether
// late-payment reminders are sent.
export function CommsForm({ visitReminderLeadHours, paymentRemindersEnabled }: { visitReminderLeadHours: number; paymentRemindersEnabled: boolean }) {
  const router = useRouter()
  const [lead, setLead] = useState(String(visitReminderLeadHours))
  const [pay, setPay] = useState(paymentRemindersEnabled)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true); setSaved(false); setError(null)
    const res = await apiSend("/api/org/settings", "PATCH", { visitReminderLeadHours: Number(lead), paymentRemindersEnabled: pay })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setSaved(true); router.refresh()
  }

  return (
    <div className="space-y-3">
      <Field label="Send visit reminders this many hours ahead" htmlFor="cm-lead" hint="per-customer opt-in, set on each customer">
        <Input id="cm-lead" type="number" min={1} max={336} value={lead} onChange={(e) => { setLead(e.target.value); setSaved(false) }} className="w-32" />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={pay} onChange={(e) => { setPay(e.target.checked); setSaved(false) }} /> Send late-payment reminders on overdue invoices
      </label>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save communications"}</Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </div>
  )
}
