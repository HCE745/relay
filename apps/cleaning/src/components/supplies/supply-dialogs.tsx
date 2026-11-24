"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export type SupplyValues = {
  id?: string
  name: string
  unit?: string | null
  currentStock?: string | null
  reorderThreshold?: string | null
  costPerUnit?: string | null
  kind?: string | null
  purchaseUnit?: string | null
  unitsPerPurchase?: string | null
  usageUnit?: string | null
  stockPerUsage?: string | null
  trackByLocation?: boolean | null
}

function SupplyForm({ initial, onDone }: { initial?: SupplyValues; onDone: () => void }) {
  const router = useRouter()
  const [v, setV] = useState<SupplyValues>({
    name: initial?.name ?? "",
    unit: initial?.unit ?? "unit",
    currentStock: initial?.currentStock ?? "0",
    reorderThreshold: initial?.reorderThreshold ?? "0",
    costPerUnit: initial?.costPerUnit ?? "",
    kind: initial?.kind ?? "CONSUMABLE",
    purchaseUnit: initial?.purchaseUnit ?? "",
    unitsPerPurchase: initial?.unitsPerPurchase ?? "",
    usageUnit: initial?.usageUnit ?? "",
    stockPerUsage: initial?.stockPerUsage ?? "",
    trackByLocation: initial?.trackByLocation ?? false,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [adv, setAdv] = useState(false)
  const set = (k: keyof SupplyValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    // currentStock is only accepted on create — stock later changes via usage/adjust.
    const payload: Record<string, unknown> = {
      name: v.name,
      unit: v.unit || "unit",
      reorderThreshold: v.reorderThreshold?.trim() || "0",
      costPerUnit: v.costPerUnit?.trim() || undefined,
    }
    if (!initial?.id) payload.currentStock = v.currentStock?.trim() || "0"
    payload.kind = v.kind || "CONSUMABLE"
    payload.purchaseUnit = v.purchaseUnit?.trim() || undefined
    payload.unitsPerPurchase = v.unitsPerPurchase?.trim() ? Number(v.unitsPerPurchase) : undefined
    payload.usageUnit = v.usageUnit?.trim() || undefined
    payload.stockPerUsage = v.stockPerUsage?.trim() ? Number(v.stockPerUsage) : undefined
    payload.trackByLocation = !!v.trackByLocation
    const res = initial?.id
      ? await apiSend(`/api/supplies/${initial.id}`, "PATCH", payload)
      : await apiSend("/api/supplies", "POST", payload)
    setSaving(false)
    if (!res.ok) return setError(res.error)
    onDone()
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Supply name" htmlFor="s-name"><Input id="s-name" required value={v.name} onChange={set("name")} /></Field>
        <Field label="Unit" htmlFor="s-unit" hint="bottle, case, roll…"><Input id="s-unit" value={v.unit ?? ""} onChange={set("unit")} /></Field>
        {!initial?.id ? (
          <Field label="Opening stock" htmlFor="s-stock"><Input id="s-stock" inputMode="decimal" value={v.currentStock ?? ""} onChange={set("currentStock")} /></Field>
        ) : null}
        <Field label="Reorder at" htmlFor="s-thresh" hint="Flag as low at or below"><Input id="s-thresh" inputMode="decimal" value={v.reorderThreshold ?? ""} onChange={set("reorderThreshold")} /></Field>
        <Field label="Cost per unit" htmlFor="s-cost"><Input id="s-cost" inputMode="decimal" value={v.costPerUnit ?? ""} onChange={set("costPerUnit")} placeholder="0.00" /></Field>
      </div>

      <button type="button" onClick={() => setAdv((a) => !a)} className="text-sm font-medium text-brand-700">{adv ? "Hide" : "Inventory options"} (units, type, location)</button>
      {adv ? (
        <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type" htmlFor="s-kind" hint="reusables track dirty vs clean">
              <Select id="s-kind" value={v.kind ?? "CONSUMABLE"} onChange={set("kind")}>
                <option value="CONSUMABLE">Consumable</option>
                <option value="REUSABLE">Reusable (cloth/mop)</option>
                <option value="EQUIPMENT">Equipment</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 pt-6 text-sm text-slate-700"><input type="checkbox" checked={!!v.trackByLocation} onChange={(e) => setV((p) => ({ ...p, trackByLocation: e.target.checked }))} className="h-4 w-4 accent-brand-700" /> Track stock by location</label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Purchase unit" htmlFor="s-pu" hint="e.g. case"><Input id="s-pu" value={v.purchaseUnit ?? ""} onChange={set("purchaseUnit")} /></Field>
            <Field label={`Stock units per purchase unit`} htmlFor="s-upp" hint={`1 ${v.purchaseUnit || "case"} = ? ${v.unit || "unit"}`}><Input id="s-upp" inputMode="decimal" value={v.unitsPerPurchase ?? ""} onChange={set("unitsPerPurchase")} /></Field>
            <Field label="Usage unit" htmlFor="s-uu" hint="e.g. bottle refill"><Input id="s-uu" value={v.usageUnit ?? ""} onChange={set("usageUnit")} /></Field>
            <Field label="Stock units per usage unit" htmlFor="s-spu" hint={`1 ${v.usageUnit || "refill"} = ? ${v.unit || "unit"}`}><Input id="s-spu" inputMode="decimal" value={v.stockPerUsage ?? ""} onChange={set("stockPerUsage")} /></Field>
          </div>
        </div>
      ) : null}

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : initial?.id ? "Save supply" : "Create supply"}</Button>
      </div>
    </form>
  )
}

export function NewSupplyButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>New supply</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New supply">
        <SupplyForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  )
}

export function EditSupplyButton({ supply }: { supply: SupplyValues }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit supply">
        <SupplyForm initial={supply} onDone={() => setOpen(false)} />
      </Modal>
    </>
  )
}

export function AdjustStockButton({ supplyId, unit }: { supplyId: string; unit: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [delta, setDelta] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await apiSend(`/api/supplies/${supplyId}/adjust`, "POST", { delta, reason })
    setSaving(false)
    if (!res.ok) return setError(res.error)
    setOpen(false)
    setDelta("")
    setReason("")
    router.refresh()
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Adjust stock</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Adjust stock">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-600">Manually correct or restock. Use a positive number to add, negative to remove ({unit}s).</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Change" htmlFor="adj-delta" hint="e.g. 12 or -3"><Input id="adj-delta" inputMode="decimal" value={delta} onChange={(e) => setDelta(e.target.value)} required /></Field>
          </div>
          <Field label="Reason" htmlFor="adj-reason"><Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Received shipment, stock count correction…" /></Field>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Apply adjustment"}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
