"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export type TaxRateRow = {
  id: string; name: string; jurisdiction: string | null; ratePct: number; isActive: boolean; effectiveDate: string
}
export type SiteTaxRow = {
  id: string; name: string; customerName: string; taxable: boolean; taxRateId: string | null
  taxRateName: string | null; taxRatePct: number | null
}

const blankRate = { name: "", jurisdiction: "", ratePct: "" }

export function TaxSettings({ rates, sites }: { rates: TaxRateRow[]; sites: SiteTaxRow[] }) {
  const router = useRouter()
  const [form, setForm] = useState({ ...blankRate })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const set = (k: keyof typeof blankRate, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError(null) }
  const activeRates = rates.filter((r) => r.isActive)

  function startEdit(r: TaxRateRow) {
    setEditingId(r.id)
    setForm({ name: r.name, jurisdiction: r.jurisdiction ?? "", ratePct: String(r.ratePct) })
    setError(null)
  }
  function cancel() { setEditingId(null); setForm({ ...blankRate }); setError(null) }

  async function submitRate() {
    if (!form.name.trim()) return setError("Name the rate")
    if (!form.ratePct.trim()) return setError("Enter a percent")
    setBusy(true); setError(null)
    const payload = { name: form.name, jurisdiction: form.jurisdiction, ratePct: form.ratePct }
    const res = editingId
      ? await apiSend(`/api/tax-rates/${editingId}`, "PATCH", payload)
      : await apiSend("/api/tax-rates", "POST", payload)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    cancel(); router.refresh()
  }
  async function deactivate(id: string) {
    if (!confirm("Deactivate this rate? Invoices already issued keep the rate they were billed at.")) return
    const res = await apiSend(`/api/tax-rates/${id}`, "DELETE")
    if (!res.ok) return setError(res.error)
    if (editingId === id) cancel()
    router.refresh()
  }

  async function saveSite(site: SiteTaxRow, next: { taxable: boolean; taxRateId: string | null }) {
    setRowBusy(site.id)
    const res = await apiSend(`/api/sites/${site.id}/tax`, "PATCH", next)
    setRowBusy(null)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card className="border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
        You are responsible for determining whether your services are taxable in your jurisdiction and at what rate.
        This tool applies the rates you configure; it is not tax advice. Cleaning services are <strong>not taxable by
        default</strong> here, so nothing is taxed until you turn it on per site below.
      </Card>

      {/* Jurisdiction rates */}
      <Card className="overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Jurisdiction rates</div>
        {rates.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No tax rates yet. Add the rate(s) that apply where you operate.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5 font-medium">Name</th><th className="px-4 py-2.5 font-medium">Jurisdiction</th><th className="px-4 py-2.5 text-right font-medium">Rate</th><th className="px-4 py-2.5"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rates.map((r) => (
                <tr key={r.id} className={r.isActive ? "hover:bg-slate-50" : "bg-slate-50/60 text-slate-400"}>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}{!r.isActive ? " (inactive)" : ""}</td>
                  <td className="px-4 py-3 text-slate-600">{r.jurisdiction ?? "-"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.ratePct}%</td>
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
        <h3 className="mb-4 text-sm font-semibold text-slate-700">{editingId ? "Edit rate" : "Add a rate"}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Name" htmlFor="tr-name"><Input id="tr-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Indiana sales tax" /></Field>
          <Field label="Jurisdiction" htmlFor="tr-juris"><Input id="tr-juris" value={form.jurisdiction} onChange={(e) => set("jurisdiction", e.target.value)} placeholder="Indiana" /></Field>
          <Field label="Rate (%)" htmlFor="tr-rate"><Input id="tr-rate" value={form.ratePct} onChange={(e) => set("ratePct", e.target.value)} placeholder="7" /></Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={submitRate} disabled={busy}>{busy ? "Saving…" : editingId ? "Save rate" : "Add rate"}</Button>
          {editingId ? <Button variant="secondary" onClick={cancel}>Cancel</Button> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </Card>

      {/* Per-site taxability */}
      <Card className="overflow-x-auto">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Taxable sites</div>
        {sites.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No active sites.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5 font-medium">Site</th><th className="px-4 py-2.5 font-medium">Customer</th><th className="px-4 py-2.5 font-medium">Taxable</th><th className="px-4 py-2.5 font-medium">Rate</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sites.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.customerName}</td>
                  <td className="px-4 py-3">
                    <Select
                      aria-label={`Taxable at ${s.name}`}
                      value={s.taxable ? "yes" : "no"}
                      disabled={rowBusy === s.id}
                      onChange={(e) => saveSite(s, { taxable: e.target.value === "yes", taxRateId: s.taxRateId })}
                    >
                      <option value="no">Not taxable</option>
                      <option value="yes">Taxable</option>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      aria-label={`Tax rate at ${s.name}`}
                      value={s.taxRateId ?? ""}
                      disabled={rowBusy === s.id || !s.taxable}
                      onChange={(e) => saveSite(s, { taxable: s.taxable, taxRateId: e.target.value || null })}
                    >
                      <option value="">{activeRates.length ? "Choose rate…" : "Add a rate first"}</option>
                      {activeRates.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.ratePct}%)</option>)}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
