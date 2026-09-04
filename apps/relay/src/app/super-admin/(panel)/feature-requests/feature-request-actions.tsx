"use client"

import { useState } from "react"

const STATUSES = [
  { value: "new",          label: "New" },
  { value: "under_review", label: "Under Review" },
  { value: "planned",      label: "Planned" },
  { value: "shipped",      label: "Shipped" },
  { value: "declined",     label: "Declined" },
]

export function FeatureRequestActions({
  id,
  currentStatus,
}: {
  id:            string
  currentStatus: string
}) {
  const [status,  setStatus]  = useState(currentStatus)
  const [saving,  setSaving]  = useState(false)

  async function update(newStatus: string) {
    if (newStatus === status) return
    setSaving(true)
    try {
      const res = await fetch(`/api/super-admin/feature-requests/${id}`, {
        method:  "PATCH",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      })
      if (res.ok) setStatus(newStatus)
    } finally {
      setSaving(false)
    }
  }

  return (
    <select
      value={status}
      onChange={e => update(e.target.value)}
      disabled={saving}
      className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 shrink-0"
    >
      {STATUSES.map(s => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  )
}
