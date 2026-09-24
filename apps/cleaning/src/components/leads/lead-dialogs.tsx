"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Select, Textarea } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { LEAD_STATUSES } from "@/lib/zod-schemas"

export type LeadValues = {
  id?: string
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  source?: string | null
  status?: string | null
  notes?: string | null
  assignedToId?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  ESTIMATING: "Estimating",
  WON: "Won",
  LOST: "Lost",
}

function LeadForm({ initial, assignees, onDone }: { initial?: LeadValues; assignees: { id: string; name: string }[]; onDone: () => void }) {
  const router = useRouter()
  const [v, setV] = useState<LeadValues>({
    name: initial?.name ?? "",
    company: initial?.company ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    source: initial?.source ?? "",
    status: initial?.status ?? "NEW",
    notes: initial?.notes ?? "",
    assignedToId: initial?.assignedToId ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof LeadValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = { ...v, assignedToId: v.assignedToId || undefined }
    const res = initial?.id
      ? await apiSend(`/api/leads/${initial.id}`, "PATCH", payload)
      : await apiSend("/api/leads", "POST", payload)
    setSaving(false)
    if (!res.ok) return setError(res.error)
    onDone()
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Contact name" htmlFor="l-name">
          <Input id="l-name" required value={v.name} onChange={set("name")} />
        </Field>
        <Field label="Company" htmlFor="l-company">
          <Input id="l-company" value={v.company ?? ""} onChange={set("company")} />
        </Field>
        <Field label="Email" htmlFor="l-email">
          <Input id="l-email" type="email" value={v.email ?? ""} onChange={set("email")} />
        </Field>
        <Field label="Phone" htmlFor="l-phone">
          <Input id="l-phone" value={v.phone ?? ""} onChange={set("phone")} />
        </Field>
        <Field label="Source" htmlFor="l-source" hint="Referral, website, cold call…">
          <Input id="l-source" value={v.source ?? ""} onChange={set("source")} />
        </Field>
        <Field label="Status" htmlFor="l-status">
          <Select id="l-status" value={v.status ?? "NEW"} onChange={set("status")}>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assigned to" htmlFor="l-assignee">
          <Select id="l-assignee" value={v.assignedToId ?? ""} onChange={set("assignedToId")}>
            <option value="">— Unassigned —</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Notes" htmlFor="l-notes">
        <Textarea id="l-notes" value={v.notes ?? ""} onChange={set("notes")} />
      </Field>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial?.id ? "Save lead" : "Create lead"}
        </Button>
      </div>
    </form>
  )
}

export function NewLeadButton({ assignees }: { assignees: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>New lead</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New lead">
        <LeadForm assignees={assignees} onDone={() => setOpen(false)} />
      </Modal>
    </>
  )
}

export function LeadRowActions({ lead, assignees }: { lead: LeadValues; assignees: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex justify-end gap-1">
      <Link
        href={`/estimates/new?leadId=${lead.id}`}
        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand hover:bg-slate-100"
      >
        New estimate
      </Link>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit lead">
        <LeadForm initial={lead} assignees={assignees} onDone={() => setOpen(false)} />
      </Modal>
    </div>
  )
}
