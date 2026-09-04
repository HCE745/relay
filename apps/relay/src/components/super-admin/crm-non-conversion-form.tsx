"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const REASON_CATEGORIES = [
  "Too Expensive",
  "Missing Features",
  "Chose Competitor",
  "Not Ready / Timing",
  "No Response",
  "Poor Demo",
  "Technical Issues",
  "Company Too Small",
  "Company Too Large",
  "Internal Decision",
  "Other",
]

interface Props {
  orgId: string
  onSuccess?: () => void
}

export function CrmNonConversionForm({ orgId, onSuccess }: Props) {
  const router   = useRouter()
  const [reason, setReason]   = useState("")
  const [detail, setDetail]   = useState("")
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) { setError("Please select a reason category"); return }
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/super-admin/crm/non-conversion/${orgId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reasonCategory: reason, reasonDetail: detail || undefined }),
      })
      if (!res.ok) { setError("Failed to save"); return }
      onSuccess?.()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <p className="text-sm font-medium text-yellow-800">Log Non-Conversion Reason</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <select
        value={reason}
        onChange={e => setReason(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Select a reason…</option>
        {REASON_CATEGORIES.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <textarea
        value={detail}
        onChange={e => setDetail(e.target.value)}
        placeholder="Additional detail (optional)…"
        rows={2}
        className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
      />
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Log Reason"}
      </button>
    </form>
  )
}
