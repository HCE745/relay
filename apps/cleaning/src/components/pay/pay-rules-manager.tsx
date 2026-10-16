"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { PAY_BASES, PAY_SPLITS } from "@/lib/zod-schemas"

type Opt = { id: string; name: string }
export type PayRuleRow = {
  id: string; userId: string | null; role: string | null; basis: string; splitMode: string
  soloValue: string | null; pairValue: string | null; crewValue: string | null
  customerId: string | null; serviceLocationId: string | null; servicePlanId: string | null
  effectiveFrom: string; isActive: boolean; user: { name: string } | null
}

const ROLES = ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR", "CLEANER"]
const BASIS_LABEL: Record<string, string> = { HOURLY: "Hourly (uses the employee rate)", FLAT_PER_JOB: "Flat per job", PERCENT_OF_JOB_REVENUE: "Percent of job revenue" }
const SPLIT_LABEL: Record<string, string> = { PER_PERSON: "Per person (each crew member)", SPLIT_ACROSS_CREW: "Split across the crew" }
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()
const blank = { scope: "role", userId: "", role: "CLEANER", basis: "PERCENT_OF_JOB_REVENUE", splitMode: "PER_PERSON", soloValue: "", pairValue: "", crewValue: "", customerId: "", serviceLocationId: "", servicePlanId: "" }

export function PayRulesManager({ rules, employees, customers, sites, plans }: { rules: PayRuleRow[]; employees: Opt[]; customers: Opt[]; sites: Opt[]; plans: Opt[] }) {
  const router = useRouter()
  const [form, setForm] = useState({ ...blank })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof blank, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(null) }
  const isValue = form.basis !== "HOURLY"
  const unit = form.basis === "PERCENT_OF_JOB_REVENUE" ? "%" : "$"

  function startEdit(r: PayRuleRow) {
    setEditingId(r.id)
    setForm({
      scope: r.userId ? "employee" : "role", userId: r.userId ?? "", role: r.role ?? "CLEANER",
      basis: r.basis, splitMode: r.splitMode, soloValue: r.soloValue ?? "", pairValue: r.pairValue ?? "", crewValue: r.crewValue ?? "",
      customerId: r.customerId ?? "", serviceLocationId: r.serviceLocationId ?? "", servicePlanId: r.servicePlanId ?? "",
    })
    setError(null)
  }
  function cancel() { setEditingId(null); setForm({ ...blank }); setError(null) }

  async function submit() {
    if (form.scope === "employee" && !form.userId) return setError("Choose an employee")
    if (isValue && !form.soloValue) return setError("Set at least the solo rate")
    setBusy(true); setError(null)
    const payload = {
      userId: form.scope === "employee" ? form.userId : "", role: form.scope === "role" ? form.role : "",
      basis: form.basis, splitMode: form.splitMode,
      soloValue: isValue ? form.soloValue : "", pairValue: isValue ? form.pairValue : "", crewValue: isValue ? form.crewValue : "",
      customerId: form.customerId, serviceLocationId: form.serviceLocationId, servicePlanId: form.servicePlanId,
    }
    const res = editingId ? await apiSend(`/api/pay-rules/${editingId}`, "PATCH", payload) : await apiSend("/api/pay-rules", "POST", payload)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    cancel(); router.refresh()
  }
  async function remove(id: string) {
    if (!confirm("Delete this pay rule? Existing earnings already computed are not changed.")) return
    const res = await apiSend(`/api/pay-rules/${id}`, "DELETE")
    if (!res.ok) return setError(res.error)
    if (editingId === id) cancel()
    router.refresh()
  }

  const bands = (r: PayRuleRow) => {
    if (r.basis === "HOURLY") return "employee hourly rate"
    const u = r.basis === "PERCENT_OF_JOB_REVENUE" ? "%" : "$"
    const parts = [r.soloValue && `solo ${r.soloValue}${u}`, r.pairValue && `pair ${r.pairValue}${u}`, r.crewValue && `crew ${r.crewValue}${u}`].filter(Boolean)
    return parts.join(" · ") || "—"
  }
  const target = (r: PayRuleRow) => r.user?.name ?? (r.role ? titleCase(r.role) + "s" : "—")

  return (
    <div className="space-y-6">
      <Card className="overflow-x-auto">
        {rules.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No pay rules yet. Workers are paid by their hourly rate until you add a commission or flat rule.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5 font-medium">Applies to</th><th className="px-4 py-2.5 font-medium">Basis</th><th className="px-4 py-2.5 font-medium">Rates (by crew size)</th><th className="px-4 py-2.5 font-medium">Split</th><th className="px-4 py-2.5 font-medium">From</th><th className="px-4 py-2.5"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((r) => (
                <tr key={r.id} className={r.isActive ? "hover:bg-slate-50" : "bg-slate-50/60 text-slate-400"}>
                  <td className="px-4 py-3 font-medium text-slate-900">{target(r)}</td>
                  <td className="px-4 py-3 text-slate-600">{BASIS_LABEL[r.basis]?.split(" (")[0] ?? r.basis}</td>
                  <td className="px-4 py-3 text-slate-600">{bands(r)}</td>
                  <td className="px-4 py-3 text-slate-500">{r.basis === "HOURLY" ? "—" : r.splitMode === "SPLIT_ACROSS_CREW" ? "Split" : "Per person"}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(r.effectiveFrom).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(r)} className="mr-3 text-sm font-medium text-brand hover:underline">Edit</button>
                    <button onClick={() => remove(r.id)} className="text-sm font-medium text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">{editingId ? "Edit pay rule" : "Add a pay rule"}</h3>
        <p className="mb-4 text-xs text-slate-500">Most specific wins: an employee rule beats a role rule, a customer/site/plan override beats a general one, and the most recent effective date wins ties. Amounts are for export only (no tax or withholding).</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Applies to" htmlFor="pr-scope"><Select id="pr-scope" value={form.scope} onChange={(e) => set("scope", e.target.value)}><option value="role">A role</option><option value="employee">One employee</option></Select></Field>
          {form.scope === "employee"
            ? <Field label="Employee" htmlFor="pr-emp"><Select id="pr-emp" value={form.userId} onChange={(e) => set("userId", e.target.value)}><option value="">Choose…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
            : <Field label="Role" htmlFor="pr-role"><Select id="pr-role" value={form.role} onChange={(e) => set("role", e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</Select></Field>}
          <Field label="Basis" htmlFor="pr-basis"><Select id="pr-basis" value={form.basis} onChange={(e) => set("basis", e.target.value)}>{PAY_BASES.map((b) => <option key={b} value={b}>{BASIS_LABEL[b]}</option>)}</Select></Field>
          {isValue ? <>
            <Field label={`Solo (${unit})`} htmlFor="pr-solo" hint="1 worker"><Input id="pr-solo" value={form.soloValue} onChange={(e) => set("soloValue", e.target.value)} placeholder={unit === "%" ? "40" : "25.00"} /></Field>
            <Field label={`Pair (${unit})`} htmlFor="pr-pair" hint="2 workers"><Input id="pr-pair" value={form.pairValue} onChange={(e) => set("pairValue", e.target.value)} placeholder={unit === "%" ? "25" : "15.00"} /></Field>
            <Field label={`Crew of 3+ (${unit})`} htmlFor="pr-crew" hint="3 or more"><Input id="pr-crew" value={form.crewValue} onChange={(e) => set("crewValue", e.target.value)} placeholder={unit === "%" ? "20" : "12.00"} /></Field>
            <Field label="Percentage reading" htmlFor="pr-split"><Select id="pr-split" value={form.splitMode} onChange={(e) => set("splitMode", e.target.value)}>{PAY_SPLITS.map((s) => <option key={s} value={s}>{SPLIT_LABEL[s]}</option>)}</Select></Field>
          </> : null}
          <Field label="Customer override" htmlFor="pr-cust"><Select id="pr-cust" value={form.customerId} onChange={(e) => set("customerId", e.target.value)}><option value="">Any customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Site override" htmlFor="pr-site"><Select id="pr-site" value={form.serviceLocationId} onChange={(e) => set("serviceLocationId", e.target.value)}><option value="">Any site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Service plan override" htmlFor="pr-plan"><Select id="pr-plan" value={form.servicePlanId} onChange={(e) => set("servicePlanId", e.target.value)}><option value="">Any service</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
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
