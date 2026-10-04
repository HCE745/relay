"use client"

import { useState } from "react"
import { Card, Field, Input } from "@/components/ui/controls"

type Row = { id: string; type: string; rowCount: number; createdByName: string | null; createdAt: string; periodStart: string | null; periodEnd: string | null }

const TYPE_LABEL: Record<string, string> = {
  QBO_INVOICES: "QuickBooks — Invoices", QBO_CUSTOMERS: "QuickBooks — Customers",
  XERO_INVOICES: "Xero — Invoices", XERO_CONTACTS: "Xero — Contacts",
  GUSTO_HOURS: "Gusto — Hours", ADP_HOURS: "ADP — Hours",
}
const fmtDT = (s: string) => new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })

function DownloadButton({ kind, label, from, to, periodic }: { kind: string; label: string; from: string; to: string; periodic: boolean }) {
  const qs = new URLSearchParams({ kind })
  if (periodic && from) qs.set("from", from)
  if (periodic && to) qs.set("to", to)
  return (
    <a href={`/api/exports?${qs.toString()}`} className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50">
      {label}
    </a>
  )
}

export function ExportsClient({ history }: { history: Row[] }) {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Date range</h2>
        <p className="mb-3 text-xs text-slate-500">Applies to invoice and payroll-hours exports. Customer/contact exports ignore it.</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From" htmlFor="e-from"><Input id="e-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To" htmlFor="e-to"><Input id="e-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Accounting</h2>
          <div className="flex flex-wrap gap-2">
            <DownloadButton kind="QBO_INVOICES" label="QuickBooks invoices" from={from} to={to} periodic />
            <DownloadButton kind="QBO_CUSTOMERS" label="QuickBooks customers" from={from} to={to} periodic={false} />
            <DownloadButton kind="XERO_INVOICES" label="Xero invoices" from={from} to={to} periodic />
            <DownloadButton kind="XERO_CONTACTS" label="Xero contacts" from={from} to={to} periodic={false} />
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Payroll hours</h2>
          <div className="flex flex-wrap gap-2">
            <DownloadButton kind="GUSTO_HOURS" label="Gusto hours" from={from} to={to} periodic />
            <DownloadButton kind="ADP_HOURS" label="ADP hours" from={from} to={to} periodic />
          </div>
          <p className="mt-3 text-xs text-slate-400">Approved time only. Overtime is left 0 — the app has no OT ruleset; set OT in your payroll provider.</p>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Export history</h2>
        {history.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-500">No exports yet.</Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2.5 font-medium">Export</th><th className="px-4 py-2.5 font-medium">When</th><th className="px-4 py-2.5 font-medium">By</th><th className="px-4 py-2.5 text-right font-medium">Rows</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{TYPE_LABEL[r.type] ?? r.type}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDT(r.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{r.createdByName ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.rowCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  )
}
