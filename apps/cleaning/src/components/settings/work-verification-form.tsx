"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

// Task verification settings (P1). Two independent org-level switches:
//   • verificationRequired — completed work must be independently verified by a
//     DIFFERENT employee before it counts as verified. Off = employees complete
//     tasks normally (marked done, not verified), with optional verification.
//   • peerVerificationEnabled — lets coworkers (cleaners) verify, not only
//     managers/supervisors. Never their own work.
export function WorkVerificationForm({
  verificationRequired,
  peerVerificationEnabled,
}: {
  verificationRequired: boolean
  peerVerificationEnabled: boolean
}) {
  const router = useRouter()
  const [required, setRequired] = useState(verificationRequired)
  const [peer, setPeer] = useState(peerVerificationEnabled)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true); setSaved(false); setError(null)
    const res = await apiSend("/api/org/settings", "PATCH", {
      verificationRequired: required,
      peerVerificationEnabled: peer,
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setSaved(true); router.refresh()
  }

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" className="mt-0.5" checked={required} onChange={(e) => { setRequired(e.target.checked); setSaved(false) }} />
        <span>
          <span className="font-medium">Require independent verification</span>
          <span className="block text-xs text-slate-500">
            Completed tasks wait for a different employee to verify them. A person can never verify their own work. Off:
            employees complete tasks normally and work is marked done (not verified).
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" className="mt-0.5" checked={peer} onChange={(e) => { setPeer(e.target.checked); setSaved(false) }} />
        <span>
          <span className="font-medium">Allow peer verification</span>
          <span className="block text-xs text-slate-500">
            Let cleaners verify a coworker&apos;s completed task, not only managers and supervisors. Never their own.
          </span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save verification settings"}</Button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>
    </div>
  )
}
