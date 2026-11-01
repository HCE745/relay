"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { BUDGET_SCOPES, BUDGET_PERIODS } from "@/lib/zod-schemas"

export type BudgetRow = {
  id: string
  scope: "CONTRACT" | "SITE" | "PLAN"
  name: string
  detail?: string
  period: "WEEKLY" | "MONTHLY"
  budgetedHours: string
  budgetedCost: string
  alertUnprofitable: boolean
  isActive: boolean
}
export type Targets = { contracts: { id: string; title: string }[]; sites: { id: string; name: string }[]; plans: { id: string; name: string }[] }

const SCOPE_LABEL: Record<string, string> = { CONTRACT: "Contract", SITE: "Site", PLAN: "Service plan" }
const PERIOD_LABEL: Record<string, string> = { WEEKLY: "per week", MONTHLY: "per month" }

type Form = {
  scope: BudgetRow["scope"]
  targetId: string
  period: BudgetRow["period"]
  budgetedHours: string
  budgetedCost: string
  alertUnprofitable: boolean
}
const blank: Form = { scope: "CONTRACT", targetId: "", period: "MONTHLY", budgetedHours: "", budgetedCost: "", alertUnprofitable: true }

export function LaborBudgetsManager({ budgets, targets }: { budgets: BudgetRow[]; targets: Targets }) {
  const router = useRouter()
  const [form, setForm] = useState<Form>({ ...blank })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setError(null)
  }

  const targetOptions =
    form.scope === "CONTRACT"
      ? targets.contracts.map((c) => ({ id: c.id, label: c.title }))
      : form.scope === "SITE"
        ? targets.sites.map((s) => ({ id: s.id, label: s.name }))
        : targets.plans.map((p) => ({ id: p.id, label: p.name }))

  function startEdit(b: BudgetRow) {
    // Scope/target are fixed once created; only the figures are editable.
    setEditingId(b.id)
    setForm({ scope: b.scope, targetId: "", period: b.period, budgetedHours: b.budgetedHours, budgetedCost: b.budgetedCost, alertUnprofitable: b.alertUnprofitable })
    setError(null)
  }
  function cancel() {
    setEditingId(null)
    setForm({ ...blank })
    setError(null)
  }

  async function submit() {
    setBusy(true)
    setError(null)
    let res
    if (editingId) {
      res = await apiSend(`/api/labor-budgets/${editingId}`, "PATCH", {
        period: form.period,
        budgetedHours: form.budgetedHours,
        budgetedCost: form.budgetedCost,
        alertUnprofitable: form.alertUnprofitable,
      })
    } else {
      if (!form.targetId) {
        setBusy(false)
        return setError("Choose a target")
      }
      if (!form.budgetedHours.trim() || !form.budgetedCost.trim()) {
        setBusy(false)
        return setError("Enter budgeted hours and cost")
      }
      res = await apiSend("/api/labor-budgets", "POST", {
        scope: form.scope,
        contractId: form.scope === "CONTRACT" ? form.targetId : null,
        serviceLocationId: form.scope === "SITE" ? form.targetId : null,
        servicePlanId: form.scope === "PLAN" ? form.targetId : null,
        period: form.period,
        budgetedHours: form.budgetedHours,
        budgetedCost: form.budgetedCost,
        alertUnprofitable: form.alertUnprofitable,
      })
    }
    setBusy(false)
    if (!res.ok) return setError(res.error)
    cancel()
    router.refresh()
  }
  async function deactivate(id: string) {
    if (!confirm("Deactivate this budget? It will stop appearing in the variance report.")) return
    const res = await apiSend(`/api/labor-budgets/${id}`, "DELETE")
    if (!res.ok) return setError(res.error)
    if (editingId === id) cancel()
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-x-auto">
        {budgets.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No labor budgets yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Scope</th>
                <th className="px-4 py-2.5 font-medium">Target</th>
                <th className="px-4 py-2.5 text-right font-medium">Budgeted hours</th>
                <th className="px-4 py-2.5 text-right font-medium">Budgeted cost</th>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {budgets.map((b) => (
                <tr key={b.id} className={b.isActive ? "hover:bg-slate-50" : "bg-slate-50/60 text-slate-400"}>
                  <td className="px-4 py-3 text-slate-600">{SCOPE_LABEL[b.scope]}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {b.name}
                      {!b.isActive ? " (inactive)" : ""}
                    </div>
                    {b.detail ? <div className="text-xs text-slate-400">{b.detail}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{b.budgetedHours}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">${b.budgetedCost}</td>
                  <td className="px-4 py-3 text-slate-600">{PERIOD_LABEL[b.period]}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(b)} className="mr-3 text-sm font-medium text-brand hover:underline">
                      Edit
                    </button>
                    {b.isActive ? (
                      <button onClick={() => deactivate(b.id)} className="text-sm font-medium text-red-600 hover:underline">
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
        <h3 className="mb-4 text-sm font-semibold text-slate-700">{editingId ? "Edit budget" : "Add a budget"}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Scope" htmlFor="lb-scope">
            <Select
              id="lb-scope"
              value={form.scope}
              disabled={!!editingId}
              onChange={(e) => {
                set("scope", e.target.value as Form["scope"])
                set("targetId", "")
              }}
            >
              {BUDGET_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          {!editingId ? (
            <Field label="Target" htmlFor="lb-target">
              <Select id="lb-target" value={form.targetId} onChange={(e) => set("targetId", e.target.value)}>
                <option value="">Select…</option>
                {targetOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div />
          )}
          <Field label="Budgeted hours" htmlFor="lb-hours">
            <Input id="lb-hours" value={form.budgetedHours} onChange={(e) => set("budgetedHours", e.target.value)} placeholder="160" />
          </Field>
          <Field label="Budgeted labor cost ($)" htmlFor="lb-cost">
            <Input id="lb-cost" value={form.budgetedCost} onChange={(e) => set("budgetedCost", e.target.value)} placeholder="3200" />
          </Field>
          <Field label="Period" htmlFor="lb-period">
            <Select id="lb-period" value={form.period} onChange={(e) => set("period", e.target.value as Form["period"])}>
              {BUDGET_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <label className="mt-6 inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.alertUnprofitable} onChange={(e) => set("alertUnprofitable", e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Alert when labor cost exceeds revenue
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : editingId ? "Save budget" : "Add budget"}
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
