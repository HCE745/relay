"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Textarea } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export function JobActions({
  jobId,
  initial,
  cancelled,
}: {
  jobId: string
  initial: { title: string; date: string; startTime: string; crewSize: number | null; notes: string | null }
  cancelled: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [v, setV] = useState({
    title: initial.title,
    date: initial.date,
    startTime: initial.startTime,
    crewSize: initial.crewSize ? String(initial.crewSize) : "",
    notes: initial.notes ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload: Record<string, unknown> = { title: v.title, notes: v.notes, date: v.date, startTime: v.startTime }
    if (v.crewSize) payload.crewSize = Number(v.crewSize)
    const res = await apiSend(`/api/jobs/${jobId}`, "PATCH", payload)
    setSaving(false)
    if (!res.ok) return setError(res.error)
    setOpen(false)
    router.refresh()
  }

  async function cancelJob() {
    if (!confirm("Cancel this job?")) return
    const res = await apiSend(`/api/jobs/${jobId}/cancel`, "POST")
    if (res.ok) router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {!cancelled ? (
        <Button variant="danger" size="sm" onClick={cancelJob}>
          Cancel job
        </Button>
      ) : null}

      <Modal open={open} onClose={() => setOpen(false)} title="Edit job">
        <form onSubmit={save} className="space-y-4">
          <Field label="Title" htmlFor="e-title">
            <Input id="e-title" required value={v.title} onChange={set("title")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date" htmlFor="e-date" hint="Reschedules this job only">
              <Input id="e-date" type="date" value={v.date} onChange={set("date")} />
            </Field>
            <Field label="Start time" htmlFor="e-time">
              <Input id="e-time" type="time" value={v.startTime} onChange={set("startTime")} />
            </Field>
          </div>
          <Field label="Crew size" htmlFor="e-crew">
            <Input id="e-crew" type="number" min={1} value={v.crewSize} onChange={set("crewSize")} />
          </Field>
          <Field label="Notes" htmlFor="e-notes">
            <Textarea id="e-notes" value={v.notes} onChange={set("notes")} />
          </Field>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
