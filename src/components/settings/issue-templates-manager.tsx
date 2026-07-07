"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, X, FileText } from "lucide-react"
import { ISSUE_CATEGORY, ISSUE_PRIORITY } from "@/lib/constants"

interface Template {
  id: string
  name: string
  category: string | null
  priority: string | null
  descriptionTemplate: string | null
}

const EMPTY: Omit<Template, "id"> = { name: "", category: "", priority: "", descriptionTemplate: "" }

export function IssueTemplatesManager({ templates: initial }: { templates: Template[] }) {
  const router = useRouter()
  const [templates, setTemplates] = useState(initial)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  function openCreate() { setEditingId(null); setForm(EMPTY); setError(""); setDialogOpen(true) }

  function openEdit(t: Template) {
    setEditingId(t.id)
    setForm({ name: t.name, category: t.category ?? "", priority: t.priority ?? "", descriptionTemplate: t.descriptionTemplate ?? "" })
    setError("")
    setDialogOpen(true)
  }

  function close() { setDialogOpen(false); setEditingId(null) }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    const url = editingId ? `/api/templates/${editingId}` : "/api/templates"
    const method = editingId ? "PUT" : "POST"
    const payload = { name: form.name, category: form.category || null, priority: form.priority || null, descriptionTemplate: form.descriptionTemplate || null }
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save"); return }
    const saved = await res.json()
    if (editingId) {
      setTemplates(prev => prev.map(t => t.id === editingId ? saved : t))
    } else {
      setTemplates(prev => [...prev, saved])
    }
    close()
    router.refresh()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/templates/${id}`, { method: "DELETE" })
    setTemplates(prev => prev.filter(t => t.id !== id))
    setDeleteConfirm(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-medium text-gray-900 text-sm">Issue Templates</h3>
          <p className="text-xs text-gray-500 mt-0.5">Pre-filled templates users can start from when submitting common issue types.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <FileText className="w-7 h-7 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No templates yet.</p>
          <p className="text-xs text-gray-400 mt-1">Create templates for common recurring issue types.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{t.name}</p>
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  {t.category && <span className="text-xs text-gray-500">{ISSUE_CATEGORY[t.category as keyof typeof ISSUE_CATEGORY] ?? t.category}</span>}
                  {t.priority && <span className="text-xs text-gray-500">· {ISSUE_PRIORITY[t.priority as keyof typeof ISSUE_PRIORITY] ?? t.priority}</span>}
                </div>
                {t.descriptionTemplate && (
                  <p className="text-xs text-gray-400 mt-1 truncate">{t.descriptionTemplate}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteConfirm(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl border p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Template</h3>
            <p className="text-sm text-gray-500 mb-4">This template will be permanently deleted.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl border w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingId ? "Edit Template" : "New Template"}</h3>
              <button onClick={close} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Template Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Forklift Inspection Failure"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Category</label>
                  <select value={form.category ?? ""} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Automatic</option>
                    {Object.entries(ISSUE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Priority</label>
                  <select value={form.priority ?? ""} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Automatic</option>
                    {Object.entries(ISSUE_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description Skeleton</label>
                <textarea
                  value={form.descriptionTemplate ?? ""}
                  onChange={e => setForm(f => ({ ...f, descriptionTemplate: e.target.value }))}
                  rows={4}
                  placeholder="Pre-fill the description field — e.g. Inspection point: &#10;Defect observed: &#10;Immediate action taken:"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={close} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 font-medium">
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
