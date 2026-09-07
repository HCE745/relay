"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DateTime } from "luxon"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Textarea } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export function ApproveButton({ entryId }: { entryId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function approve() {
    setBusy(true)
    const res = await apiSend(`/api/time/${entryId}/approve`, "POST")
    setBusy(false)
    if (res.ok) router.refresh()
    else alert(res.error)
  }
  return (
    <Button size="sm" onClick={approve} disabled={busy}>
      {busy ? "…" : "Approve"}
    </Button>
  )
}

// datetime-local <-> instant conversions go through the site timezone (never
// the browser's local zone) so a manager edits the time the cleaner saw.
const toLocalInput = (iso: string | null, tz: string) =>
  iso ? DateTime.fromISO(iso).setZone(tz).toFormat("yyyy-MM-dd'T'HH:mm") : ""

export function CorrectButton({
  entryId,
  tz,
  clockInIso,
  clockOutIso,
}: {
  entryId: string
  tz: string
  clockInIso: string
  clockOutIso: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [clockIn, setClockIn] = useState(toLocalInput(clockInIso, tz))
  const [clockOut, setClockOut] = useState(toLocalInput(clockOutIso, tz))
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const payload: Record<string, unknown> = { reason }
    if (clockIn) payload.clockInAt = DateTime.fromISO(clockIn, { zone: tz }).toISO()
    if (clockOut) payload.clockOutAt = DateTime.fromISO(clockOut, { zone: tz }).toISO()
    const res = await apiSend(`/api/time/${entryId}/correct`, "PATCH", payload)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Correct
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Correct time entry">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-xs text-slate-500">Times are in the site timezone ({tz}). Correcting an approved entry clears its approval.</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Clock in" htmlFor="c-in">
              <Input id="c-in" type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
            </Field>
            <Field label="Clock out" htmlFor="c-out">
              <Input id="c-out" type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
            </Field>
          </div>
          <Field label="Reason (required)" htmlFor="c-reason">
            <Textarea id="c-reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !reason.trim()}>
              {busy ? "Saving…" : "Save correction"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
