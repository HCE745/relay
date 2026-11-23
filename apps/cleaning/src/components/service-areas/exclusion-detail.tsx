"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select, Textarea, StatusBadge } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export type ExclusionDetail = {
  id: string
  address: string
  reason: string
  note: string | null
  status: "ACTIVE" | "LIFTED"
  isPropertySpecific: boolean
  incidentDate: string | null
  occupantName: string | null
  occupantPhone: string | null
  occupantEmail: string | null
  occupantChangeVerifiedAt: string | null
  liftedAt: string | null
  liftReason: string | null
  customer: { id: string; name: string; archivedAt: string | null; contracts: { id: string; title: string | null; status: string }[] } | null
  customerNameSnapshot: string | null
  serviceLocation: { id: string; name: string } | null
  events: { id: string; type: string; note: string | null; actorName: string | null; occupantName: string | null; verifiedAt: string | null; createdAt: string }[]
}
export type CustomerOption = { id: string; name: string; locations: { id: string; name: string }[] }

const REASON_LABEL = (r: string) => r.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })

const EVENT_LABEL: Record<string, string> = {
  CREATED: "Exclusion created", NOTE: "Note added", OCCUPANT_CHANGE: "Occupant change recorded", LIFTED: "Exclusion lifted", REINSTATED: "Exclusion reinstated",
}

export function ExclusionDetailClient({ ex, customers }: { ex: ExclusionDetail; customers: CustomerOption[] }) {
  const router = useRouter()
  const [panel, setPanel] = useState<null | "occupant" | "lift" | "link">(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lifted = ex.status === "LIFTED"
  const hasVerifiedOccupantChange = !!ex.occupantChangeVerifiedAt

  async function post(url: string, body: unknown, onDone?: () => void) {
    setBusy(true); setError(null)
    const res = await apiSend(url, "POST", body)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setPanel(null); onDone?.(); router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Incident summary */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={lifted ? "neutral" : "warning"}>{lifted ? "Lifted" : "Active"}</StatusBadge>
          <StatusBadge tone="warning">{REASON_LABEL(ex.reason)}</StatusBadge>
          {ex.isPropertySpecific ? <StatusBadge tone="info">Property-specific safety concern</StatusBadge> : <StatusBadge tone="purple">Person / customer-specific</StatusBadge>}
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Detail label="Address" value={ex.address} />
          <Detail label="Incident date" value={fmt(ex.incidentDate)} />
          <Detail label="Note" value={ex.note || "—"} />
          <Detail label="Occupant at incident" value={[ex.occupantName, ex.occupantPhone, ex.occupantEmail].filter(Boolean).join(" · ") || "—"} />
        </dl>
        {lifted ? (
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            Lifted {fmt(ex.liftedAt)}{ex.liftReason ? ` — ${ex.liftReason}` : ""}. The incident record and its customer association are preserved.
          </div>
        ) : null}
      </Card>

      {/* Linked records — navigation */}
      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Linked records</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-slate-500">Customer account</div>
            {ex.customer ? (
              <Link href={`/customers/${ex.customer.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                {ex.customer.name}{ex.customer.archivedAt ? " (archived)" : ""} →
              </Link>
            ) : ex.customerNameSnapshot ? (
              <div className="text-sm text-slate-600">{ex.customerNameSnapshot} <span className="text-xs text-slate-400">(account unlinked — name preserved)</span></div>
            ) : <div className="text-sm text-slate-400">Not linked</div>}
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Service location</div>
            {ex.serviceLocation ? (
              <Link href="/locations" className="text-sm font-medium text-brand-700 hover:text-brand-800">{ex.serviceLocation.name} →</Link>
            ) : <div className="text-sm text-slate-400">Not linked</div>}
          </div>
        </div>
        {ex.customer && ex.customer.contracts.length > 0 ? (
          <div>
            <div className="text-xs font-medium text-slate-500">Contracts</div>
            <ul className="mt-1 space-y-1">
              {ex.customer.contracts.map((c) => (
                <li key={c.id}>
                  <Link href={`/contracts/${c.id}`} className="text-sm text-brand-700 hover:text-brand-800">{c.title || "Contract"} <span className="text-xs text-slate-400">({c.status.toLowerCase()})</span> →</Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => setPanel(panel === "link" ? null : "link")}>{panel === "link" ? "Cancel" : "Edit links & incident"}</Button>
        {panel === "link" ? <LinkPanel ex={ex} customers={customers} busy={busy} onSubmit={(body) => post(`/api/exclusions/address/${ex.id}/link`, body)} /> : null}
      </Card>

      {/* Occupant change + lift/reinstate actions */}
      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Manage exclusion</h2>
        {!lifted && !ex.isPropertySpecific && !hasVerifiedOccupantChange ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            This is a person-specific exclusion with no verified occupant change on file. If the property now has a different
            occupant, record that first — a previous occupant&rsquo;s conduct should not automatically apply to a new one.
          </p>
        ) : null}
        {!lifted && ex.isPropertySpecific ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
            This is a property-specific safety concern. It may remain relevant even after the occupant changes — confirm the
            hazard is resolved before lifting, not just that someone new moved in.
          </p>
        ) : null}
        {hasVerifiedOccupantChange ? (
          <p className="text-xs text-emerald-700">Verified occupant change on file ({fmt(ex.occupantChangeVerifiedAt)}).</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPanel(panel === "occupant" ? null : "occupant")}>Record occupant change</Button>
          {lifted ? (
            <Button size="sm" onClick={() => post(`/api/exclusions/address/${ex.id}/reinstate`, { reason: "Reinstated after review" })} disabled={busy}>Reinstate</Button>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setPanel(panel === "lift" ? null : "lift")}>Lift exclusion</Button>
          )}
        </div>

        {panel === "occupant" ? <OccupantPanel busy={busy} onSubmit={(body) => post(`/api/exclusions/address/${ex.id}/occupant-change`, body)} /> : null}
        {panel === "lift" ? <LiftPanel busy={busy} onSubmit={(reason) => post(`/api/exclusions/address/${ex.id}/lift`, { reason })} /> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </Card>

      {/* Audit trail */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">History</h2>
        <ol className="space-y-3">
          {ex.events.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
              <div>
                <div className="font-medium text-slate-800">{EVENT_LABEL[e.type] ?? e.type}</div>
                {e.type === "OCCUPANT_CHANGE" && e.occupantName ? <div className="text-xs text-slate-500">New occupant: {e.occupantName}{e.verifiedAt ? ` · verified ${fmt(e.verifiedAt)}` : ""}</div> : null}
                {e.note ? <div className="text-xs text-slate-500">{e.note}</div> : null}
                <div className="text-xs text-slate-400">{fmtDateTime(e.createdAt)}{e.actorName ? ` · ${e.actorName}` : ""}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-0.5 text-sm text-slate-800">{value}</dd></div>
}

function OccupantPanel({ busy, onSubmit }: { busy: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  const [v, setV] = useState({ occupantName: "", occupantPhone: "", occupantEmail: "", verifiedAt: "", note: "" })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value })
  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">Document the verified new occupant. This does not create a new exclusion or transfer the prior occupant&rsquo;s record.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="New occupant name"><Input value={v.occupantName} onChange={set("occupantName")} /></Field>
        <Field label="Verification date"><Input type="date" value={v.verifiedAt} onChange={set("verifiedAt")} /></Field>
        <Field label="Phone"><Input value={v.occupantPhone} onChange={set("occupantPhone")} /></Field>
        <Field label="Email"><Input value={v.occupantEmail} onChange={set("occupantEmail")} /></Field>
      </div>
      <Field label="Notes"><Textarea rows={2} value={v.note} onChange={set("note")} /></Field>
      <Button size="sm" disabled={busy} onClick={() => onSubmit({ ...v, verifiedAt: v.verifiedAt || undefined })}>Save occupant change</Button>
    </div>
  )
}

function LiftPanel({ busy, onSubmit }: { busy: boolean; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("")
  return (
    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-xs text-red-700">Lifting stops this address from matching at intake. The incident record and its customer association are kept. Give a reason for the audit trail.</p>
      <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for lifting (required)" />
      <Button size="sm" variant="danger" disabled={busy || !reason.trim()} onClick={() => onSubmit(reason.trim())}>Confirm lift</Button>
    </div>
  )
}

function LinkPanel({ ex, customers, busy, onSubmit }: { ex: ExclusionDetail; customers: CustomerOption[]; busy: boolean; onSubmit: (body: Record<string, unknown>) => void }) {
  const [customerId, setCustomerId] = useState(ex.customer?.id ?? "")
  const [locationId, setLocationId] = useState(ex.serviceLocation?.id ?? "")
  const [incidentDate, setIncidentDate] = useState(ex.incidentDate ? ex.incidentDate.slice(0, 10) : "")
  const [propertySpecific, setPropertySpecific] = useState(ex.isPropertySpecific)
  const locations = customers.find((c) => c.id === customerId)?.locations ?? []
  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Customer account">
          <Select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setLocationId("") }}>
            <option value="">Not linked</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Service location">
          <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={!customerId}>
            <option value="">Not linked</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </Field>
        <Field label="Incident date"><Input type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={propertySpecific} onChange={(e) => setPropertySpecific(e.target.checked)} />
        Property-specific safety concern (persists after occupant changes)
      </label>
      <Button size="sm" disabled={busy} onClick={() => onSubmit({ customerId: customerId || null, serviceLocationId: locationId || null, incidentDate: incidentDate || null, isPropertySpecific: propertySpecific })}>Save</Button>
    </div>
  )
}
