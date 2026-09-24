"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { SERVICE_FREQUENCIES, ESTIMATE_PRICING } from "@/lib/zod-schemas"

type Option = { id: string; name: string; company?: string | null }
type Template = { id: string; name: string; items: { label: string }[] }
type LineDraft = { description: string; quantity: string; unitRate: string }

export type EstimateInitial = {
  id: string
  title: string
  leadId: string | null
  customerId: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  siteName: string | null
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  frequency: string
  pricing: string
  rate: string | null
  currency: string
  checklistTemplateId: string | null
  validUntil: string | null
  notes: string | null
  lines: { description: string; quantity: string; unitRate: string }[]
}

const FREQ_LABEL: Record<string, string> = {
  ONE_TIME: "One-time", DAILY: "Daily", WEEKLY: "Weekly", BIWEEKLY: "Every 2 weeks", MONTHLY: "Monthly", CUSTOM: "Custom",
}
const money = (n: number) => `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`

export function EstimateBuilder({
  mode,
  estimateId,
  initial,
  leads,
  customers,
  templates,
  presetLeadId,
}: {
  mode: "create" | "edit"
  estimateId?: string
  initial?: EstimateInitial
  leads: Option[]
  customers: Option[]
  templates: Template[]
  presetLeadId?: string
}) {
  const router = useRouter()
  const [v, setV] = useState({
    title: initial?.title ?? "",
    leadId: initial?.leadId ?? presetLeadId ?? "",
    customerId: initial?.customerId ?? "",
    contactName: initial?.contactName ?? "",
    contactEmail: initial?.contactEmail ?? "",
    contactPhone: initial?.contactPhone ?? "",
    siteName: initial?.siteName ?? "",
    addressLine1: initial?.addressLine1 ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    postalCode: initial?.postalCode ?? "",
    frequency: initial?.frequency ?? "WEEKLY",
    pricing: initial?.pricing ?? "PER_VISIT",
    rate: initial?.rate ?? "",
    checklistTemplateId: initial?.checklistTemplateId ?? "",
    validUntil: initial?.validUntil ?? "",
    notes: initial?.notes ?? "",
  })
  const [lines, setLines] = useState<LineDraft[]>(
    initial?.lines?.length ? initial.lines : [{ description: "", quantity: "1", unitRate: "" }],
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }))
  const setLine = (i: number, k: keyof LineDraft, val: string) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: val } : l)))
  const addLine = () => setLines((ls) => [...ls, { description: "", quantity: "1", unitRate: "" }])
  const removeLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))

  const fillFromTemplate = () => {
    const tpl = templates.find((t) => t.id === v.checklistTemplateId)
    if (!tpl || tpl.items.length === 0) return
    setLines(tpl.items.map((it) => ({ description: it.label, quantity: "1", unitRate: "" })))
  }

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitRate) || 0), 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      title: v.title,
      leadId: v.leadId || undefined,
      customerId: v.customerId || undefined,
      contactName: v.contactName || undefined,
      contactEmail: v.contactEmail || undefined,
      contactPhone: v.contactPhone || undefined,
      siteName: v.siteName || undefined,
      addressLine1: v.addressLine1 || undefined,
      city: v.city || undefined,
      state: v.state || undefined,
      postalCode: v.postalCode || undefined,
      frequency: v.frequency,
      pricing: v.pricing,
      rate: v.rate.trim() || undefined,
      validUntil: v.validUntil || undefined,
      checklistTemplateId: v.checklistTemplateId || undefined,
      notes: v.notes || undefined,
      lines: lines
        .filter((l) => l.description.trim())
        .map((l) => ({ description: l.description.trim(), quantity: l.quantity || "1", unitRate: l.unitRate || "0" })),
    }
    const res =
      mode === "edit" && estimateId
        ? await apiSend<{ id: string }>(`/api/estimates/${estimateId}`, "PATCH", payload)
        : await apiSend<{ id: string }>("/api/estimates", "POST", payload)
    setSaving(false)
    if (!res.ok) return setError(res.error)
    router.push(`/estimates/${res.data.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="space-y-4 p-5">
        <Field label="Estimate title" htmlFor="e-title" hint="e.g. Nightly janitorial — Acme HQ">
          <Input id="e-title" required value={v.title} onChange={set("title")} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="From lead" htmlFor="e-lead" hint="Optional — links this estimate to a lead">
            <Select id="e-lead" value={v.leadId} onChange={set("leadId")}>
              <option value="">— None —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.company ? `${l.company} — ${l.name}` : l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Existing customer" htmlFor="e-cust" hint="Set only if billing an existing customer">
            <Select id="e-cust" value={v.customerId} onChange={set("customerId")}>
              <option value="">— New customer on convert —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Customer & site (used to create the account on convert)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Contact name" htmlFor="e-cname"><Input id="e-cname" value={v.contactName} onChange={set("contactName")} /></Field>
          <Field label="Contact email" htmlFor="e-cemail"><Input id="e-cemail" type="email" value={v.contactEmail} onChange={set("contactEmail")} /></Field>
          <Field label="Contact phone" htmlFor="e-cphone"><Input id="e-cphone" value={v.contactPhone} onChange={set("contactPhone")} /></Field>
          <Field label="Site name" htmlFor="e-sname"><Input id="e-sname" value={v.siteName} onChange={set("siteName")} placeholder="Main site" /></Field>
          <Field label="Address" htmlFor="e-addr"><Input id="e-addr" value={v.addressLine1} onChange={set("addressLine1")} /></Field>
          <Field label="City" htmlFor="e-city"><Input id="e-city" value={v.city} onChange={set("city")} /></Field>
          <Field label="State" htmlFor="e-state"><Input id="e-state" value={v.state} onChange={set("state")} /></Field>
          <Field label="Postal code" htmlFor="e-zip"><Input id="e-zip" value={v.postalCode} onChange={set("postalCode")} /></Field>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700">Pricing & recurrence</h2>
          <div className="flex items-end gap-2">
            <Field label="Scope of work" htmlFor="e-tpl" hint="Carries to the plan; can seed line items">
              <Select id="e-tpl" value={v.checklistTemplateId} onChange={set("checklistTemplateId")}>
                <option value="">— None —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>
            <Button type="button" variant="secondary" size="sm" onClick={fillFromTemplate} disabled={!v.checklistTemplateId}>
              Seed line items
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field label="Frequency" htmlFor="e-freq">
            <Select id="e-freq" value={v.frequency} onChange={set("frequency")}>
              {SERVICE_FREQUENCIES.map((f) => (<option key={f} value={f}>{FREQ_LABEL[f]}</option>))}
            </Select>
          </Field>
          <Field label="Pricing" htmlFor="e-pricing">
            <Select id="e-pricing" value={v.pricing} onChange={set("pricing")}>
              {ESTIMATE_PRICING.map((p) => (<option key={p} value={p}>{p === "HOURLY" ? "Hourly" : "Per visit"}</option>))}
            </Select>
          </Field>
          <Field
            label={v.pricing === "HOURLY" ? "Hourly rate" : "Per-visit price"}
            htmlFor="e-rate"
            hint={v.pricing === "HOURLY" ? "Required to convert" : "Optional — defaults to total"}
          >
            <Input id="e-rate" inputMode="decimal" value={v.rate} onChange={set("rate")} placeholder="0.00" />
          </Field>
          <Field label="Valid until" htmlFor="e-valid"><Input id="e-valid" type="date" value={v.validUntil} onChange={set("validUntil")} /></Field>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Line items</h2>
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>Add line</Button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => {
            const amt = (Number(l.quantity) || 0) * (Number(l.unitRate) || 0)
            return (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <input className="col-span-6 rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Description" value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} />
                <input className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" inputMode="decimal" placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} />
                <input className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" inputMode="decimal" placeholder="Rate" value={l.unitRate} onChange={(e) => setLine(i, "unitRate", e.target.value)} />
                <div className="col-span-1 text-right text-sm tabular-nums text-slate-600">{money(amt)}</div>
                <button type="button" onClick={() => removeLine(i)} className="col-span-1 text-slate-400 hover:text-red-600" aria-label="Remove line">✕</button>
              </div>
            )
          })}
        </div>
        <div className="flex justify-end border-t border-slate-100 pt-2 text-sm font-semibold text-slate-900">
          Total: <span className="ml-2 tabular-nums">{money(total)}</span>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <Field label="Notes (shown on the estimate)" htmlFor="e-notes"><Textarea id="e-notes" value={v.notes} onChange={set("notes")} /></Field>
      </Card>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : mode === "edit" ? "Save estimate" : "Create estimate"}</Button>
      </div>
    </form>
  )
}

/** Wrapper so the builder can also be opened in a modal if needed later. */
export function BuilderModal(props: Parameters<typeof EstimateBuilder>[0] & { open: boolean; onClose: () => void }) {
  const { open, onClose, ...rest } = props
  return (
    <Modal open={open} onClose={onClose} title="Estimate">
      <EstimateBuilder {...rest} />
    </Modal>
  )
}
