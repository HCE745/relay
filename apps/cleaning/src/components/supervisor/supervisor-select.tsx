"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"

// Assign a supervisor to a site or an employee. One compact control, reused.
export function SupervisorSelect({ endpoint, current, supervisors, label = "Supervisor" }: {
  endpoint: string
  current: string | null
  supervisors: { id: string; name: string; role: string }[]
  label?: string
}) {
  const router = useRouter()
  const [value, setValue] = useState(current ?? "")
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save(next: string) {
    setValue(next); setBusy(true); setSaved(false)
    const res = await apiSend(endpoint, "PATCH", { supervisorId: next || null })
    setBusy(false)
    if (res.ok) { setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 1500) }
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">{label}:</span>
      <select value={value} onChange={(e) => save(e.target.value)} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm">
        <option value="">Unassigned</option>
        {supervisors.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role.toLowerCase()})</option>)}
      </select>
      {saved ? <span className="text-xs text-emerald-600">Saved</span> : null}
    </label>
  )
}
