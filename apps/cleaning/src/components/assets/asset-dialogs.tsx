"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Select, Textarea } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { ASSET_CATEGORIES, ASSET_STATUSES } from "@/lib/zod-schemas"

type Option = { id: string; name: string }
const CAT_LABEL: Record<string, string> = { EQUIPMENT: "Equipment", VEHICLE: "Vehicle", MACHINE: "Machine" }
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Active", MAINTENANCE: "In maintenance", RETIRED: "Retired" }

export type AssetValues = {
  id?: string
  name: string
  category?: string | null
  serial?: string | null
  purchaseDate?: string | null
  purchaseCost?: string | null
  status?: string | null
  assignedToSiteId?: string | null
  assignedToUserId?: string | null
}

function AssetForm({ initial, sites, users, onDone }: { initial?: AssetValues; sites: Option[]; users: Option[]; onDone: () => void }) {
  const router = useRouter()
  const [v, setV] = useState<AssetValues>({
    name: initial?.name ?? "",
    category: initial?.category ?? "EQUIPMENT",
    serial: initial?.serial ?? "",
    purchaseDate: initial?.purchaseDate ?? "",
    purchaseCost: initial?.purchaseCost ?? "",
    status: initial?.status ?? "ACTIVE",
    assignedToSiteId: initial?.assignedToSiteId ?? "",
    assignedToUserId: initial?.assignedToUserId ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof AssetValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      ...v,
      purchaseDate: v.purchaseDate || undefined,
      purchaseCost: v.purchaseCost?.trim() || undefined,
      assignedToSiteId: v.assignedToSiteId || undefined,
      assignedToUserId: v.assignedToUserId || undefined,
    }
    const res = initial?.id
      ? await apiSend(`/api/assets/${initial.id}`, "PATCH", payload)
      : await apiSend("/api/assets", "POST", payload)
    setSaving(false)
    if (!res.ok) return setError(res.error)
    onDone()
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" htmlFor="a-name"><Input id="a-name" required value={v.name} onChange={set("name")} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category" htmlFor="a-cat">
          <Select id="a-cat" value={v.category ?? "EQUIPMENT"} onChange={set("category")}>
            {ASSET_CATEGORIES.map((c) => (<option key={c} value={c}>{CAT_LABEL[c]}</option>))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="a-status">
          <Select id="a-status" value={v.status ?? "ACTIVE"} onChange={set("status")}>
            {ASSET_STATUSES.map((s) => (<option key={s} value={s}>{STATUS_LABEL[s]}</option>))}
          </Select>
        </Field>
        <Field label="Serial" htmlFor="a-serial"><Input id="a-serial" value={v.serial ?? ""} onChange={set("serial")} /></Field>
        <Field label="Purchase cost" htmlFor="a-cost"><Input id="a-cost" inputMode="decimal" value={v.purchaseCost ?? ""} onChange={set("purchaseCost")} placeholder="0.00" /></Field>
        <Field label="Purchase date" htmlFor="a-date"><Input id="a-date" type="date" value={v.purchaseDate ?? ""} onChange={set("purchaseDate")} /></Field>
        <div />
        <Field label="Assigned to site" htmlFor="a-site">
          <Select id="a-site" value={v.assignedToSiteId ?? ""} onChange={set("assignedToSiteId")}>
            <option value="">— None —</option>
            {sites.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </Select>
        </Field>
        <Field label="Assigned to person" htmlFor="a-user">
          <Select id="a-user" value={v.assignedToUserId ?? ""} onChange={set("assignedToUserId")}>
            <option value="">— None —</option>
            {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
          </Select>
        </Field>
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : initial?.id ? "Save asset" : "Create asset"}</Button>
      </div>
    </form>
  )
}

export function NewAssetButton({ sites, users }: { sites: Option[]; users: Option[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>New asset</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New asset">
        <AssetForm sites={sites} users={users} onDone={() => setOpen(false)} />
      </Modal>
    </>
  )
}

export function EditAssetButton({ asset, sites, users }: { asset: AssetValues; sites: Option[]; users: Option[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit asset">
        <AssetForm initial={asset} sites={sites} users={users} onDone={() => setOpen(false)} />
      </Modal>
    </>
  )
}

export function AddMaintenanceButton({ assetId }: { assetId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [v, setV] = useState({ type: "", date: new Date().toISOString().slice(0, 10), cost: "", notes: "" })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await apiSend(`/api/assets/${assetId}/maintenance`, "POST", {
      type: v.type,
      date: v.date || undefined,
      cost: v.cost.trim() || undefined,
      notes: v.notes || undefined,
    })
    setSaving(false)
    if (!res.ok) return setError(res.error)
    setOpen(false)
    setV({ type: "", date: new Date().toISOString().slice(0, 10), cost: "", notes: "" })
    router.refresh()
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Log maintenance</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Log maintenance">
        <form onSubmit={submit} className="space-y-4">
          <Field label="What was done?" htmlFor="m-type"><Input id="m-type" required value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })} placeholder="Oil change, blade replacement…" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date" htmlFor="m-date"><Input id="m-date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
            <Field label="Cost" htmlFor="m-cost"><Input id="m-cost" inputMode="decimal" value={v.cost} onChange={(e) => setV({ ...v, cost: e.target.value })} placeholder="0.00" /></Field>
          </div>
          <Field label="Notes" htmlFor="m-notes"><Textarea id="m-notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add entry"}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
