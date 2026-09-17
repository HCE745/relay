"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type CustomerOption = { id: string; name: string }

type ExclusionsResult = {
  created: boolean
  invoiceId?: string
  invoiceNumber?: number
  lineCount?: number
  total?: string
  reason?: string
  excluded: { jobId: string; title: string; reason: string }[]
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}
function isoMonthStart(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

function GenerateForm({ customers, onDone }: { customers: CustomerOption[]; onDone: () => void }) {
  const router = useRouter()
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "")
  const [periodStart, setPeriodStart] = useState(isoMonthStart())
  const [periodEnd, setPeriodEnd] = useState(isoToday())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExclusionsResult | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await apiSend<ExclusionsResult>("/api/invoices", "POST", { customerId, periodStart, periodEnd })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setResult(res.data)
    router.refresh()
  }

  if (result) {
    return (
      <div className="space-y-4">
        {result.created ? (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Created draft invoice with {result.lineCount} line{result.lineCount === 1 ? "" : "s"} · total ${result.total}.
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No invoice created — {result.reason}.
          </div>
        )}
        {result.excluded.length > 0 ? (
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">
              {result.excluded.length} job{result.excluded.length === 1 ? "" : "s"} excluded:
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-600">
              {result.excluded.map((x) => (
                <li key={x.jobId} className="flex justify-between gap-3 border-b border-slate-100 py-1">
                  <span className="truncate">{x.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">{x.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onDone}>
            Close
          </Button>
          {result.created && result.invoiceId ? (
            <Link
              href={`/billing/invoices/${result.invoiceId}`}
              className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Open invoice
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600">
        Bill a customer for their <span className="font-medium">completed</span> jobs in a date range. Jobs already on a
        non-void invoice are skipped; hourly jobs with unapproved time are listed back to you, never dropped silently.
      </p>
      <Field label="Customer" htmlFor="inv-customer">
        <Select id="inv-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
          {customers.length === 0 ? <option value="">No customers</option> : null}
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Period start" htmlFor="inv-start">
          <Input id="inv-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
        </Field>
        <Field label="Period end" htmlFor="inv-end">
          <Input id="inv-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
        </Field>
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !customerId}>
          {busy ? "Generating…" : "Generate invoice"}
        </Button>
      </div>
    </form>
  )
}

export function GenerateInvoiceButton({ customers }: { customers: CustomerOption[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>New invoice</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Generate invoice">
        <GenerateForm customers={customers} onDone={() => setOpen(false)} />
      </Modal>
    </>
  )
}
