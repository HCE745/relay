"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Loader2, X, Users } from "lucide-react"

type EmployeeType = {
  id:       string
  name:     string
  baseRole: string
  color:    string | null
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
  { value: "MANAGER",    label: "Manager",     description: "Department manager with reporting access" },
  { value: "HR",         label: "HR",          description: "HR personnel with employee management" },
  { value: "ADMIN",      label: "Admin",       description: "Full org admin access" },
]

export function StepEmployeeTypes({ onboardingId, isPostLaunch, onReady, onNotReady }: Props) {
  const [types, setTypes]         = useState<EmployeeType[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState({ name: "", baseRole: "EMPLOYEE", color: "" })
  const [saving, setSaving]     = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

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
    setForm({ name: "", baseRole: "EMPLOYEE", color: "" })
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(t: EmployeeType) {
    setEditId(t.id)
    setForm({ name: t.name, baseRole: t.baseRole, color: t.color ?? "" })
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditId(null); setFormError(null) }

  async function handleSave() {
    if (!form.name.trim()) { setFormError("Name is required."); return }
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        name:     form.name.trim(),
        baseRole: form.baseRole,
        color:    form.color.trim() || undefined,
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

      {showForm && !isPostLaunch && (
        <div className="bg-gray-900 border border-indigo-800/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">{editId ? "Edit Employee Type" : "Add Employee Type"}</h4>
            <button onClick={closeForm} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
          </div>
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
                {BASE_ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {form.baseRole && (
                <p className="text-[11px] text-gray-600 mt-1">
                  {BASE_ROLES.find(r => r.value === form.baseRole)?.description}
                </p>
              )}
            </div>
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

      {types.length > 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">Name</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 hidden sm:table-cell">Base Role</th>
                {!isPostLaunch && <th className="px-2 py-2.5 w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {types.map(t => (
                <tr key={t.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-gray-600" />
                      <span className="text-white font-medium">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-300">
                      {BASE_ROLES.find(r => r.value === t.baseRole)?.label ?? t.baseRole}
                    </span>
                  </td>
                  {!isPostLaunch && (
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {deleteId === t.id ? (
                          <>
                            <button onClick={() => handleDelete(t.id)} disabled={deleting}
                              className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1">
                              {deleting ? "…" : "Delete"}
                            </button>
                            <button onClick={() => setDeleteId(null)} className="text-xs text-gray-500 hover:text-gray-300 px-1">Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(t)} className="p-1.5 text-gray-500 hover:text-gray-300 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteId(t.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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
