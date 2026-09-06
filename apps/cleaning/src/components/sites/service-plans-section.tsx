"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Card, Field, Input, Select, StatusPill, EmptyState } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { SERVICE_FREQUENCIES } from "@/lib/zod-schemas"

export type PlanValue = {
  id: string
  name: string
  frequency: string
  crewSize: number
  isActive: boolean
  checklistTemplate: { id: string; name: string; version: number } | null
}
type TemplateOption = { id: string; name: string }

const FREQ_LABEL: Record<string, string> = {
  ONE_TIME: "One-time",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
  CUSTOM: "Custom",
}

function PlanForm({
  siteId,
  templates,
  onDone,
}: {
  siteId: string
  templates: TemplateOption[]
  onDone: () => void
}) {
  const router = useRouter()
  const [v, setV] = useState({
    name: "",
    frequency: "WEEKLY",
    crewSize: "1",
    defaultDurationMin: "",
    checklistTemplateId: "",
    startDate: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload: Record<string, unknown> = {
      serviceLocationId: siteId,
      name: v.name,
      frequency: v.frequency,
      crewSize: Number(v.crewSize),
    }
    if (v.defaultDurationMin) payload.defaultDurationMin = Number(v.defaultDurationMin)
    if (v.checklistTemplateId) payload.checklistTemplateId = v.checklistTemplateId
    if (v.startDate) payload.startDate = v.startDate
    const res = await apiSend("/api/service-plans", "POST", payload)
    setSaving(false)
    if (!res.ok) return setError(res.error)
    onDone()
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Service plan name" htmlFor="p-name" hint="e.g. Nightly janitorial">
        <Input id="p-name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Frequency" htmlFor="p-freq">
          <Select id="p-freq" value={v.frequency} onChange={(e) => setV({ ...v, frequency: e.target.value })}>
            {SERVICE_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQ_LABEL[f]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Crew size" htmlFor="p-crew">
          <Input id="p-crew" type="number" min={1} value={v.crewSize} onChange={(e) => setV({ ...v, crewSize: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Est. duration (min)" htmlFor="p-dur">
          <Input id="p-dur" type="number" min={1} value={v.defaultDurationMin} onChange={(e) => setV({ ...v, defaultDurationMin: e.target.value })} />
        </Field>
        <Field label="Start date" htmlFor="p-start">
          <Input id="p-start" type="date" value={v.startDate} onChange={(e) => setV({ ...v, startDate: e.target.value })} />
        </Field>
      </div>
      <Field label="Scope / checklist" htmlFor="p-tpl" hint={templates.length ? undefined : "Create a checklist first to attach a scope"}>
        <Select id="p-tpl" value={v.checklistTemplateId} onChange={(e) => setV({ ...v, checklistTemplateId: e.target.value })}>
          <option value="">— None —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Create service plan"}
        </Button>
      </div>
    </form>
  )
}

export function ServicePlansSection({
  siteId,
  plans,
  templates,
}: {
  siteId: string
  plans: PlanValue[]
  templates: TemplateOption[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Service plans</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          Create service plan
        </Button>
      </div>
      {plans.length === 0 ? (
        <EmptyState title="No service plans yet">Set up the recurring cleaning arrangement for this site.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {plans.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{p.name}</span>
                  <StatusPill active={p.isActive} />
                </div>
                <div className="text-xs text-slate-500">
                  {FREQ_LABEL[p.frequency] ?? p.frequency} · crew of {p.crewSize}
                  {p.checklistTemplate ? ` · ${p.checklistTemplate.name} (v${p.checklistTemplate.version})` : " · no checklist"}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Create service plan">
        <PlanForm siteId={siteId} templates={templates} onDone={() => setOpen(false)} />
      </Modal>
    </Card>
  )
}
