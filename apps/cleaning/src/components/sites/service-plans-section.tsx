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
  startTime: string | null
  crewSize: number
  defaultDurationMin: number | null
  rrule: string | null
  startDate: string | Date | null
  endDate: string | Date | null
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

const toDateInput = (d: string | Date | null): string => {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

function PlanForm({
  siteId,
  templates,
  initial,
  onDone,
}: {
  siteId: string
  templates: TemplateOption[]
  initial?: PlanValue
  onDone: () => void
}) {
  const router = useRouter()
  const [v, setV] = useState({
    name: initial?.name ?? "",
    frequency: initial?.frequency ?? "WEEKLY",
    startTime: initial?.startTime ?? "09:00",
    crewSize: String(initial?.crewSize ?? 1),
    defaultDurationMin: initial?.defaultDurationMin ? String(initial.defaultDurationMin) : "",
    checklistTemplateId: initial?.checklistTemplate?.id ?? "",
    startDate: toDateInput(initial?.startDate ?? null),
    endDate: toDateInput(initial?.endDate ?? null),
    rrule: initial?.rrule ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload: Record<string, unknown> = {
      name: v.name,
      frequency: v.frequency,
      startTime: v.startTime,
      crewSize: Number(v.crewSize),
    }
    if (!initial) payload.serviceLocationId = siteId
    if (v.defaultDurationMin) payload.defaultDurationMin = Number(v.defaultDurationMin)
    payload.checklistTemplateId = v.checklistTemplateId || undefined
    if (v.startDate) payload.startDate = v.startDate
    if (v.endDate) payload.endDate = v.endDate
    if (v.frequency === "CUSTOM" && v.rrule) payload.rrule = v.rrule

    const res = initial
      ? await apiSend(`/api/service-plans/${initial.id}`, "PATCH", payload)
      : await apiSend("/api/service-plans", "POST", payload)
    setSaving(false)
    if (!res.ok) return setError(res.error)
    onDone()
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Service plan name" htmlFor="p-name" hint="e.g. Nightly janitorial">
        <Input id="p-name" required value={v.name} onChange={set("name")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Frequency" htmlFor="p-freq">
          <Select id="p-freq" value={v.frequency} onChange={set("frequency")}>
            {SERVICE_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQ_LABEL[f]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start time" htmlFor="p-time" hint="Local site time">
          <Input id="p-time" type="time" value={v.startTime} onChange={set("startTime")} />
        </Field>
      </div>
      {v.frequency === "CUSTOM" ? (
        <Field label="Custom rule (RRULE)" htmlFor="p-rrule" hint="Advanced — e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR">
          <Input id="p-rrule" value={v.rrule} onChange={set("rrule")} />
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <Field label="First service date" htmlFor="p-start">
          <Input id="p-start" type="date" value={v.startDate} onChange={set("startDate")} />
        </Field>
        <Field label="End date (optional)" htmlFor="p-end">
          <Input id="p-end" type="date" value={v.endDate} onChange={set("endDate")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Crew size" htmlFor="p-crew">
          <Input id="p-crew" type="number" min={1} value={v.crewSize} onChange={set("crewSize")} />
        </Field>
        <Field label="Est. duration (min)" htmlFor="p-dur">
          <Input id="p-dur" type="number" min={1} value={v.defaultDurationMin} onChange={set("defaultDurationMin")} />
        </Field>
      </div>
      <Field label="Scope / checklist" htmlFor="p-tpl" hint={templates.length ? undefined : "Create a checklist first to attach a scope"}>
        <Select id="p-tpl" value={v.checklistTemplateId} onChange={set("checklistTemplateId")}>
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
          {saving ? "Saving…" : initial ? "Save plan" : "Create service plan"}
        </Button>
      </div>
    </form>
  )
}

function GenerateDialog({ plan, onDone }: { plan: PlanValue; onDone: () => void }) {
  const router = useRouter()
  const [days, setDays] = useState("30")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setBusy(true)
    setError(null)
    const res = await apiSend<{ created: number; skipped: number; total: number }>(
      `/api/service-plans/${plan.id}/generate`,
      "POST",
      { days: Number(days) },
    )
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setResult(`Created ${res.data.created} job${res.data.created === 1 ? "" : "s"}, skipped ${res.data.skipped} existing.`)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Generate concrete jobs from <span className="font-medium">{plan.name}</span>. Re-running is safe — existing
        jobs are never duplicated.
      </p>
      <Field label="Horizon" htmlFor="g-days">
        <Select id="g-days" value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="30">Next 30 days</option>
          <option value="60">Next 60 days</option>
          <option value="90">Next 90 days</option>
        </Select>
      </Field>
      {result ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{result}</p> : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {result ? "Close" : "Cancel"}
        </Button>
        <Button type="button" disabled={busy} onClick={generate}>
          {busy ? "Generating…" : "Generate jobs"}
        </Button>
      </div>
    </div>
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
  const [dialog, setDialog] = useState<
    { mode: "new" } | { mode: "edit"; plan: PlanValue } | { mode: "generate"; plan: PlanValue } | null
  >(null)

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Service plans</h2>
        <Button size="sm" onClick={() => setDialog({ mode: "new" })}>
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
                  {FREQ_LABEL[p.frequency] ?? p.frequency} at {p.startTime ?? "09:00"} · crew of {p.crewSize}
                  {p.checklistTemplate ? ` · ${p.checklistTemplate.name} (v${p.checklistTemplate.version})` : " · no checklist"}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="secondary" size="sm" onClick={() => setDialog({ mode: "generate", plan: p })}>
                  Generate jobs
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDialog({ mode: "edit", plan: p })}>
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog?.mode === "generate"
            ? "Generate jobs"
            : dialog?.mode === "edit"
              ? "Edit service plan"
              : "Create service plan"
        }
      >
        {dialog?.mode === "generate" ? (
          <GenerateDialog plan={dialog.plan} onDone={() => setDialog(null)} />
        ) : dialog ? (
          <PlanForm
            siteId={siteId}
            templates={templates}
            initial={dialog.mode === "edit" ? dialog.plan : undefined}
            onDone={() => setDialog(null)}
          />
        ) : null}
      </Modal>
    </Card>
  )
}
