"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Card, Field, Input, EmptyState } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export type ContactValue = {
  id: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
}

function ContactForm({
  customerId,
  initial,
  onDone,
}: {
  customerId: string
  initial?: ContactValue
  onDone: () => void
}) {
  const router = useRouter()
  const [v, setV] = useState({
    name: initial?.name ?? "",
    title: initial?.title ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    isPrimary: initial?.isPrimary ?? false,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = initial
      ? await apiSend(`/api/contacts/${initial.id}`, "PATCH", v)
      : await apiSend("/api/contacts", "POST", { ...v, customerId })
    setSaving(false)
    if (!res.ok) return setError(res.error)
    onDone()
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="ct-name">
          <Input id="ct-name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label="Title" htmlFor="ct-title">
          <Input id="ct-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <Field label="Email" htmlFor="ct-email">
          <Input id="ct-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        </Field>
        <Field label="Phone" htmlFor="ct-phone">
          <Input id="ct-phone" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={v.isPrimary} onChange={(e) => setV({ ...v, isPrimary: e.target.checked })} />
        Primary contact
      </label>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save" : "Add contact"}
        </Button>
      </div>
    </form>
  )
}

export function ContactsSection({ customerId, contacts }: { customerId: string; contacts: ContactValue[] }) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ mode: "new" } | { mode: "edit"; contact: ContactValue } | null>(null)

  async function remove(id: string) {
    if (!confirm("Delete this contact?")) return
    const res = await apiSend(`/api/contacts/${id}`, "DELETE")
    if (res.ok) router.refresh()
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Contacts</h2>
        <Button size="sm" onClick={() => setDialog({ mode: "new" })}>
          Add contact
        </Button>
      </div>
      {contacts.length === 0 ? (
        <EmptyState title="No contacts yet" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{c.name}</span>
                  {c.isPrimary ? (
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                      Primary
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500">
                  {[c.title, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setDialog({ mode: "edit", contact: c })}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(c.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={dialog !== null} onClose={() => setDialog(null)} title={dialog?.mode === "edit" ? "Edit contact" : "Add contact"}>
        {dialog ? (
          <ContactForm
            customerId={customerId}
            initial={dialog.mode === "edit" ? dialog.contact : undefined}
            onDone={() => setDialog(null)}
          />
        ) : null}
      </Modal>
    </Card>
  )
}
