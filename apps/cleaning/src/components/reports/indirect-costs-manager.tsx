"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { INDIRECT_COST_CATEGORIES, COST_ALLOCATION_BASES } from "@/lib/zod-schemas"

export type IndirectCostRow = {
  id: string
  name: string
  category: "EQUIPMENT" | "INSURANCE" | "OVERHEAD" | "OTHER"
  amount: string
  periodDays: number
  basis: "REVENUE" | "LABOR_COST" | "LABOR_HOURS" | "JOB_COUNT" | "EVEN"
  effectiveFrom: Date | string | null
  effectiveTo: Date | string | null
  isActive: boolean
}

const CATEGORY_LABEL: Record<string, string> = { EQUIPMENT: "Equipment", INSURANCE: "Insurance", OVERHEAD: "Overhead", OTHER: "Other" }
const BASIS_LABEL: Record<string, string> = {
  REVENUE: "Share by revenue",
  LABOR_COST: "Share by labor cost",
  LABOR_HOURS: "Share by labor hours",
  JOB_COUNT: "Share by job count",
  EVEN: "Split evenly across sites",
}

type Form = {
  name: string
  category: IndirectCostRow["category"]
  amount: string
  periodDays: string
  basis: IndirectCostRow["basis"]
  effectiveFrom: string
  effectiveTo: string
}
const blank: Form = { name: "", category: "OVERHEAD", amount: "", periodDays: "30", basis: "REVENUE", effectiveFrom: "", effectiveTo: "" }

const asDate = (v: Date | string | null): string => (v ? new Date(v).toISOString().slice(0, 10) : "")

export function IndirectCostsManager({ pools }: { pools: IndirectCostRow[] }) {
  const router = useRouter()
  const [form, setForm] = useState<Form>({ ...blank })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setError(null)
  }

  function startEdit(p: IndirectCostRow) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      category: p.category,
      amount: p.amount,
      periodDays: String(p.periodDays),
      basis: p.basis,
      effectiveFrom: asDate(p.effectiveFrom),
      effectiveTo: asDate(p.effectiveTo),
    })
    setError(null)
  }
  function cancel() {
    setEditingId(null)
    setForm({ ...blank })
    setError(null)
  }

  async function submit() {
    if (!form.name.trim()) return setError("Name the cost pool")
    if (!form.amount.trim()) return setError("Enter an amount")
    setBusy(true)
    setError(null)
    const payload = {
      name: form.name,
      category: form.category,
      amount: form.amount,
      periodDays: Number(form.periodDays) || 30,
      basis: form.basis,
      effectiveFrom: form.effectiveFrom || null,
      effectiveTo: form.effectiveTo || null,
    }
    const res = editingId
      ? await apiSend(`/api/indirect-costs/${editingId}`, "PATCH", payload)
      : await apiSend("/api/indirect-costs", "POST", payload)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    cancel()
    router.refresh()
  }
  async function deactivate(id: string) {
    if (!confirm("Deactivate this cost pool? Future reports will stop allocating it.")) return
    const res = await apiSend(`/api/indirect-costs/${id}`, "DELETE")
    if (!res.ok) return setError(res.error)
    if (editingId === id) cancel()
    router.refresh()
  }

  const window = (p: IndirectCostRow) => {
    const from = asDate(p.effectiveFrom)
    const to = asDate(p.effectiveTo)
    if (!from && !to) return "Always"
    return `${from || "…"} → ${to || "open"}`
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
        An indirect cost pool is a cost not tied to one job — equipment, insurance, admin overhead. The profitability
        report spreads each pool across sites, customers and plans by the driver you choose, to show fully-loaded net
        margin. The amount is prorated by the report length (amount × report days ÷ pool days). This is management
        reporting only — not a general ledger or financial statement.
      </Card>

      <Card className="overflow-x-auto">
        {pools.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No indirect cost pools yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium">Per (days)</th>
                <th className="px-4 py-2.5 font-medium">Allocation</th>
                <th className="px-4 py-2.5 font-medium">Window</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pools.map((p) => (
                <tr key={p.id} className={p.isActive ? "hover:bg-slate-50" : "bg-slate-50/60 text-slate-400"}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {p.name}
                    {!p.isActive ? " (inactive)" : ""}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{CATEGORY_LABEL[p.category]}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">${p.amount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{p.periodDays}</td>
                  <td className="px-4 py-3 text-slate-600">{BASIS_LABEL[p.basis]}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">{window(p)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(p)} className="mr-3 text-sm font-medium text-brand hover:underline">
                      Edit
                    </button>
                    {p.isActive ? (
                      <button onClick={() => deactivate(p.id)} className="text-sm font-medium text-red-600 hover:underline">
                        Deactivate
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">{editingId ? "Edit cost pool" : "Add a cost pool"}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="ic-name">
            <Input id="ic-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="General liability insurance" />
          </Field>
          <Field label="Category" htmlFor="ic-cat">
            <Select id="ic-cat" value={form.category} onChange={(e) => set("category", e.target.value as Form["category"])}>
              {INDIRECT_COST_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount ($)" htmlFor="ic-amt">
            <Input id="ic-amt" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="1200" />
          </Field>
          <Field label="Covers (days)" htmlFor="ic-days" hint="e.g. 30 for a monthly amount">
            <Input id="ic-days" type="number" min={1} max={366} value={form.periodDays} onChange={(e) => set("periodDays", e.target.value)} />
          </Field>
          <Field label="Allocate by" htmlFor="ic-basis">
            <Select id="ic-basis" value={form.basis} onChange={(e) => set("basis", e.target.value as Form["basis"])}>
              {COST_ALLOCATION_BASES.map((b) => (
                <option key={b} value={b}>
                  {BASIS_LABEL[b]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Effective from" htmlFor="ic-from" hint="optional">
            <Input id="ic-from" type="date" value={form.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} />
          </Field>
          <Field label="Effective to" htmlFor="ic-to" hint="optional">
            <Input id="ic-to" type="date" value={form.effectiveTo} onChange={(e) => set("effectiveTo", e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : editingId ? "Save pool" : "Add pool"}
          </Button>
          {editingId ? (
            <Button variant="secondary" onClick={cancel}>
              Cancel
            </Button>
          ) : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </Card>
    </div>
  )
}
