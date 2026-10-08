"use client"

import { useState } from "react"
import Link from "next/link"
import { Button, Card, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { PROPERTY_TYPES } from "@/lib/zod-schemas"

type Area = { name: string; sqft: string; surface: string; notes: string }
const SURFACES = ["Carpet", "Hard floor", "Tile/grout", "Glass", "Restroom", "Office", "Kitchen", "Other"]
const blank = (): Area => ({ name: "", sqft: "", surface: "Carpet", notes: "" })

// Mobile-friendly on-site capture. Rooms/areas with sqft + surface + notes feed
// the bid calculator after converting the quote to an estimate.
export function WalkthroughCapture() {
  const [contactName, setContactName] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [propertyType, setPropertyType] = useState("COMMERCIAL")
  const [addressLine1, setAddress] = useState("")
  const [areas, setAreas] = useState<Area[]>([blank()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)

  const setArea = (i: number, patch: Partial<Area>) => setAreas((p) => p.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  const totalSqft = areas.reduce((s, a) => s + (Number(a.sqft) || 0), 0)

  async function save() {
    setBusy(true); setError(null)
    const res = await apiSend<{ id: string }>("/api/quote-requests", "POST", {
      source: "IN_PERSON", contactName, contactPhone: contactPhone || undefined, addressLine1: addressLine1 || undefined,
      propertyType, sqft: totalSqft || undefined,
      walkthrough: areas.filter((a) => a.name.trim()).map((a) => ({ name: a.name, sqft: Number(a.sqft) || 0, surface: a.surface, notes: a.notes || undefined })),
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setDoneId(res.data.id)
  }

  if (doneId) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm font-semibold text-slate-800">Walkthrough saved</p>
        <p className="mt-1 text-sm text-slate-500">Captured {areas.filter((a) => a.name.trim()).length} areas · {totalSqft.toLocaleString()} sq ft total.</p>
        <p className="mt-3 text-sm text-slate-500">Open it in Quotes to convert to an estimate and price it with the bid calculator.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/quotes" className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Back to Quotes</Link>
          <button onClick={() => { setDoneId(null); setAreas([blank()]); setContactName(""); setContactPhone(""); setAddress("") }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">New walkthrough</button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Contact name" htmlFor="w-name"><Input id="w-name" value={contactName} onChange={(e) => setContactName(e.target.value)} className="py-3 text-base" /></Field>
          <Field label="Phone" htmlFor="w-phone"><Input id="w-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="py-3 text-base" inputMode="tel" /></Field>
          <Field label="Address" htmlFor="w-addr"><Input id="w-addr" value={addressLine1} onChange={(e) => setAddress(e.target.value)} className="py-3 text-base" /></Field>
          <Field label="Property" htmlFor="w-prop"><Select id="w-prop" value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="py-3 text-base">{PROPERTY_TYPES.map((p) => (<option key={p} value={p}>{p === "COMMERCIAL" ? "Commercial" : "Residential"}</option>))}</Select></Field>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Areas · {totalSqft.toLocaleString()} sq ft</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => setAreas((p) => [...p, blank()])}>Add area</Button>
        </div>
        <div className="space-y-3">
          {areas.map((a, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-3"><Input placeholder="Area / room" value={a.name} onChange={(e) => setArea(i, { name: e.target.value })} className="py-3 text-base" /></div>
                <div className="col-span-1"><Input placeholder="Sqft" value={a.sqft} onChange={(e) => setArea(i, { sqft: e.target.value })} className="py-3 text-base" inputMode="numeric" /></div>
                <div className="col-span-2"><Select value={a.surface} onChange={(e) => setArea(i, { surface: e.target.value })} className="py-3 text-base">{SURFACES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input placeholder="Notes (optional)" value={a.notes} onChange={(e) => setArea(i, { notes: e.target.value })} />
                {areas.length > 1 ? <button type="button" onClick={() => setAreas((p) => p.filter((_, j) => j !== i))} className="shrink-0 text-slate-400 hover:text-red-600" aria-label="Remove">✕</button> : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <Button onClick={save} disabled={busy || !contactName} size="lg" className="w-full">{busy ? "Saving…" : "Save walkthrough"}</Button>
      <p className="text-center text-xs text-slate-400">Tip: photos attach to jobs once this converts to scheduled work. See the report for offline limitations.</p>
    </div>
  )
}
