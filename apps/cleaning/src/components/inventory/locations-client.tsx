"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select, StatusBadge } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type Loc = { id: string; name: string; kind: string; isActive: boolean; qrToken: string | null; binding: string | null; stockCount: number }
type Opt = { id: string; name: string }
type Policy = { invTrackLocations: boolean; invAutoEstimate: boolean; invRequireManualUsage: boolean }

const KIND_LABEL: Record<string, string> = { WAREHOUSE: "Warehouse", SUPPLY_STATION: "Supply station", CUSTOMER_SITE: "Customer site", VEHICLE: "Vehicle", EMPLOYEE: "Employee" }
const KINDS = Object.keys(KIND_LABEL)

export function InventoryLocationsClient({ locations, sites, users, policy, canEditPolicy }: { locations: Loc[]; sites: Opt[]; users: Opt[]; policy: Policy; canEditPolicy: boolean }) {
  const router = useRouter()
  const [v, setV] = useState({ name: "", kind: "WAREHOUSE", serviceLocationId: "", holderUserId: "" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pol, setPol] = useState(policy)

  async function create() {
    setBusy(true); setError(null)
    const payload: Record<string, unknown> = { name: v.name, kind: v.kind }
    if (v.kind === "CUSTOMER_SITE" && v.serviceLocationId) payload.serviceLocationId = v.serviceLocationId
    if ((v.kind === "VEHICLE" || v.kind === "EMPLOYEE") && v.holderUserId) payload.holderUserId = v.holderUserId
    const res = await apiSend("/api/inventory/locations", "POST", payload)
    setBusy(false); if (!res.ok) return setError(res.error)
    setV({ name: "", kind: "WAREHOUSE", serviceLocationId: "", holderUserId: "" }); router.refresh()
  }
  async function toggle(l: Loc) { setBusy(true); await apiSend(`/api/inventory/locations/${l.id}`, "PATCH", { isActive: !l.isActive }); setBusy(false); router.refresh() }
  async function savePolicy(patch: Partial<Policy>) {
    const next = { ...pol, ...patch }; setPol(next)
    await apiSend("/api/inventory/policy", "PATCH", patch); router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Tracking policy</h3>
        <p className="mb-3 text-xs text-slate-400">Turn on only what your operation needs. A small company can run on estimated usage alone; a larger one tracks stock by location.</p>
        <div className="space-y-2">
          <Toggle label="Track stock by location" hint="Warehouses, stations, vehicles & site closets hold their own stock" checked={pol.invTrackLocations} disabled={!canEditPolicy} onChange={(c) => savePolicy({ invTrackLocations: c })} />
          <Toggle label="Auto-record estimated consumption on job completion" hint="Deduct expected supply usage when a job finishes (idempotent)" checked={pol.invAutoEstimate} disabled={!canEditPolicy} onChange={(c) => savePolicy({ invAutoEstimate: c })} />
          <Toggle label="Require cleaners to log actual usage per job" hint="Prompt the field app for real consumption on every job" checked={pol.invRequireManualUsage} disabled={!canEditPolicy} onChange={(c) => savePolicy({ invRequireManualUsage: c })} />
        </div>
        {!canEditPolicy ? <p className="mt-2 text-xs text-slate-400">Only an owner or admin can change these.</p> : null}
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Add a location</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="loc-name"><Input id="loc-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Main warehouse / Van 2 / North station" /></Field>
          <Field label="Type" htmlFor="loc-kind"><Select id="loc-kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</Select></Field>
          {v.kind === "CUSTOMER_SITE" ? (
            <Field label="Customer site" htmlFor="loc-site"><Select id="loc-site" value={v.serviceLocationId} onChange={(e) => setV({ ...v, serviceLocationId: e.target.value })}><option value="">Select…</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          ) : null}
          {v.kind === "VEHICLE" || v.kind === "EMPLOYEE" ? (
            <Field label="Custodian" htmlFor="loc-holder"><Select id="loc-holder" value={v.holderUserId} onChange={(e) => setV({ ...v, holderUserId: e.target.value })}><option value="">Select…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          ) : null}
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-3 flex justify-end"><Button onClick={create} disabled={busy || !v.name}>Add location</Button></div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((l) => (
          <Card key={l.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div><div className="font-semibold text-slate-900">{l.name}</div><div className="text-xs text-slate-500">{KIND_LABEL[l.kind] ?? l.kind}{l.binding ? ` · ${l.binding}` : ""}</div></div>
              <StatusBadge tone={l.isActive ? "success" : "neutral"}>{l.isActive ? "Active" : "Inactive"}</StatusBadge>
            </div>
            <div className="mt-2 text-xs text-slate-600">{l.stockCount} stocked {l.stockCount === 1 ? "item" : "items"}</div>
            {l.qrToken ? <div className="mt-1 text-xs text-brand-700">Station QR: <a href={`/station/${l.id}`} className="underline">open log</a></div> : null}
            <div className="mt-3 flex gap-2"><Button size="sm" variant="secondary" onClick={() => toggle(l)} disabled={busy}>{l.isActive ? "Deactivate" : "Activate"}</Button></div>
          </Card>
        ))}
        {locations.length === 0 ? <Card className="p-5 text-center text-sm text-slate-500 sm:col-span-2 lg:col-span-3">No inventory locations yet.</Card> : null}
      </div>
    </div>
  )
}

function Toggle({ label, hint, checked, disabled, onChange }: { label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className={`flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span><span className="block text-sm font-medium text-slate-800">{label}</span><span className="block text-xs text-slate-400">{hint}</span></span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand-700" />
    </label>
  )
}
