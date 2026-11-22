"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Loader2, X, Users, ChevronDown, ChevronUp, Sparkles } from "lucide-react"
import { CONFIGURABLE_PAGES, CONFIGURABLE_ACTIONS } from "@/lib/page-access"
import { EMPLOYEE_TYPE_PRESETS } from "@/lib/employee-type-presets"

type EmployeeType = {
  id:             string
  name:           string
  description:    string | null
  baseRole:       string
  pageAccess:     string[]
  actions:        string[]
  canInvite:      boolean
  canChangeEmail: boolean
}

type Props = {
  onboardingId: string
  isPostLaunch: boolean
  onReady:    () => void
  onNotReady: () => void
}

const BASE_ROLES = [
  { value: "EMPLOYEE",   label: "Employee",   description: "Standard worker with task access" },
  { value: "SUPERVISOR", label: "Supervisor",  description: "Team lead with approval rights" },
  { value: "MANAGER",    label: "Manager",     description: "Department manager with reporting" },
  { value: "HR",         label: "HR",          description: "HR personnel with employee management" },
  { value: "ADMIN",      label: "Admin",       description: "Full org admin access" },
]

const EMPTY_FORM = {
  name: "", description: "", baseRole: "EMPLOYEE",
  pageAccess: [] as string[], actions: [] as string[],
  canInvite: false, canChangeEmail: true,
}

type FormState = typeof EMPTY_FORM

export function StepEmployeeTypes({ onboardingId, isPostLaunch, onReady, onNotReady }: Props) {
  const [types, setTypes]         = useState<EmployeeType[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [showForm, setShowForm]     = useState(false)
  const [editId, setEditId]         = useState<string | null>(null)
  const [form, setForm]             = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [deleting, setDeleting]     = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [expandedId, setExpandedId]   = useState<string | null>(null)

  const baseUrl = `/api/super-admin/onboarding/${onboardingId}/configure/employee-types`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(baseUrl)
      if (!res.ok) throw new Error("Failed to load")
      const json = await res.json() as EmployeeType[]
      setTypes(json)
      json.length >= 1 ? onReady() : onNotReady()
    } catch {
      setError("Failed to load employee types.")
    } finally {
      setLoading(false)
    }
  }, [baseUrl, onReady, onNotReady])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowPresets(false)
    setShowForm(true)
  }

  function openEdit(t: EmployeeType) {
    setEditId(t.id)
    setForm({
      name:           t.name,
      description:    t.description ?? "",
      baseRole:       t.baseRole,
      pageAccess:     Array.isArray(t.pageAccess) ? t.pageAccess : [],
      actions:        Array.isArray(t.actions)    ? t.actions    : [],
      canInvite:      t.canInvite,
      canChangeEmail: t.canChangeEmail,
    })
    setFormError(null)
    setShowPresets(false)
    setShowForm(true)
  }

  function applyPreset(key: string) {
    const preset = EMPLOYEE_TYPE_PRESETS.find(p => p.key === key)
    if (!preset) return
    setForm(f => ({
      ...f,
      name:           f.name || preset.name,
      description:    f.description || preset.description,
      baseRole:       preset.baseRole,
      pageAccess:     [...preset.pageAccess],
      actions:        [...preset.actions],
      canInvite:      preset.canInvite,
      canChangeEmail: preset.canChangeEmail,
    }))
    setShowPresets(false)
  }

  function closeForm() {
    setShowForm(false); setEditId(null); setFormError(null); setShowPresets(false)
  }

  function togglePage(key: string) {
    setForm(f => ({
      ...f,
      pageAccess: f.pageAccess.includes(key) ? f.pageAccess.filter(k => k !== key) : [...f.pageAccess, key],
    }))
  }

  function toggleAction(key: string) {
    setForm(f => ({
      ...f,
      actions: f.actions.includes(key) ? f.actions.filter(k => k !== key) : [...f.actions, key],
    }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError("Name is required."); return }
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        name:           form.name.trim(),
        description:    form.description.trim() || null,
        baseRole:       form.baseRole,
        pageAccess:     form.pageAccess,
        actions:        form.actions,
        canInvite:      form.canInvite,
        canChangeEmail: form.canChangeEmail,
      }
      const url    = editId ? `${baseUrl}/${editId}` : baseUrl
      const method = editId ? "PATCH" : "POST"
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? "Save failed")
      }
      closeForm()
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const res = await fetch(`${baseUrl}/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? "Delete failed")
      }
      setDeleteId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
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
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
      )}

      {!isPostLaunch && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {types.length === 0
              ? "No employee types yet. Add at least one."
              : `${types.length} employee type${types.length === 1 ? "" : "s"} configured.`}
          </p>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Employee Type
          </button>
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && !isPostLaunch && (
        <div className="bg-gray-900 border border-indigo-800/50 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">{editId ? "Edit Employee Type" : "Add Employee Type"}</h4>
            <button onClick={closeForm} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
          </div>

          {!editId && (
            <div className="relative">
              <button
                onClick={() => setShowPresets(s => !s)}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Load from preset
                {showPresets ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showPresets && (
                <div className="absolute z-10 top-full mt-1 left-0 w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-auto max-h-56">
                  {EMPLOYEE_TYPE_PRESETS.map(preset => (
                    <button
                      key={preset.key}
                      onClick={() => applyPreset(preset.key)}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0"
                    >
                      <p className="text-xs font-semibold text-white">{preset.name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">{preset.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {formError && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded px-2 py-1">{formError}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Name <span className="text-red-400">*</span></label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Production Associate"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Base Role <span className="text-red-400">*</span></label>
              <select
                value={form.baseRole}
                onChange={e => setForm(f => ({ ...f, baseRole: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {BASE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.description}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe this role to users who see it during onboarding…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Page access */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              Page Access <span className="text-gray-600 font-normal normal-case">— which pages this type can see</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {CONFIGURABLE_PAGES.map(p => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form.pageAccess.includes(p.key)}
                    onChange={() => togglePage(p.key)}
                    className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs text-gray-400 group-hover:text-gray-300">{p.label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <button onClick={() => setForm(f => ({ ...f, pageAccess: CONFIGURABLE_PAGES.map(p => p.key) }))}
                className="text-[11px] text-indigo-400 hover:text-indigo-300">Select all</button>
              <button onClick={() => setForm(f => ({ ...f, pageAccess: [] }))}
                className="text-[11px] text-gray-500 hover:text-gray-300">Clear all</button>
            </div>
          </div>

          {/* Actions */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              Actions <span className="text-gray-600 font-normal normal-case">— what this type can do beyond viewing</span>
            </label>
            <div className="space-y-1.5">
              {CONFIGURABLE_ACTIONS.map(a => (
                <label key={a.key} className="flex items-start gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form.actions.includes(a.key)}
                    onChange={() => toggleAction(a.key)}
                    className="mt-0.5 w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-0 cursor-pointer flex-shrink-0"
                  />
                  <span className="text-xs">
                    <span className="text-gray-300 group-hover:text-white font-medium">{a.label}</span>
                    {" "}<span className="text-gray-600">{a.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* canInvite + canChangeEmail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.canInvite}
                onChange={e => setForm(f => ({ ...f, canInvite: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-0"
              />
              <span className="text-xs">
                <span className="text-gray-300 font-medium">Can invite team members</span>
                <span className="block text-gray-600">May send invitations to new users</span>
              </span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.canChangeEmail}
                onChange={e => setForm(f => ({ ...f, canChangeEmail: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-0"
              />
              <span className="text-xs">
                <span className="text-gray-300 font-medium">Can change email address</span>
                <span className="block text-gray-600">May update their own email in account settings</span>
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editId ? "Save Changes" : "Add Employee Type"}
            </button>
            <button onClick={closeForm} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-300">Cancel</button>
          </div>
        </div>
      )}

      {/* Type list */}
      {types.length > 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800/60">
          {types.map(t => {
            const isExpanded = expandedId === t.id
            const pageCount  = Array.isArray(t.pageAccess) ? t.pageAccess.length : 0
            const actCount   = Array.isArray(t.actions)    ? t.actions.length    : 0
            return (
              <div key={t.id}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-gray-600" />
                      <span className="text-white font-medium text-sm">{t.name}</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-800 text-gray-400">
                        {t.baseRole}
                      </span>
                      {t.canInvite && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-900/40 text-indigo-400 border border-indigo-800/40">
                          Can invite
                        </span>
                      )}
                    </div>
                    {t.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{t.description}</p>}
                    <p className="text-[11px] text-gray-600 mt-0.5">{pageCount} pages · {actCount} action{actCount !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      className="p-1.5 text-gray-500 hover:text-gray-300 rounded"
                      title={isExpanded ? "Collapse" : "View permissions"}
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {!isPostLaunch && deleteId === t.id ? (
                      <>
                        <button onClick={() => handleDelete(t.id)} disabled={deleting}
                          className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1">{deleting ? "…" : "Delete"}</button>
                        <button onClick={() => setDeleteId(null)} className="text-xs text-gray-500 hover:text-gray-300 px-1">Cancel</button>
                      </>
                    ) : !isPostLaunch ? (
                      <>
                        <button onClick={() => openEdit(t)} className="p-1.5 text-gray-500 hover:text-gray-300 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteId(t.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    ) : null}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 bg-gray-900/50 space-y-3 border-t border-gray-800/60">
                    <div className="pt-3">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Page Access</p>
                      <div className="flex flex-wrap gap-1.5">
                        {CONFIGURABLE_PAGES.map(p => (
                          <span key={p.key} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            (Array.isArray(t.pageAccess) ? t.pageAccess : []).includes(p.key)
                              ? "bg-indigo-900/40 text-indigo-300 border border-indigo-800/40"
                              : "bg-gray-800/60 text-gray-600"
                          }`}>{p.label}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Actions</p>
                      <div className="flex flex-wrap gap-1.5">
                        {CONFIGURABLE_ACTIONS.map(a => (
                          <span key={a.key} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            (Array.isArray(t.actions) ? t.actions : []).includes(a.key)
                              ? "bg-green-900/40 text-green-300 border border-green-800/40"
                              : "bg-gray-800/60 text-gray-600"
                          }`}>{a.label}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        !showForm && (
          <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-8 text-center">
            <Users className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No employee types configured yet.</p>
            {!isPostLaunch && (
              <button onClick={openAdd} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300">
                Add your first employee type →
              </button>
            )}
          </div>
        )
      )}
    </div>
  )
}
