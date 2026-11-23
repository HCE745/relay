"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export type SiteOption = { id: string; label: string }
export type TemplateOption = { id: string; name: string }
export type InspectorOption = { id: string; name: string }

type Lists = { sites: SiteOption[]; templates: TemplateOption[]; inspectors: InspectorOption[] }

function SitePicker({ sites, value, onChange }: { sites: SiteOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Site">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select a site…</option>
        {sites.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </Select>
    </Field>
  )
}
function TemplatePicker({ templates, value, onChange }: { templates: TemplateOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Checklist (template)">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select a template…</option>
        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
    </Field>
  )
}

// Start an ad-hoc inspection at a site and jump straight into scoring it.
export function NewInspectionButton({ sites, templates, inspectors }: Lists) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [site, setSite] = useState("")
  const [template, setTemplate] = useState("")
  const [inspector, setInspector] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!site || !template) return setError("Pick a site and a template")
    setBusy(true); setError(null)
    const res = await apiSend<{ id: string }>("/api/inspections", "POST", { serviceLocationId: site, templateId: template, inspectorId: inspector || undefined })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setOpen(false)
    router.push(`/inspections/${res.data.id}`)
  }

  const disabled = sites.length === 0 || templates.length === 0
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled} title={disabled ? "Add a site and a template first" : undefined}>New inspection</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New inspection">
        <form onSubmit={submit} className="space-y-4">
          <SitePicker sites={sites} value={site} onChange={setSite} />
          <TemplatePicker templates={templates} value={template} onChange={setTemplate} />
          <Field label="Inspector" hint="Defaults to you">
            <Select value={inspector} onChange={(e) => setInspector(e.target.value)}>
              <option value="">Me</option>
              {inspectors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Starting…" : "Start inspection"}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// Create a recurring / scheduled inspection, optionally with a random inspector.
export function ScheduleInspectionButton({ sites, templates, inspectors }: Lists) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [site, setSite] = useState("")
  const [template, setTemplate] = useState("")
  const [cadence, setCadence] = useState("WEEKLY")
  const [firstRun, setFirstRun] = useState("")
  const [lead, setLead] = useState("24")
  const [randomize, setRandomize] = useState(false)
  const [assigned, setAssigned] = useState("")
  const [pool, setPool] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const togglePool = (id: string) => setPool((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!site || !template || !firstRun) return setError("Pick a site, template and first date")
    if (randomize && pool.length === 0) return setError("Add at least one inspector to the random pool")
    setBusy(true); setError(null)
    const res = await apiSend("/api/scheduled-inspections", "POST", {
      serviceLocationId: site, templateId: template, cadence,
      firstRunAt: new Date(firstRun + "T09:00:00").toISOString(),
      reminderLeadHours: Number(lead) || 24,
      randomizeInspector: randomize,
      inspectorPoolIds: randomize ? pool : [],
      assignedInspectorId: randomize ? null : assigned || null,
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setOpen(false)
    setSite(""); setTemplate(""); setFirstRun(""); setPool([]); setAssigned("")
    router.refresh()
  }

  const disabled = sites.length === 0 || templates.length === 0
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} disabled={disabled}>Schedule</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Schedule inspections">
        <form onSubmit={submit} className="space-y-4">
          <SitePicker sites={sites} value={site} onChange={setSite} />
          <TemplatePicker templates={templates} value={template} onChange={setTemplate} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Repeats">
              <Select value={cadence} onChange={(e) => setCadence(e.target.value)}>
                <option value="ONCE">Once</option>
                <option value="WEEKLY">Weekly</option>
                <option value="BIWEEKLY">Every 2 weeks</option>
                <option value="MONTHLY">Monthly</option>
              </Select>
            </Field>
            <Field label="First inspection">
              <Input type="date" value={firstRun} onChange={(e) => setFirstRun(e.target.value)} />
            </Field>
          </div>
          <Field label="Remind inspector (hours before)">
            <Input type="number" min={0} max={168} value={lead} onChange={(e) => setLead(e.target.value)} />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={randomize} onChange={(e) => setRandomize(e.target.checked)} />
            Assign a random inspector from a pool each time
          </label>

          {randomize ? (
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 text-xs font-semibold text-slate-600">Eligible inspectors</div>
              <div className="grid grid-cols-2 gap-1.5">
                {inspectors.map((i) => (
                  <label key={i.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={pool.includes(i.id)} onChange={() => togglePool(i.id)} />
                    {i.name}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <Field label="Inspector" hint="Who runs each inspection">
              <Select value={assigned} onChange={(e) => setAssigned(e.target.value)}>
                <option value="">Any (managers notified)</option>
                {inspectors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </Field>
          )}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create schedule"}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

export function ScheduleRowActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function toggle() {
    setBusy(true)
    await apiSend(`/api/scheduled-inspections/${id}`, "PATCH", { active: !active })
    setBusy(false); router.refresh()
  }
  async function remove() {
    if (!confirm("Delete this inspection schedule? Existing inspections are kept.")) return
    setBusy(true)
    await apiSend(`/api/scheduled-inspections/${id}`, "DELETE")
    setBusy(false); router.refresh()
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={toggle} disabled={busy} className="text-xs font-medium text-slate-600 hover:text-slate-900">
        {active ? "Pause" : "Resume"}
      </button>
      <button onClick={remove} disabled={busy} className="text-xs font-medium text-red-600 hover:text-red-700">Delete</button>
    </div>
  )
}
