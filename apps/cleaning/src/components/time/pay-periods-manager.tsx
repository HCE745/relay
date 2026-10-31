"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Field, Input } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export type PayPeriodRow = {
  id: string; start: string; end: string; status: "OPEN" | "LOCKED"
  lockedByName: string | null; lockedAt: string | null; exportCount: number
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

export function PayPeriodsManager({ periods, canUnlock }: { periods: PayPeriodRow[]; canUnlock: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState({ start: "", end: "" })
  const [busy, setBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    if (!form.start || !form.end) return setError("Choose a start and end date")
    setBusy(true); setError(null)
    const res = await apiSend("/api/pay-periods", "POST", form)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setForm({ start: "", end: "" }); router.refresh()
  }
  async function lock(id: string) {
    if (!confirm("Lock this period? Time entries and commission earnings in it will be frozen until an owner or admin unlocks it.")) return
    setRowBusy(id); setError(null)
    const res = await apiSend(`/api/pay-periods/${id}/lock`, "POST")
    setRowBusy(null)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }
  async function unlock(id: string) {
    const reason = prompt("Unlocking reopens this period for edits. Enter a reason (recorded in the audit log):")
    if (reason == null) return
    if (!reason.trim()) return setError("A reason is required to unlock")
    setRowBusy(id); setError(null)
    const res = await apiSend(`/api/pay-periods/${id}/unlock`, "POST", { reason })
    setRowBusy(null)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
        Locking a pay period freezes its time entries, corrections, approvals and commission earnings so an exported
        payroll period can&apos;t change afterward. Only an owner or admin can unlock, and the reason is recorded.
      </Card>

      <Card className="overflow-x-auto">
        {periods.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No pay periods yet. Add one for each payroll run you want to freeze after export.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2.5 font-medium">Period</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Exports</th><th className="px-4 py-2.5"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{fmt(p.start)} – {fmt(p.end)}</td>
                  <td className="px-4 py-3">
                    {p.status === "LOCKED" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Locked{p.lockedByName ? ` · ${p.lockedByName}` : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Open</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.exportCount}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {p.status === "OPEN" ? (
                      <button disabled={rowBusy === p.id} onClick={() => lock(p.id)} className="text-sm font-medium text-brand hover:underline disabled:opacity-50">Lock</button>
                    ) : canUnlock ? (
                      <button disabled={rowBusy === p.id} onClick={() => unlock(p.id)} className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50">Unlock</button>
                    ) : (
                      <span className="text-xs text-slate-400">Owner/admin only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Add a pay period</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Start" htmlFor="pp-start"><Input id="pp-start" type="date" value={form.start} onChange={(e) => { setForm((f) => ({ ...f, start: e.target.value })); setError(null) }} /></Field>
          <Field label="End" htmlFor="pp-end"><Input id="pp-end" type="date" value={form.end} onChange={(e) => { setForm((f) => ({ ...f, end: e.target.value })); setError(null) }} /></Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={add} disabled={busy}>{busy ? "Adding…" : "Add period"}</Button>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </Card>
    </div>
  )
}
