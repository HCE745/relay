"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface SelectOption { id: string; name?: string; title?: string; role?: string }

interface Props {
  users:    { id: string; name: string; role: string }[]
  issues:   SelectOption[]
  assets:   SelectOption[]
  vendors:  SelectOption[]
  sops:     SelectOption[]
  initial?: {
    title?: string; description?: string; priority?: string; assigneeId?: string
    dueDate?: string; linkedIssueId?: string; linkedAssetId?: string
    linkedVendorId?: string; linkedSopId?: string; notes?: string
  }
  editId?: string
}

const PRIORITIES = ["low", "medium", "high", "critical"] as const

export function AssignmentForm({ users, issues, assets, vendors, sops, initial, editId }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  const [form, setForm] = useState({
    title:          initial?.title          ?? "",
    description:    initial?.description    ?? "",
    priority:       initial?.priority       ?? "medium",
    assigneeId:     initial?.assigneeId     ?? "",
    dueDate:        initial?.dueDate        ?? "",
    linkedIssueId:  initial?.linkedIssueId  ?? "",
    linkedAssetId:  initial?.linkedAssetId  ?? "",
    linkedVendorId: initial?.linkedVendorId ?? "",
    linkedSopId:    initial?.linkedSopId    ?? "",
    notes:          initial?.notes          ?? "",
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const body = {
        ...form,
        linkedIssueId:  form.linkedIssueId  || undefined,
        linkedAssetId:  form.linkedAssetId  || undefined,
        linkedVendorId: form.linkedVendorId || undefined,
        linkedSopId:    form.linkedSopId    || undefined,
        dueDate:        form.dueDate        || undefined,
        description:    form.description    || undefined,
        notes:          form.notes          || undefined,
      }

      const url    = editId ? `/api/assignments/${editId}` : "/api/assignments"
      const method = editId ? "PATCH" : "POST"
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json   = await res.json() as { assignment?: { id: string }; error?: string }
      if (!res.ok) { setError(json.error ?? "Failed to save"); return }
      router.push(`/assignments/${json.assignment?.id ?? ""}`)
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
          placeholder="What needs to be done?"
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
        <textarea
          value={form.description} onChange={set("description")} rows={3}
          placeholder="Additional details..."
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assignee *</label>
          <select
            value={form.assigneeId} onChange={set("assigneeId")} required
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select person...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
          <select
            value={form.priority} onChange={set("priority")}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
        <input
          type="datetime-local" value={form.dueDate} onChange={set("dueDate")}
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Link to (optional)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Issue</label>
            <select value={form.linkedIssueId} onChange={set("linkedIssueId")}
              className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {issues.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Asset</label>
            <select value={form.linkedAssetId} onChange={set("linkedAssetId")}
              className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Vendor</label>
            <select value={form.linkedVendorId} onChange={set("linkedVendorId")}
              className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">SOP</label>
            <select value={form.linkedSopId} onChange={set("linkedSopId")}
              className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {sops.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
        <textarea
          value={form.notes} onChange={set("notes")} rows={2}
          placeholder="Internal notes..."
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit" disabled={saving}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : editId ? "Save Changes" : "Create Assignment"}
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
