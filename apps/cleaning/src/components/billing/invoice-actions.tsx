"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Select } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

type Props = { invoiceId: string; status: string; balance: string; emailConfigured: boolean; hasBillingEmail: boolean }

function PaymentForm({ invoiceId, balance, onDone }: { invoiceId: string; balance: string; onDone: () => void }) {
  const router = useRouter()
  const [amount, setAmount] = useState(balance)
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState("")
  const [reference, setReference] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await apiSend(`/api/invoices/${invoiceId}/payments`, "POST", {
      amount,
      receivedDate,
      method: method || undefined,
      reference: reference || undefined,
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    onDone()
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount" htmlFor="pay-amount">
          <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Received" htmlFor="pay-date">
          <Input id="pay-date" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Method" htmlFor="pay-method">
          <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">—</option>
            <option value="Check">Check</option>
            <option value="ACH">ACH</option>
            <option value="Card">Card</option>
            <option value="Cash">Cash</option>
            <option value="Other">Other</option>
          </Select>
        </Field>
        <Field label="Reference" htmlFor="pay-ref">
          <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check #, txn id" />
        </Field>
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Record payment"}
        </Button>
      </div>
    </form>
  )
}

export function InvoiceActions({ invoiceId, status, balance, emailConfigured, hasBillingEmail }: Props) {
  const router = useRouter()
  const [payOpen, setPayOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailed, setEmailed] = useState(false)

  async function setStatus(next: "SENT" | "VOID", confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setBusy(true)
    setError(null)
    const res = await apiSend(`/api/invoices/${invoiceId}`, "PATCH", { status: next })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }

  async function email() {
    if (!window.confirm("Email this invoice (with the PDF attached) to the customer?")) return
    setBusy(true)
    setError(null)
    const res = await apiSend(`/api/invoices/${invoiceId}/send-email`, "POST", {})
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setEmailed(true)
    router.refresh()
  }

  const canPay = status === "SENT" || status === "PARTIALLY_PAID"

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {status === "DRAFT" ? <Button size="sm" disabled={busy} onClick={() => setStatus("SENT")}>Mark as sent</Button> : null}
      {canPay ? <Button size="sm" disabled={busy} onClick={() => setPayOpen(true)}>Record payment</Button> : null}
      {/* Email is shown ONLY when a real sender is configured AND we have an address — never a dead Send. */}
      {emailConfigured && hasBillingEmail && status !== "VOID" ? (
        <Button size="sm" variant="secondary" disabled={busy || emailed} onClick={email}>
          {emailed ? "Emailed ✓" : "Email to customer"}
        </Button>
      ) : null}
      {status !== "VOID" ? (
        <Button size="sm" variant="danger" disabled={busy} onClick={() => setStatus("VOID", "Void this invoice? Its jobs become billable again.")}>
          Void
        </Button>
      ) : null}
      {error ? <span className="w-full text-right text-sm text-red-700">{error}</span> : null}

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record payment">
        <PaymentForm invoiceId={invoiceId} balance={balance} onDone={() => setPayOpen(false)} />
      </Modal>
    </div>
  )
}
