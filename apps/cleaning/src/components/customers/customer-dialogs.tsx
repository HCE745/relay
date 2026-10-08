"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Select, Textarea } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

const PAYMENT_TERMS_LABEL: Record<string, string> = {
  DUE_ON_RECEIPT: "Due on receipt",
  NET_15: "Net 15",
  NET_30: "Net 30",
}

export type CustomerValues = {
  id?: string
  name: string
  primaryContactName?: string | null
  email?: string | null
  phone?: string | null
  billingAddress?: string | null
  billingEmail?: string | null
  paymentTerms?: string | null
  notes?: string | null
}

function CustomerForm({ initial, onDone }: { initial?: CustomerValues; onDone: () => void }) {
  const router = useRouter()
  const [values, setValues] = useState<CustomerValues>({
    name: initial?.name ?? "",
    primaryContactName: initial?.primaryContactName ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    billingAddress: initial?.billingAddress ?? "",
    billingEmail: initial?.billingEmail ?? "",
    paymentTerms: initial?.paymentTerms ?? "DUE_ON_RECEIPT",
    notes: initial?.notes ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<{ kind: string; reason: string; note?: string }[] | null>(null)
  const [saving, setSaving] = useState(false)
  const set =
    (k: keyof CustomerValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = initial?.id
      ? await apiSend(`/api/customers/${initial.id}`, "PATCH", values)
      : await apiSend<{ intakeExclusions?: { kind: string; reason: string; note?: string }[] }>("/api/customers", "POST", values)
    setSaving(false)
    if (!res.ok) return setError(res.error)
    // Do-not-serve match — the customer WAS created; surface a clear flag for staff to acknowledge.
    const flags = !initial?.id && res.ok ? (res.data as { intakeExclusions?: { kind: string; reason: string; note?: string }[] }).intakeExclusions : undefined
    if (flags && flags.length > 0) {
      setWarnings(flags)
      router.refresh()
      return
    }
    onDone()
    router.refresh()
  }

  if (warnings) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Heads up — this contact is on the do-not-serve list</p>
          <p className="mt-1 text-sm text-amber-800">The customer was created, but review before scheduling work:</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {warnings.map((w, i) => (
              <li key={i}>• {w.reason.replaceAll("_", " ").toLowerCase()}{w.note ? ` — ${w.note}` : ""}</li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end"><Button onClick={onDone}>Got it</Button></div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Customer name" htmlFor="c-name">
        <Input id="c-name" required value={values.name} onChange={set("name")} placeholder="Acme Facilities LLC" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Primary contact" htmlFor="c-contact">
          <Input id="c-contact" value={values.primaryContactName ?? ""} onChange={set("primaryContactName")} />
        </Field>
        <Field label="Phone" htmlFor="c-phone">
          <Input id="c-phone" value={values.phone ?? ""} onChange={set("phone")} />
        </Field>
      </div>
      <Field label="Email" htmlFor="c-email">
        <Input id="c-email" type="email" value={values.email ?? ""} onChange={set("email")} />
      </Field>
      <Field label="Billing / contact address" htmlFor="c-addr">
        <Textarea id="c-addr" value={values.billingAddress ?? ""} onChange={set("billingAddress")} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Billing email" htmlFor="c-billemail" hint="Where invoices are addressed">
          <Input id="c-billemail" type="email" value={values.billingEmail ?? ""} onChange={set("billingEmail")} />
        </Field>
        <Field label="Payment terms" htmlFor="c-terms">
          <Select id="c-terms" value={values.paymentTerms ?? "DUE_ON_RECEIPT"} onChange={set("paymentTerms")}>
            {Object.entries(PAYMENT_TERMS_LABEL).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Notes" htmlFor="c-notes">
        <Textarea id="c-notes" value={values.notes ?? ""} onChange={set("notes")} />
      </Field>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial?.id ? "Save changes" : "Create customer"}
        </Button>
      </div>
    </form>
  )
}

export function NewCustomerButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>New customer</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New customer">
        <CustomerForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  )
}

export function EditCustomerButton({ customer }: { customer: CustomerValues }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit customer">
        <CustomerForm initial={customer} onDone={() => setOpen(false)} />
      </Modal>
    </>
  )
}
