"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Trash2, Edit2, Loader2, AlertTriangle, FileText, Check, X } from "lucide-react"

const ISSUE_CATEGORIES = [
  { value: "",                    label: "— Any category —" },
  { value: "GENERAL",             label: "General" },
  { value: "EQUIPMENT_BREAKDOWN", label: "Equipment Breakdown" },
  { value: "SAFETY",              label: "Safety" },
  { value: "MAINTENANCE",         label: "Maintenance" },
  { value: "FACILITY",            label: "Facility" },
  { value: "VEHICLE",             label: "Vehicle" },
]

interface SOP {
  id:          string
  title:       string
  description: string | null
  category:    string | null
  version:     string
  isActive:    boolean
  createdAt:   string
}

interface Department {
  id:   string
  name: string
}

interface SOPForm {
  title:        string
  description:  string
  category:     string
  content:      string
  version:      string
  departmentId: string
}

const EMPTY_FORM: SOPForm = {
  title: "", description: "", category: "", content: "", version: "1.0", departmentId: "",
}

interface Props {
  onboardingId: string
  isPostLaunch: boolean
  onReady:      () => void
  onNotReady:   () => void
}

export function StepSOPs({ onboardingId, isPostLaunch, onReady, onNotReady }: Props) {
  const [sops, setSops]           = useState<SOP[]>([])
  const [depts, setDepts]         = useState<Department[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [form, setForm]           = useState<SOPForm>(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sopsRes, deptsRes] = await Promise.all([
        fetch(`/api/super-admin/onboarding/${onboardingId}/configure/sops`),
        fetch(`/api/super-admin/onboarding/${onboardingId}/configure/departments`),
      ])
      if (!sopsRes.ok) throw new Error("Failed to load SOPs")
      const sopList  = await sopsRes.json() as SOP[]
      const deptList = deptsRes.ok ? (await deptsRes.json() as Department[]) : []
      setSops(sopList)
      setDepts(deptList)
      if (sopList.length >= 1) onReady()
      else onNotReady()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [onboardingId, onReady, onNotReady])

  useEffect(() => { void load() }, [load])

  function openCreate() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(sop: SOP) {
    setEditId(sop.id)
    setForm({ title: sop.title, description: sop.description ?? "", category: sop.category ?? "", content: "", version: sop.version, departmentId: "" })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  async function handleSubmit() {
    if (!form.title.trim()) return setError("Title is required")
    if (!editId && !form.content.trim()) return setError("Content is required")
    setSaving(true)
    setError(null)
    try {
      if (editId) {
        const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/sops/${editId}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            title:       form.title.trim(),
            description: form.description.trim() || null,
            category:    form.category || null,
            version:     form.version  || "1.0",
          }),
        })
        if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Update failed")
        const updated = await res.json() as SOP
        setSops(s => s.map(x => x.id === editId ? { ...x, ...updated } : x))
      } else {
        const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/sops`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            title:        form.title.trim(),
            description:  form.description.trim() || undefined,
            category:     form.category || undefined,
            content:      form.content.trim(),
            version:      form.version || "1.0",
            departmentId: form.departmentId || undefined,
          }),
        })
        if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Create failed")
        const created = await res.json() as SOP
        const next = [...sops, created]
        setSops(next)
        if (next.length >= 1) onReady()
      }
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(sopId: string) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/sops/${sopId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete SOP")
      const next = sops.filter(s => s.id !== sopId)
      setSops(next)
      if (next.length === 0) onNotReady()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-900/40 rounded-lg text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* SOP list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">Standard Operating Procedures</span>
            <span className="text-xs text-gray-500 ml-1">({sops.length})</span>
          </div>
          {!isPostLaunch && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-800/50 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add SOP
            </button>
          )}
        </div>

        {sops.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-500">No SOPs yet. Add at least one so the system can suggest procedures to employees when they open related issues.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-800">
            {sops.map(sop => (
              <li key={sop.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-100">{sop.title}</span>
                    <span className="text-[10px] text-gray-600">v{sop.version}</span>
                    {sop.category && (
                      <span className="text-[10px] font-medium text-indigo-400 bg-indigo-900/30 border border-indigo-800/40 px-1.5 py-0.5 rounded">
                        {sop.category.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  {sop.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{sop.description}</p>
                  )}
                </div>
                {!isPostLaunch && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(sop)}
                      className="p-1.5 text-gray-500 hover:text-indigo-400 transition-colors"
                      title="Edit SOP"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(sop.id)}
                      disabled={saving}
                      className="p-1.5 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
                      title="Delete SOP"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && !isPostLaunch && (
        <div className="bg-gray-900 border border-indigo-800/40 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">{editId ? "Edit SOP" : "New SOP"}</h3>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Forklift Pre-Shift Checklist"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                {ISSUE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Department</label>
              <select
                value={form.departmentId}
                onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="">All departments</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief summary"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>
          {!editId && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Content *</label>
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Step-by-step SOP content (plain text or markdown)"
                rows={6}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 resize-y"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={closeForm} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {editId ? "Save Changes" : "Add SOP"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
