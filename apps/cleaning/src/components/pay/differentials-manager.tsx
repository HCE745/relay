"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { DIFFERENTIAL_AMOUNT_TYPES } from "@/lib/zod-schemas"

export type DifferentialRow = {
  id: string; name: string; startTime: string; endTime: string; daysOfWeek: number[]
  amountType: "PERCENT" | "FLAT_PER_HOUR"; value: string; isActive: boolean
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const AMOUNT_LABEL: Record<string, string> = { PERCENT: "Percent of rate (%)", FLAT_PER_HOUR: "Flat per hour ($)" }
type Form = { name: string; startTime: string; endTime: string; daysOfWeek: number[]; amountType: "PERCENT" | "FLAT_PER_HOUR"; value: string }
const blank: Form = { name: "", startTime: "22:00", endTime: "06:00", daysOfWeek: [], amountType: "PERCENT", value: "" }

export function DifferentialsManager({ rules }: { rules: DifferentialRow[] }) {
  const router = useRouter()
  const [form, setForm] = useState<Form>({ ...blank })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setForm((f) => ({ ...f, [k]: v })); setError(null) }
  const toggleDay = (d: number) => set("daysOfWeek", form.daysOfWeek.includes(d) ? form.daysOfWeek.filter((x) => x !== d) : [...form.daysOfWeek, d].sort())

  function startEdit(r: DifferentialRow) {
    setEditingId(r.id)
    setForm({ name: r.name, startTime: r.startTime, endTime: r.endTime, daysOfWeek: r.daysOfWeek, amountType: r.amountType, value: r.value })
    setError(null)
  }
  function cancel() { setEditingId(null); setForm({ ...blank }); setError(null) }

  async function submit() {
    if (!form.name.trim()) return setError("Name the rule")
    if (!form.value.trim()) return setError("Enter an amount")
    setBusy(true); setError(null)
    const payload = { name: form.name, startTime: form.startTime, endTime: form.endTime, daysOfWeek: form.daysOfWeek, amountType: form.amountType, value: form.value }
    const res = editingId ? await apiSend(`/api/shift-differentials/${editingId}`, "PATCH", payload) : await apiSend("/api/shift-differentials", "POST", payload)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    cancel(); router.refresh()
  }
  async function deactivate(id: string) {
    if (!confirm("Deactivate this rule? Already-approved time keeps the premium it was given.")) return
    const res = await apiSend(`/api/shift-differentials/${id}`, "DELETE")
    if (!res.ok) return setError(res.error)
    if (editingId === id) cancel()
    router.refresh()
  }

  const daysLabel = (d: number[]) => d.length === 0 ? "Every day" : d.map((x) => DAYS[x]).join(", ")
  const amt = (r: DifferentialRow) => r.amountType === "PERCENT" ? `${r.value}%` : `$${r.value}/hr`

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
        A differential adds a premium to approved hours worked in a time window (e.g. nights) and/or on chosen days
        (e.g. weekends). It is snapshotted when time is approved, shows as a distinct column in the payroll export, and
        flows into labor cost. It is a cost/export figure only, not payroll processing.
      </Card>

      <Card className="overflow-x-auto">
        {rules.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No differential rules yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5 font-medium">Name</th><th className="px-4 py-2.5 font-medium">Window</th><th className="px-4 py-2.5 font-medium">Days</th><th className="px-4 py-2.5 font-medium">Premium</th><th className="px-4 py-2.5"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((r) => (
                <tr key={r.id} className={r.isActive ? "hover:bg-slate-50" : "bg-slate-50/60 text-slate-400"}>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}{!r.isActive ? " (inactive)" : ""}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{r.startTime}–{r.endTime}</td>
                  <td className="px-4 py-3 text-slate-600">{daysLabel(r.daysOfWeek)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{amt(r)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(r)} className="mr-3 text-sm font-medium text-brand hover:underline">Edit</button>
                    {r.isActive ? <button onClick={() => deactivate(r.id)} className="text-sm font-medium text-red-600 hover:underline">Deactivate</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">{editingId ? "Edit rule" : "Add a rule"}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="df-name"><Input id="df-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Night differential" /></Field>
          <Field label="Premium type" htmlFor="df-type"><Select id="df-type" value={form.amountType} onChange={(e) => set("amountType", e.target.value as Form["amountType"])}>{DIFFERENTIAL_AMOUNT_TYPES.map((t) => <option key={t} value={t}>{AMOUNT_LABEL[t]}</option>)}</Select></Field>
          <Field label="From (local)" htmlFor="df-start"><Input id="df-start" type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} /></Field>
          <Field label="To (local)" htmlFor="df-end" hint="wraps past midnight if earlier"><Input id="df-end" type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} /></Field>
          <Field label={form.amountType === "PERCENT" ? "Percent (%)" : "Amount ($/hr)"} htmlFor="df-val"><Input id="df-val" value={form.value} onChange={(e) => set("value", e.target.value)} placeholder={form.amountType === "PERCENT" ? "10" : "2.00"} /></Field>
        </div>
        <div className="mt-3">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Days (none = every day)</div>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <button key={d} type="button" onClick={() => toggleDay(i)} className={`rounded-full px-3 py-1 text-xs font-medium ${form.daysOfWeek.includes(i) ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{d}</button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : editingId ? "Save rule" : "Add rule"}</Button>
          {editingId ? <Button variant="secondary" onClick={cancel}>Cancel</Button> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </Card>
    </div>
  )
}
