"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select, StatusBadge } from "@/components/ui/controls"
import { Modal } from "@/components/ui/modal"
import { apiSend } from "@/lib/client"
import { EXCLUSION_REASONS } from "@/lib/zod-schemas"

type Area = { id: string; name: string; zipCodes: string[]; radiusMiles: number | null; officeLabel: string | null; active: boolean }
type Exclusion = { id: string; label: string; reason: string; note: string | null; status?: string; customerName?: string | null; propertySpecific?: boolean; value?: string; name?: string | null; phone?: string | null; email?: string | null }
type Exclusions = { addresses: Exclusion[]; contacts: Exclusion[]; zones: Exclusion[] }

const REASON_LABEL = (r: string) => r.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())

// One form for both create and edit — an existing area is passed as `area`.
function ServiceAreaForm({ area, onDone }: { area?: Area; onDone?: () => void }) {
  const router = useRouter()
  const editing = !!area
  const [v, setV] = useState({
    name: area?.name ?? "",
    zipCodes: area?.zipCodes.join(", ") ?? "",
    radiusMiles: area?.radiusMiles != null ? String(area.radiusMiles) : "",
    officeLabel: area?.officeLabel ?? "",
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })
  async function save() {
    setBusy(true); setError(null)
    const payload = { name: v.name, zipCodes: v.zipCodes, radiusMiles: v.radiusMiles || undefined, officeLabel: v.officeLabel || undefined }
    const res = editing
      ? await apiSend(`/api/service-areas/${area!.id}`, "PATCH", payload)
      : await apiSend("/api/service-areas", "POST", payload)
    setBusy(false); if (!res.ok) return setError(res.error)
    if (!editing) setV({ name: "", zipCodes: "", radiusMiles: "", officeLabel: "" })
    router.refresh(); onDone?.()
  }
  const body = (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Area name" htmlFor="sa-name"><Input id="sa-name" value={v.name} onChange={set("name")} placeholder="North office" /></Field>
        <Field label="Office / branch label" htmlFor="sa-office"><Input id="sa-office" value={v.officeLabel} onChange={set("officeLabel")} placeholder="HQ" /></Field>
        <Field label="ZIP codes" htmlFor="sa-zips" hint="comma or space separated"><Input id="sa-zips" value={v.zipCodes} onChange={set("zipCodes")} placeholder="78701, 78702, 78703" /></Field>
        <Field label="Radius (miles, optional)" htmlFor="sa-radius" hint="needs geocoding to evaluate"><Input id="sa-radius" value={v.radiusMiles} onChange={set("radiusMiles")} inputMode="decimal" placeholder="25" /></Field>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        {editing ? <Button variant="ghost" onClick={() => onDone?.()} disabled={busy}>Cancel</Button> : null}
        <Button onClick={save} disabled={busy || !v.name}>{editing ? "Save changes" : "Add area"}</Button>
      </div>
    </>
  )
  return editing ? body : <Card className="p-4">{body}</Card>
}

const EXCLUSION_LABELS = { address: "address", contact: "contact", zone: "zone" } as const

// Shared quick-edit modal for a zone or contact exclusion (address edits live on
// the exclusion detail page, which carries the occupant-change workflow).
function ExclusionEditModal({ kind, item, onClose }: { kind: "contact" | "zone"; item: Exclusion; onClose: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [v, setV] = useState({
    value: item.value ?? item.label ?? "",
    name: item.name ?? "",
    phone: item.phone ?? "",
    email: item.email ?? "",
    reason: item.reason,
    note: item.note ?? "",
  })
  async function save() {
    setBusy(true); setError(null)
    const payload: Record<string, unknown> =
      kind === "zone"
        ? { value: v.value, reason: v.reason, note: v.note || undefined }
        : { name: v.name || undefined, phone: v.phone || undefined, email: v.email || undefined, reason: v.reason, note: v.note || undefined }
    const res = await apiSend(`/api/exclusions/${kind}/${item.id}`, "PATCH", payload)
    setBusy(false); if (!res.ok) return setError(res.error)
    router.refresh(); onClose()
  }
  return (
    <Modal open onClose={onClose} title={`Edit ${EXCLUSION_LABELS[kind]} exclusion`}>
      <div className="space-y-3">
        {kind === "zone" ? (
          <Field label="ZIP or area" htmlFor="ex-value"><Input id="ex-value" value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} /></Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" htmlFor="ex-name"><Input id="ex-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
            <Field label="Phone" htmlFor="ex-phone"><Input id="ex-phone" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
            <Field label="Email" htmlFor="ex-email"><Input id="ex-email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Reason" htmlFor="ex-reason"><Select id="ex-reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })}>{EXCLUSION_REASONS.map((r) => <option key={r} value={r}>{REASON_LABEL(r)}</option>)}</Select></Field>
          <Field label="Note" htmlFor="ex-note"><Input id="ex-note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="Optional" /></Field>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || (kind === "zone" ? !v.value : !(v.name || v.phone || v.email))}>Save changes</Button>
        </div>
      </div>
    </Modal>
  )
}

function ExclusionList({ kind, title, hint, items }: { kind: "address" | "contact" | "zone"; title: string; hint: string; items: Exclusion[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Exclusion | null>(null)
  const [v, setV] = useState({ value: "", reason: EXCLUSION_REASONS[0] as string, note: "" })

  async function add() {
    setBusy(true); setError(null)
    const payload: Record<string, unknown> = { reason: v.reason, note: v.note || undefined }
    if (kind === "address") payload.addressLine1 = v.value
    if (kind === "zone") payload.value = v.value
    if (kind === "contact") {
      // Accept a name, phone, or email in one field — route to the right key.
      if (v.value.includes("@")) payload.email = v.value
      else if (/\d/.test(v.value)) payload.phone = v.value
      else payload.name = v.value
    }
    const res = await apiSend(`/api/exclusions/${kind}`, "POST", payload)
    setBusy(false); if (!res.ok) return setError(res.error)
    setV({ value: "", reason: EXCLUSION_REASONS[0], note: "" }); setAdding(false); router.refresh()
  }
  async function remove(id: string) {
    setBusy(true)
    await apiSend(`/api/exclusions/${kind}/${id}`, "DELETE")
    setBusy(false); router.refresh()
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div><h3 className="text-sm font-semibold text-slate-800">{title}</h3><p className="text-xs text-slate-400">{hint}</p></div>
        <Button size="sm" variant="ghost" onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "+ Add"}</Button>
      </div>
      {adding ? (
        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <Input value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} placeholder={kind === "address" ? "123 Main St" : kind === "zone" ? "78704 or Downtown" : "Name, phone, or email"} autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <Select value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })}>{EXCLUSION_REASONS.map((r) => <option key={r} value={r}>{REASON_LABEL(r)}</option>)}</Select>
            <Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="Note (optional)" />
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <Button size="sm" onClick={add} disabled={busy || !v.value}>Save</Button>
        </div>
      ) : null}
      <ul className="mt-3 space-y-2">
        {items.length === 0 ? <li className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-300">None</li> : items.map((e) => {
          const lifted = e.status === "LIFTED"
          return (
          <li key={e.id} className={`flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2.5 ${lifted ? "opacity-60" : ""}`}>
            <div className="min-w-0">
              <div className="truncate text-sm text-slate-800">{e.label}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge tone="warning">{REASON_LABEL(e.reason)}</StatusBadge>
                {lifted ? <StatusBadge tone="neutral">Lifted</StatusBadge> : null}
                {e.propertySpecific ? <StatusBadge tone="info">Property</StatusBadge> : null}
                {e.customerName ? <span className="truncate text-xs text-slate-500">{e.customerName}</span> : null}
                {e.note ? <span className="truncate text-xs text-slate-400">{e.note}</span> : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {kind === "address" ? (
                <Link href={`/service-areas/exclusions/${e.id}`} className="text-xs font-medium text-brand-700 hover:text-brand-800">Details</Link>
              ) : (
                <button onClick={() => setEditing(e)} disabled={busy} className="text-xs font-medium text-brand-700 hover:text-brand-800">Edit</button>
              )}
              <button onClick={() => remove(e.id)} disabled={busy} className="text-xs text-slate-400 hover:text-red-600">Remove</button>
            </div>
          </li>
          )
        })}
      </ul>
      {editing && kind !== "address" ? (
        <ExclusionEditModal kind={kind} item={editing} onClose={() => setEditing(null)} />
      ) : null}
    </Card>
  )
}

export function ServiceAreasClient({ areas, exclusions }: { areas: Area[]; exclusions: Exclusions }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [editArea, setEditArea] = useState<Area | null>(null)
  async function toggle(a: Area) { setBusy(true); await apiSend(`/api/service-areas/${a.id}`, "PATCH", { active: !a.active }); setBusy(false); router.refresh() }
  async function del(id: string) { setBusy(true); await apiSend(`/api/service-areas/${id}`, "DELETE"); setBusy(false); router.refresh() }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Service areas</h2>
        <p className="-mt-1 text-xs text-slate-400">Addresses matching no active ZIP area are flagged &ldquo;outside service area&rdquo; at intake. Never silently refused. Radius areas require geocoding to evaluate.</p>
        <ServiceAreaForm />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-slate-900">{a.name}</div>
                <StatusBadge tone={a.active ? "success" : "neutral"}>{a.active ? "Active" : "Inactive"}</StatusBadge>
              </div>
              <div className="mt-1 text-xs text-slate-500">{a.officeLabel ?? "-"}</div>
              <div className="mt-2 text-xs text-slate-600">{a.zipCodes.length ? `ZIPs: ${a.zipCodes.join(", ")}` : a.radiusMiles ? `Radius: ${a.radiusMiles} mi` : "No coverage set"}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditArea(a)} disabled={busy}>Edit</Button>
                <Button size="sm" variant="secondary" onClick={() => toggle(a)} disabled={busy}>{a.active ? "Deactivate" : "Activate"}</Button>
                <Button size="sm" variant="ghost" onClick={() => del(a.id)} disabled={busy}>Delete</Button>
              </div>
            </Card>
          ))}
          {areas.length === 0 ? <Card className="p-5 text-center text-sm text-slate-500 sm:col-span-2 lg:col-span-3">No service areas yet. Every address is treated as serviceable until you add one.</Card> : null}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Exclusions (do-not-serve)</h2>
        <p className="-mt-1 text-xs text-slate-400">Exclusions warn staff with a reason. They never hard-block, and every change is recorded to the audit log. Public booking never reveals an exclusion.</p>
        <div className="grid gap-3 lg:grid-cols-3">
          <ExclusionList kind="address" title="Addresses" hint="A specific address" items={exclusions.addresses} />
          <ExclusionList kind="contact" title="Contacts" hint="A specific person" items={exclusions.contacts} />
          <ExclusionList kind="zone" title="Zones" hint="A ZIP or named area" items={exclusions.zones} />
        </div>
      </section>
      {editArea ? (
        <Modal open onClose={() => setEditArea(null)} title="Edit service area">
          <ServiceAreaForm area={editArea} onDone={() => setEditArea(null)} />
        </Modal>
      ) : null}
    </div>
  )
}
