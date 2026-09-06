"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Select, Textarea } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type Option = { id: string; name: string }

export function NewJobButton({ sites, templates }: { sites: Option[]; templates: Option[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [v, setV] = useState({
    serviceLocationId: "",
    title: "",
    date: "",
    startTime: "09:00",
    durationMin: "",
    crewSize: "1",
    checklistTemplateId: "",
    notes: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!v.serviceLocationId) return setError("Choose a service location")
    setSaving(true)
    setError(null)
    const payload: Record<string, unknown> = {
      serviceLocationId: v.serviceLocationId,
      title: v.title,
      date: v.date,
      startTime: v.startTime,
      crewSize: Number(v.crewSize),
    }
    if (v.durationMin) payload.durationMin = Number(v.durationMin)
    if (v.checklistTemplateId) payload.checklistTemplateId = v.checklistTemplateId
    if (v.notes) payload.notes = v.notes
    const res = await apiSend<{ id: string }>("/api/jobs", "POST", payload)
    setSaving(false)
    if (!res.ok) return setError(res.error)
    setOpen(false)
    router.push(`/jobs/${res.data.id}`)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>New job</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New one-time job">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Service location" htmlFor="j-site">
            <Select id="j-site" value={v.serviceLocationId} onChange={set("serviceLocationId")}>
              <option value="">— Choose a site —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Job title" htmlFor="j-title" hint="e.g. Move-out deep clean">
            <Input id="j-title" required value={v.title} onChange={set("title")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date" htmlFor="j-date">
              <Input id="j-date" type="date" required value={v.date} onChange={set("date")} />
            </Field>
            <Field label="Start time" htmlFor="j-time">
              <Input id="j-time" type="time" required value={v.startTime} onChange={set("startTime")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Duration (min)" htmlFor="j-dur">
              <Input id="j-dur" type="number" min={1} value={v.durationMin} onChange={set("durationMin")} />
            </Field>
            <Field label="Crew size" htmlFor="j-crew">
              <Input id="j-crew" type="number" min={1} value={v.crewSize} onChange={set("crewSize")} />
            </Field>
          </div>
          <Field label="Scope / checklist (optional)" htmlFor="j-tpl">
            <Select id="j-tpl" value={v.checklistTemplateId} onChange={set("checklistTemplateId")}>
              <option value="">— None —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor="j-notes">
            <Textarea id="j-notes" value={v.notes} onChange={set("notes")} />
          </Field>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create job"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
