"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Select, Textarea } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { CONTRACT_STATUSES, CONTRACT_BILLING_FREQUENCIES } from "@/lib/zod-schemas"

type Option = { id: string; name: string }
const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", ACTIVE: "Active", EXPIRED: "Expired", CANCELLED: "Cancelled" }
const FREQ_LABEL: Record<string, string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", ANNUALLY: "Annually", ONE_TIME: "One-time" }

export type ContractValues = {
  id?: string
  customerId?: string
  title: string
  startDate?: string | null
  endDate?: string | null
  autoRenew?: boolean
  contractValue?: string | null
  billingFrequency?: string | null
  status?: string | null
  documentUrl?: string | null
  notes?: string | null
}

function ContractForm({ initial, customers, onDone }: { initial?: ContractValues; customers?: Option[]; onDone: () => void }) {
  const router = useRouter()
  const [v, setV] = useState<ContractValues>({
    customerId: initial?.customerId ?? customers?.[0]?.id ?? "",
    title: initial?.title ?? "",
    startDate: initial?.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: initial?.endDate ?? "",
    autoRenew: initial?.autoRenew ?? false,
    contractValue: initial?.contractValue ?? "",
    billingFrequency: initial?.billingFrequency ?? "MONTHLY",
    status: initial?.status ?? "DRAFT",
    documentUrl: initial?.documentUrl ?? "",
    notes: initial?.notes ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof ContractValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload: Record<string, unknown> = {
      title: v.title,
      startDate: v.startDate || undefined,
      endDate: v.endDate || undefined,
      autoRenew: !!v.autoRenew,
      contractValue: v.contractValue?.trim() || undefined,
      billingFrequency: v.billingFrequency,
      status: v.status,
      documentUrl: v.documentUrl?.trim() || undefined,
      notes: v.notes || undefined,
    }
    if (!initial?.id) payload.customerId = v.customerId
    const res = initial?.id
      ? await apiSend(`/api/contracts/${initial.id}`, "PATCH", payload)
      : await apiSend("/api/contracts", "POST", payload)
    setSaving(false)
    if (!res.ok) return setError(res.error)
    onDone()
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Contract title" htmlFor="k-title" hint="e.g. 2026 Janitorial Agreement">
        <Input id="k-title" required value={v.title} onChange={set("title")} />
      </Field>
      {!initial?.id && customers ? (
        <Field label="Customer" htmlFor="k-cust">
          <Select id="k-cust" value={v.customerId} onChange={set("customerId")} required>
            {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </Select>
        </Field>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" htmlFor="k-start"><Input id="k-start" type="date" value={v.startDate ?? ""} onChange={set("startDate")} required /></Field>
        <Field label="End date" htmlFor="k-end" hint="Blank = open-ended"><Input id="k-end" type="date" value={v.endDate ?? ""} onChange={set("endDate")} /></Field>
        <Field label="Contract value" htmlFor="k-value" hint="e.g. 24000 for $24k/yr"><Input id="k-value" inputMode="decimal" value={v.contractValue ?? ""} onChange={set("contractValue")} placeholder="0.00" /></Field>
        <Field label="Billing frequency" htmlFor="k-freq">
          <Select id="k-freq" value={v.billingFrequency ?? "MONTHLY"} onChange={set("billingFrequency")}>
            {CONTRACT_BILLING_FREQUENCIES.map((f) => (<option key={f} value={f}>{FREQ_LABEL[f]}</option>))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="k-status">
          <Select id="k-status" value={v.status ?? "DRAFT"} onChange={set("status")}>
            {CONTRACT_STATUSES.map((s) => (<option key={s} value={s}>{STATUS_LABEL[s]}</option>))}
          </Select>
        </Field>
        <Field label="Document link" htmlFor="k-doc" hint="URL to the signed doc (optional)"><Input id="k-doc" value={v.documentUrl ?? ""} onChange={set("documentUrl")} /></Field>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={!!v.autoRenew} onChange={(e) => setV((p) => ({ ...p, autoRenew: e.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
        Auto-renews (informational — no automatic processing)
      </label>
      <Field label="Notes" htmlFor="k-notes"><Textarea id="k-notes" value={v.notes ?? ""} onChange={set("notes")} /></Field>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={saving || (!initial?.id && !v.customerId)}>{saving ? "Saving…" : initial?.id ? "Save contract" : "Create contract"}</Button>
      </div>
    </form>
  )
}

export function NewContractButton({ customers, presetCustomerId }: { customers: Option[]; presetCustomerId?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={customers.length === 0}>New contract</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New contract">
        <ContractForm customers={customers} initial={presetCustomerId ? { title: "", customerId: presetCustomerId } : undefined} onDone={() => setOpen(false)} />
      </Modal>
    </>
  )
}

export function EditContractButton({ contract }: { contract: ContractValues }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit contract">
        <ContractForm initial={contract} onDone={() => setOpen(false)} />
      </Modal>
    </>
  )
}
