"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const PRIORITIES = ["normal", "urgent"] as const
const SCOPES     = ["org", "location", "department", "team"] as const

export function AnnouncementForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  const [form, setForm] = useState({
    title:                  "",
    body:                   "",
    priority:               "normal",
    scopeType:              "org",
    requiresAcknowledgment: false,
    expiresAt:              "",
  })

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/announcements", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          expiresAt: form.expiresAt || undefined,
        }),
      })
      const json = await res.json() as { announcement?: { id: string }; error?: string }
      if (!res.ok) { setError(json.error ?? "Failed to save"); return }
      router.push(`/communications/announcements/${json.announcement?.id}`)
      router.refresh()
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
        <input
          value={form.title} onChange={set("title")} required
          placeholder="Announcement headline"
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Body *</label>
        <textarea
          value={form.body} onChange={set("body")} required rows={5}
          placeholder="Full announcement text..."
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
          <select value={form.priority} onChange={set("priority")}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scope</label>
          <select value={form.scopeType} onChange={set("scopeType")}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expires (optional)</label>
        <input type="datetime-local" value={form.expiresAt} onChange={set("expiresAt")}
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.requiresAcknowledgment}
          onChange={e => setForm(p => ({ ...p, requiresAcknowledgment: e.target.checked }))}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">Require acknowledgment</span>
      </label>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? "Posting..." : "Post Announcement"}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
