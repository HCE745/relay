"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ScopeSelector } from "@/components/communications/scope-selector"
import type { SelectOption } from "@/components/ui/searchable-select"
import type { ScopeLead } from "@/components/communications/scope-selector"
import type { Person } from "@/components/ui/people-picker"

const PRIORITIES = ["normal", "urgent"] as const
const SCOPE_REQUIRES_ID = new Set(["location", "region", "department", "team", "individual"])

interface ScopeOption { value: string; label: string }

interface Props {
  locations:    SelectOption[]
  departments:  SelectOption[]
  teamLeads:    ScopeLead[]
  users:        Person[]
  scopeOptions: ScopeOption[]
}

export function AnnouncementForm({ locations, departments, teamLeads, users, scopeOptions }: Props) {
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
  const [scopeId, setScopeId] = useState("")

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  function handleScopeTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setForm(p => ({ ...p, scopeType: e.target.value }))
    setScopeId("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (SCOPE_REQUIRES_ID.has(form.scopeType) && !scopeId) {
      const label = scopeOptions.find(o => o.value === form.scopeType)?.label ?? form.scopeType
      setError(`Please select a specific ${label.toLowerCase()} for this announcement`)
      return
    }

    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/announcements", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          scopeId:   SCOPE_REQUIRES_ID.has(form.scopeType) ? scopeId : undefined,
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
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scope</label>
          <select value={form.scopeType} onChange={handleScopeTypeChange}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {scopeOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {SCOPE_REQUIRES_ID.has(form.scopeType) && (
        <div className="pl-3 border-l-2 border-blue-200 dark:border-blue-700">
          <ScopeSelector
            key={form.scopeType}
            scopeType={form.scopeType}
            scopeId={scopeId}
            onScopeIdChange={setScopeId}
            locations={locations}
            departments={departments}
            teamLeads={teamLeads}
            users={users}
          />
        </div>
      )}

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
