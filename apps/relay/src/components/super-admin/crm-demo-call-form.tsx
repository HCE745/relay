"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const LEAD_SOURCES = ["Website","Calendly","Referral","Cold Outreach","LinkedIn","Trade Show","Other"]
const STATUSES     = ["Scheduled","Completed","Cancelled","No Show","Rescheduled"]

interface DemoCallFormData {
  id?:            string
  contactName:    string
  contactEmail:   string
  contactPhone:   string
  companyName:    string
  industry:       string
  employeeCount:  string
  locationCount:  string
  leadSource:     string
  scheduledAt:    string
  callStatus:     string
  callNotes:      string
  painPoints:     string
  followUpDate:   string
  outcome:        string
  organizationId: string
}

interface Props {
  initial?:      Partial<DemoCallFormData>
  orgId?:        string
  onSuccess?:    (call: Record<string, unknown>) => void
  onCancel?:     () => void
}

export function CrmDemoCallForm({ initial, orgId, onSuccess, onCancel }: Props) {
  const router = useRouter()
  const isEdit = !!initial?.id

  const [form, setForm] = useState<DemoCallFormData>({
    contactName:    initial?.contactName    ?? "",
    contactEmail:   initial?.contactEmail   ?? "",
    contactPhone:   initial?.contactPhone   ?? "",
    companyName:    initial?.companyName    ?? "",
    industry:       initial?.industry       ?? "",
    employeeCount:  initial?.employeeCount  ?? "",
    locationCount:  initial?.locationCount  ?? "",
    leadSource:     initial?.leadSource     ?? "Website",
    scheduledAt:    initial?.scheduledAt    ?? "",
    callStatus:     initial?.callStatus     ?? "Scheduled",
    callNotes:      initial?.callNotes      ?? "",
    painPoints:     initial?.painPoints     ?? "",
    followUpDate:   initial?.followUpDate   ?? "",
    outcome:        initial?.outcome        ?? "",
    organizationId: initial?.organizationId ?? orgId ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState("")

  function set(field: keyof DemoCallFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contactName || !form.contactEmail || !form.companyName) {
      setError("Contact name, email, and company are required")
      return
    }
    setSaving(true)
    setError("")
    try {
      const url    = isEdit
        ? `/api/super-admin/crm/demo-calls/${initial!.id}`
        : `/api/super-admin/crm/demo-calls`
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          employeeCount: form.employeeCount ? parseInt(form.employeeCount) : undefined,
          locationCount: form.locationCount ? parseInt(form.locationCount) : undefined,
          scheduledAt:   form.scheduledAt || undefined,
          followUpDate:  form.followUpDate || undefined,
          organizationId: form.organizationId || undefined,
        }),
      })

      if (!res.ok) { setError("Failed to save"); return }
      const data = await res.json() as { call: Record<string, unknown> }
      onSuccess?.(data.call)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Contact Name *">
          <input value={form.contactName} onChange={e => set("contactName", e.target.value)}
            className={inputCls} placeholder="Jane Smith" required />
        </Field>
        <Field label="Contact Email *">
          <input type="email" value={form.contactEmail} onChange={e => set("contactEmail", e.target.value)}
            className={inputCls} placeholder="jane@company.com" required />
        </Field>
        <Field label="Phone">
          <input value={form.contactPhone} onChange={e => set("contactPhone", e.target.value)}
            className={inputCls} placeholder="+1 555 000 0000" />
        </Field>
        <Field label="Company Name *">
          <input value={form.companyName} onChange={e => set("companyName", e.target.value)}
            className={inputCls} placeholder="Acme Corp" required />
        </Field>
        <Field label="Industry">
          <input value={form.industry} onChange={e => set("industry", e.target.value)}
            className={inputCls} placeholder="Retail, Healthcare…" />
        </Field>
        <Field label="Lead Source">
          <select value={form.leadSource} onChange={e => set("leadSource", e.target.value)} className={inputCls}>
            {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Employees">
          <input type="number" value={form.employeeCount} onChange={e => set("employeeCount", e.target.value)}
            className={inputCls} placeholder="50" min={1} />
        </Field>
        <Field label="Locations">
          <input type="number" value={form.locationCount} onChange={e => set("locationCount", e.target.value)}
            className={inputCls} placeholder="3" min={1} />
        </Field>
        <Field label="Scheduled At">
          <input type="datetime-local" value={form.scheduledAt} onChange={e => set("scheduledAt", e.target.value)}
            className={inputCls} />
        </Field>
        <Field label="Status">
          <select value={form.callStatus} onChange={e => set("callStatus", e.target.value)} className={inputCls}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Follow-up Date">
          <input type="date" value={form.followUpDate} onChange={e => set("followUpDate", e.target.value)}
            className={inputCls} />
        </Field>
        <Field label="Outcome">
          <input value={form.outcome} onChange={e => set("outcome", e.target.value)}
            className={inputCls} placeholder="Positive, Needs More Info…" />
        </Field>
      </div>

      <Field label="Pain Points">
        <textarea value={form.painPoints} onChange={e => set("painPoints", e.target.value)}
          className={inputCls} rows={2} placeholder="What problems are they trying to solve?" />
      </Field>

      <Field label="Call Notes">
        <textarea value={form.callNotes} onChange={e => set("callNotes", e.target.value)}
          className={inputCls} rows={3} placeholder="Notes from the call…" />
      </Field>

      {!orgId && (
        <Field label="Linked Organization ID (optional)">
          <input value={form.organizationId} onChange={e => set("organizationId", e.target.value)}
            className={inputCls} placeholder="org_…" />
        </Field>
      )}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving…" : isEdit ? "Update Call" : "Create Call"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 border border-gray-200 text-sm rounded hover:bg-gray-50">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

const inputCls = "w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  )
}
