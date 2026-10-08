"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Card, Field, Input, Select, Textarea, StatusBadge, type BadgeTone } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { QUOTE_SOURCES, PROPERTY_TYPES, SERVICE_FREQUENCIES, QUOTE_REQUEST_STATUSES } from "@/lib/zod-schemas"

export type QuoteRow = {
  id: string; source: string; contactName: string; contactPhone: string | null; contactEmail: string | null
  city: string | null; state: string | null; propertyType: string; sqft: number | null; frequency: string | null
  status: string; outsideServiceArea: boolean; convertedLeadId: string | null; convertedEstimateId: string | null; createdAt: string
}

const SOURCE_LABEL: Record<string, string> = { PHONE: "Phone", ONLINE: "Online", IN_PERSON: "In person", REFERRAL: "Referral" }
const STATUS_TONE: Record<string, BadgeTone> = { NEW: "info", CONTACTED: "purple", QUOTED: "warning", WON: "success", LOST: "neutral" }
const FREQ_LABEL: Record<string, string> = { ONE_TIME: "One-time", DAILY: "Daily", WEEKLY: "Weekly", BIWEEKLY: "Every 2 weeks", MONTHLY: "Monthly", CUSTOM: "Custom" }

// Fast single-screen intake — for someone on the phone. Minimum fields, large targets.
export function NewQuoteButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [v, setV] = useState({ source: "PHONE", contactName: "", contactPhone: "", contactEmail: "", addressLine1: "", city: "", state: "", postalCode: "", propertyType: "RESIDENTIAL", sqft: "", frequency: "WEEKLY", notes: "" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value })

  async function save() {
    setBusy(true); setError(null)
    const res = await apiSend("/api/quote-requests", "POST", {
      source: v.source, contactName: v.contactName, contactPhone: v.contactPhone || undefined, contactEmail: v.contactEmail || undefined,
      addressLine1: v.addressLine1 || undefined, city: v.city || undefined, state: v.state || undefined, postalCode: v.postalCode || undefined,
      propertyType: v.propertyType, sqft: v.sqft ? Number(v.sqft) : undefined, frequency: v.frequency, notes: v.notes || undefined,
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setOpen(false); setV({ ...v, contactName: "", contactPhone: "", contactEmail: "", addressLine1: "", notes: "", sqft: "" }); router.refresh()
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>New quote</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New quote request">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source" htmlFor="q-src"><Select id="q-src" value={v.source} onChange={set("source")} className="py-3 text-base">{QUOTE_SOURCES.filter((s) => s !== "ONLINE").map((s) => (<option key={s} value={s}>{SOURCE_LABEL[s]}</option>))}</Select></Field>
            <Field label="Property" htmlFor="q-prop"><Select id="q-prop" value={v.propertyType} onChange={set("propertyType")} className="py-3 text-base">{PROPERTY_TYPES.map((p) => (<option key={p} value={p}>{p === "RESIDENTIAL" ? "Residential" : "Commercial"}</option>))}</Select></Field>
          </div>
          <Field label="Contact name" htmlFor="q-name"><Input id="q-name" required value={v.contactName} onChange={set("contactName")} className="py-3 text-base" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" htmlFor="q-phone"><Input id="q-phone" value={v.contactPhone} onChange={set("contactPhone")} className="py-3 text-base" inputMode="tel" /></Field>
            <Field label="Email" htmlFor="q-email"><Input id="q-email" value={v.contactEmail} onChange={set("contactEmail")} className="py-3 text-base" inputMode="email" /></Field>
          </div>
          <Field label="Address" htmlFor="q-addr"><Input id="q-addr" value={v.addressLine1} onChange={set("addressLine1")} className="py-3 text-base" /></Field>
          <div className="grid grid-cols-4 gap-2">
            <Field label="City" htmlFor="q-city"><Input id="q-city" value={v.city} onChange={set("city")} className="py-3 text-base" /></Field>
            <Field label="State" htmlFor="q-state"><Input id="q-state" value={v.state} onChange={set("state")} className="py-3 text-base" maxLength={2} /></Field>
            <Field label="ZIP" htmlFor="q-zip"><Input id="q-zip" value={v.postalCode} onChange={set("postalCode")} className="py-3 text-base" /></Field>
            <Field label="Sq ft" htmlFor="q-sqft"><Input id="q-sqft" value={v.sqft} onChange={set("sqft")} className="py-3 text-base" inputMode="numeric" /></Field>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Field label="Frequency wanted" htmlFor="q-freq"><Select id="q-freq" value={v.frequency} onChange={set("frequency")} className="py-3 text-base">{SERVICE_FREQUENCIES.map((f) => (<option key={f} value={f}>{FREQ_LABEL[f]}</option>))}</Select></Field>
          </div>
          <Field label="Notes" htmlFor="q-notes"><Textarea id="q-notes" value={v.notes} onChange={set("notes")} /></Field>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={busy || !v.contactName} size="lg">{busy ? "Saving…" : "Save quote"}</Button></div>
        </div>
      </Modal>
    </>
  )
}

function QuoteCard({ q }: { q: QuoteRow }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const converted = !!(q.convertedLeadId || q.convertedEstimateId)

  async function setStatus(status: string) { setBusy(true); await apiSend(`/api/quote-requests/${q.id}`, "PATCH", { status }); setBusy(false); router.refresh() }
  async function convert() { setBusy(true); const r = await apiSend(`/api/quote-requests/${q.id}/convert`, "POST", { toLead: true, toEstimate: true }); setBusy(false); if (r.ok) router.refresh() }

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">{q.contactName}</div>
          <div className="truncate text-xs text-slate-500">{SOURCE_LABEL[q.source]} · {q.propertyType === "COMMERCIAL" ? "Commercial" : "Residential"}{q.sqft ? ` · ${q.sqft.toLocaleString()} sqft` : ""}</div>
          <div className="truncate text-xs text-slate-400">{[q.contactPhone, q.city && q.state ? `${q.city}, ${q.state}` : null].filter(Boolean).join(" · ") || "—"}</div>
        </div>
        {q.outsideServiceArea ? <StatusBadge tone="warning">Outside area</StatusBadge> : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {converted ? (
          <StatusBadge tone="brand">Converted</StatusBadge>
        ) : (
          <>
            <Select value={q.status} onChange={(e) => setStatus(e.target.value)} className="w-32 py-1 text-xs" disabled={busy}>{QUOTE_REQUEST_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}</Select>
            <Button size="sm" variant="secondary" onClick={convert} disabled={busy}>Convert → Lead + Estimate</Button>
          </>
        )}
      </div>
    </Card>
  )
}

export function QuotesClient({ quotes }: { quotes: QuoteRow[] }) {
  const cols = QUOTE_REQUEST_STATUSES
  const byStatus = (s: string) => quotes.filter((q) => q.status === s && !(q.convertedLeadId || q.convertedEstimateId))
  const convertedList = quotes.filter((q) => q.convertedLeadId || q.convertedEstimateId)
  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-5">
        {cols.map((s) => (
          <div key={s}>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <StatusBadge tone={STATUS_TONE[s]}>{s}</StatusBadge><span className="text-slate-400">{byStatus(s).length}</span>
            </div>
            <div className="space-y-2">
              {byStatus(s).map((q) => <QuoteCard key={q.id} q={q} />)}
              {byStatus(s).length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-300">—</div> : null}
            </div>
          </div>
        ))}
      </div>
      {convertedList.length > 0 ? (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Converted</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{convertedList.map((q) => <QuoteCard key={q.id} q={q} />)}</div>
        </div>
      ) : null}
    </div>
  )
}
