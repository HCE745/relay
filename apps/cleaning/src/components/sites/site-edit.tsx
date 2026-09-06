"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Button, Field, Input, Select, Textarea } from "@/components/ui/controls"
import { apiSend } from "@/lib/client"
import { listTimezones } from "@/lib/scheduling/timezones"

export type SiteEditValues = {
  id: string
  name: string
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  timezone: string | null
  siteContactName: string | null
  siteContactPhone: string | null
  notes: string | null
  isActive: boolean
}

export function SiteEditButton({ site }: { site: SiteEditValues }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [v, setV] = useState(site)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const zones = listTimezones()
  const set = (k: keyof SiteEditValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { id, ...data } = v
    const res = await apiSend(`/api/sites/${id}`, "PATCH", data)
    setSaving(false)
    if (!res.ok) return setError(res.error)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Edit site
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit service location">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Site name" htmlFor="se-name">
            <Input id="se-name" required value={v.name} onChange={set("name")} />
          </Field>
          <Field label="Street address" htmlFor="se-addr">
            <Input id="se-addr" value={v.addressLine1 ?? ""} onChange={set("addressLine1")} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City" htmlFor="se-city">
              <Input id="se-city" value={v.city ?? ""} onChange={set("city")} />
            </Field>
            <Field label="State" htmlFor="se-state">
              <Input id="se-state" value={v.state ?? ""} onChange={set("state")} />
            </Field>
            <Field label="Postal" htmlFor="se-postal">
              <Input id="se-postal" value={v.postalCode ?? ""} onChange={set("postalCode")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Site contact" htmlFor="se-contact">
              <Input id="se-contact" value={v.siteContactName ?? ""} onChange={set("siteContactName")} />
            </Field>
            <Field label="Site contact phone" htmlFor="se-phone">
              <Input id="se-phone" value={v.siteContactPhone ?? ""} onChange={set("siteContactPhone")} />
            </Field>
          </div>
          <Field label="Timezone" htmlFor="se-tz" hint="Overrides the organization default for scheduling this site.">
            <Select id="se-tz" value={v.timezone ?? ""} onChange={set("timezone")}>
              <option value="">Inherit organization default</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Access / site notes" htmlFor="se-notes">
            <Textarea id="se-notes" value={v.notes ?? ""} onChange={set("notes")} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} />
            Active
          </label>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
