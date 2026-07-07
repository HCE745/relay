"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

const STATUSES = [
  { value: "new",           label: "New" },
  { value: "investigating", label: "Investigating" },
  { value: "fixed",         label: "Fixed" },
  { value: "closed",        label: "Closed" },
]

export function BugReportActions({
  reportId,
  currentStatus,
  adminNotes: initialNotes,
}: {
  reportId:     string
  currentStatus: string
  adminNotes:   string
}) {
  const router    = useRouter()
  const [status,  setStatus]  = useState(currentStatus)
  const [notes,   setNotes]   = useState(initialNotes)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState("")

  async function save() {
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const res = await fetch(`/api/super-admin/bug-reports/${reportId}`, {
        method:  "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, adminNotes: notes }),
      })
      if (!res.ok) { setError("Failed to save"); return }
      setSaved(true)
      router.refresh()
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full sm:w-56">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Status</label>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Internal notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Investigation notes, links to fixes…"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {saved && <p className="text-xs text-green-400">Saved</p>}
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        Save
      </button>
    </div>
  )
}
