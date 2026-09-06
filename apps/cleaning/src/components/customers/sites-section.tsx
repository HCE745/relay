"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Card, Field, Input, Textarea, StatusPill, EmptyState } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"

export type SiteValue = {
  id: string
  name: string
  city: string | null
  state: string | null
  isActive: boolean
}

export function SiteForm({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const router = useRouter()
  const [v, setV] = useState({
    name: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    siteContactName: "",
    siteContactPhone: "",
    notes: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await apiSend("/api/sites", "POST", { ...v, customerId })
    setSaving(false)
    if (!res.ok) return setError(res.error)
    onDone()
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Site name" htmlFor="s-name" hint="e.g. Downtown Office — 4th Floor">
        <Input id="s-name" required value={v.name} onChange={set("name")} />
      </Field>
      <Field label="Street address" htmlFor="s-addr">
        <Input id="s-addr" value={v.addressLine1} onChange={set("addressLine1")} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="City" htmlFor="s-city">
          <Input id="s-city" value={v.city} onChange={set("city")} />
        </Field>
        <Field label="State" htmlFor="s-state">
          <Input id="s-state" value={v.state} onChange={set("state")} />
        </Field>
        <Field label="Postal" htmlFor="s-postal">
          <Input id="s-postal" value={v.postalCode} onChange={set("postalCode")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Site contact" htmlFor="s-contact" hint="If different from the customer contact">
          <Input id="s-contact" value={v.siteContactName} onChange={set("siteContactName")} />
        </Field>
        <Field label="Site contact phone" htmlFor="s-cphone">
          <Input id="s-cphone" value={v.siteContactPhone} onChange={set("siteContactPhone")} />
        </Field>
      </div>
      <Field label="Access / site notes" htmlFor="s-notes" hint="Gate codes, alarm, parking, key location…">
        <Textarea id="s-notes" value={v.notes} onChange={set("notes")} />
      </Field>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Add site"}
        </Button>
      </div>
    </form>
  )
}

export function SitesSection({ customerId, sites }: { customerId: string; sites: SiteValue[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Service locations</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          Add site
        </Button>
      </div>
      {sites.length === 0 ? (
        <EmptyState title="No service locations yet">Add the first site this customer wants cleaned.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sites.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2.5">
              <Link href={`/customers/${customerId}/sites/${s.id}`} className="group">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 group-hover:text-brand">{s.name}</span>
                  <StatusPill active={s.isActive} />
                </div>
                <div className="text-xs text-slate-500">{[s.city, s.state].filter(Boolean).join(", ") || "—"}</div>
              </Link>
              <Link
                href={`/customers/${customerId}/sites/${s.id}`}
                className="text-sm font-medium text-brand hover:underline"
              >
                Open →
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add service location">
        <SiteForm customerId={customerId} onDone={() => setOpen(false)} />
      </Modal>
    </Card>
  )
}
