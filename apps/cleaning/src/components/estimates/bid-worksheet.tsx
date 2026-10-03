"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { VISITS_PER_MONTH } from "@/lib/bid-constants"
import { SERVICE_FREQUENCIES } from "@/lib/zod-schemas"

type Rate = { id: string; taskType: string; surfaceType: string; sqftPerHour: string }
type Area = { name: string; sqft: string; surfaceType: string; sqftPerHour: string; frequency: string }

const FREQ_LABEL: Record<string, string> = { ONE_TIME: "One-time", DAILY: "Daily", WEEKLY: "Weekly", BIWEEKLY: "Every 2 weeks", MONTHLY: "Monthly", CUSTOM: "Custom" }
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const blankArea = (r?: Rate): Area => ({ name: "", sqft: "", surfaceType: r?.surfaceType ?? "", sqftPerHour: r?.sqftPerHour ?? "", frequency: "WEEKLY" })

// Client-side preview mirrors lib/bid-math; the server recomputes with Decimal
// on save (authoritative snapshot), so this is display only.
function preview(areas: Area[], laborRate: number, suppliesPct: number, overheadPct: number, marginPct: number) {
  let monthlyHours = 0
  const rows = areas.map((a) => {
    const rate = Number(a.sqftPerHour) || 0
    const sqft = Number(a.sqft) || 0
    const vpm = VISITS_PER_MONTH[a.frequency] ?? 1
    const hpv = rate > 0 ? sqft / rate : 0
    const mh = hpv * vpm
    monthlyHours += mh
    return { ...a, vpm, hpv, mh }
  })
  const laborCost = monthlyHours * laborRate
  const suppliesCost = laborCost * (suppliesPct / 100)
  const overheadCost = (laborCost + suppliesCost) * (overheadPct / 100)
  const totalCost = laborCost + suppliesCost + overheadCost
  const denom = 1 - marginPct / 100
  const price = denom > 0 ? totalCost / denom : totalCost
  return { rows, monthlyHours, laborCost, suppliesCost, overheadCost, totalCost, price, margin: price - totalCost }
}

export function BidWorksheet({
  estimateId,
  rates,
  initial,
}: {
  estimateId: string
  rates: Rate[]
  initial?: { areas: Area[]; laborRate: string; suppliesPct: string; overheadPct: string; targetMarginPct: string }
}) {
  const router = useRouter()
  const [areas, setAreas] = useState<Area[]>(initial?.areas?.length ? initial.areas : [blankArea(rates[0])])
  const [laborRate, setLaborRate] = useState(initial?.laborRate ?? "35")
  const [suppliesPct, setSuppliesPct] = useState(initial?.suppliesPct ?? "8")
  const [overheadPct, setOverheadPct] = useState(initial?.overheadPct ?? "15")
  const [targetMarginPct, setTargetMarginPct] = useState(initial?.targetMarginPct ?? "30")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const calc = useMemo(
    () => preview(areas, Number(laborRate) || 0, Number(suppliesPct) || 0, Number(overheadPct) || 0, Number(targetMarginPct) || 0),
    [areas, laborRate, suppliesPct, overheadPct, targetMarginPct],
  )

  const setArea = (i: number, patch: Partial<Area>) => setAreas((p) => p.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  const pickSurface = (i: number, rateId: string) => {
    const r = rates.find((x) => x.id === rateId)
    if (r) setArea(i, { surfaceType: r.surfaceType, sqftPerHour: r.sqftPerHour })
  }

  async function save() {
    setSaving(true); setError(null); setSaved(false)
    const payload = {
      areas: areas.map((a) => ({ name: a.name, sqft: Number(a.sqft) || 0, surfaceType: a.surfaceType, sqftPerHour: Number(a.sqftPerHour) || 0, frequency: a.frequency })),
      laborRate: Number(laborRate) || 0,
      suppliesPct: Number(suppliesPct) || 0,
      overheadPct: Number(overheadPct) || 0,
      targetMarginPct: Number(targetMarginPct) || 0,
    }
    const res = await apiSend(`/api/estimates/${estimateId}/bid`, "POST", payload)
    setSaving(false)
    if (!res.ok) return setError(res.error)
    setSaved(true)
    router.refresh()
  }

  if (rates.length === 0) return null

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Areas</h2>
            <Button type="button" variant="secondary" size="sm" onClick={() => setAreas((p) => [...p, blankArea(rates[0])])}>Add area</Button>
          </div>
          <div className="space-y-3">
            {areas.map((a, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <div className="col-span-3"><Input placeholder="Area name" value={a.name} onChange={(e) => setArea(i, { name: e.target.value })} /></div>
                <div className="col-span-2"><Input inputMode="decimal" placeholder="Sq ft" value={a.sqft} onChange={(e) => setArea(i, { sqft: e.target.value })} /></div>
                <div className="col-span-4">
                  <Select value={rates.find((r) => r.surfaceType === a.surfaceType && r.sqftPerHour === a.sqftPerHour)?.id ?? ""} onChange={(e) => pickSurface(i, e.target.value)}>
                    <option value="">— Surface / task —</option>
                    {rates.map((r) => (<option key={r.id} value={r.id}>{r.taskType} · {r.surfaceType} ({Number(r.sqftPerHour).toLocaleString()} sf/h)</option>))}
                  </Select>
                </div>
                <div className="col-span-2">
                  <Select value={a.frequency} onChange={(e) => setArea(i, { frequency: e.target.value })}>
                    {SERVICE_FREQUENCIES.map((f) => (<option key={f} value={f}>{FREQ_LABEL[f]}</option>))}
                  </Select>
                </div>
                <div className="col-span-1 flex items-center">
                  <button type="button" onClick={() => setAreas((p) => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600" aria-label="Remove area">✕</button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Rates &amp; margin</h2>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Loaded labor $/hr" htmlFor="b-labor"><Input id="b-labor" inputMode="decimal" value={laborRate} onChange={(e) => setLaborRate(e.target.value)} /></Field>
            <Field label="Supplies %" htmlFor="b-sup"><Input id="b-sup" inputMode="decimal" value={suppliesPct} onChange={(e) => setSuppliesPct(e.target.value)} /></Field>
            <Field label="Overhead %" htmlFor="b-oh"><Input id="b-oh" inputMode="decimal" value={overheadPct} onChange={(e) => setOverheadPct(e.target.value)} /></Field>
            <Field label="Target margin %" htmlFor="b-mar"><Input id="b-mar" inputMode="decimal" value={targetMarginPct} onChange={(e) => setTargetMarginPct(e.target.value)} /></Field>
          </div>
        </Card>
      </div>

      {/* The full calculation — the owner must see how the number was reached. */}
      <Card className="h-fit p-5">
        <h2 className="text-sm font-semibold text-slate-700">Calculation</h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Row k="Monthly labor hours" v={calc.monthlyHours.toFixed(2)} />
          <Row k="Labor cost" v={money(calc.laborCost)} />
          <Row k={`Supplies (${suppliesPct || 0}%)`} v={money(calc.suppliesCost)} />
          <Row k={`Overhead (${overheadPct || 0}%)`} v={money(calc.overheadCost)} />
          <div className="flex justify-between border-t border-slate-100 pt-1.5 font-medium text-slate-800"><dt>Total cost</dt><dd className="tabular-nums">{money(calc.totalCost)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Margin ({targetMarginPct || 0}%)</dt><dd className="tabular-nums text-emerald-700">{money(calc.margin)}</dd></div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-semibold text-slate-900"><dt>Monthly price</dt><dd className="tabular-nums">{money(calc.price)}</dd></div>
        </dl>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save bid to estimate"}</Button>
          {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        </div>
        {error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <p className="mt-3 text-xs text-slate-400">Saving snapshots the full worksheet onto the estimate and sets its price. The server recomputes the total — this preview is for guidance.</p>
      </Card>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{k}</dt>
      <dd className="tabular-nums text-slate-700">{v}</dd>
    </div>
  )
}
