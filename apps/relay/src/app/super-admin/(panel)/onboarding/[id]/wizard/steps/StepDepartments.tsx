"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Loader2, X, Layers } from "lucide-react"

type Department = {
  id:         string
  name:       string
  locationId: string | null
  location:   { id: string; name: string } | null
}

type Location = { id: string; name: string }

type Props = {
  onboardingId: string
  isPostLaunch: boolean
  onReady:    () => void
  onNotReady: () => void
}

export function StepDepartments({ onboardingId, isPostLaunch, onReady, onNotReady }: Props) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations]     = useState<Location[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [formError, setFormError]     = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState({ name: "", locationId: "" })
  const [saving, setSaving]     = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const deptUrl  = `/api/super-admin/onboarding/${onboardingId}/configure/departments`
  const locUrl   = `/api/super-admin/onboarding/${onboardingId}/configure/locations`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, lRes] = await Promise.all([fetch(deptUrl), fetch(locUrl)])
      if (!dRes.ok) throw new Error("Failed to load departments")
      const depts = await dRes.json() as Department[]
      const locs  = lRes.ok ? (await lRes.json() as Location[]) : []
      setDepartments(depts)
      setLocations(locs)
      depts.length >= 1 ? onReady() : onNotReady()
    } catch {
      setError("Failed to load departments.")
    } finally {
      setLoading(false)
    }
  }, [deptUrl, locUrl, onReady, onNotReady])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditId(null)
    setForm({ name: "", locationId: "" })
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(dept: Department) {
    setEditId(dept.id)
    setForm({ name: dept.name, locationId: dept.locationId ?? "" })
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditId(null); setFormError(null) }

  async function handleSave() {
    if (!form.name.trim()) { setFormError("Name is required."); return }
    setSaving(true)
    setFormError(null)
    try {
      const payload = { name: form.name.trim(), locationId: form.locationId || undefined }
      const url     = editId ? `${deptUrl}/${editId}` : deptUrl
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
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
      const res = await fetch(`${deptUrl}/${id}`, { method: "DELETE" })
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
            {departments.length === 0
              ? "No departments yet. Add at least one."
              : `${departments.length} department${departments.length === 1 ? "" : "s"} configured.`}
          </p>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Department
          </button>
        </div>
      )}

      {showForm && !isPostLaunch && (
        <div className="bg-gray-900 border border-indigo-800/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">{editId ? "Edit Department" : "Add Department"}</h4>
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
                placeholder="Production"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Location</label>
              <select
                value={form.locationId}
                onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">— All locations —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              {locations.length === 0 && (
                <p className="text-[11px] text-gray-600 mt-1">Add locations in Step 2 to assign departments.</p>
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
              {editId ? "Save Changes" : "Add Department"}
            </button>
            <button onClick={closeForm} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-300">Cancel</button>
          </div>
        </div>
      )}

      {departments.length > 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">Department</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 hidden sm:table-cell">Location</th>
                {!isPostLaunch && <th className="px-2 py-2.5 w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {departments.map(dept => (
                <tr key={dept.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-gray-600" />
                      <span className="text-white font-medium">{dept.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm hidden sm:table-cell">
                    {dept.location?.name ?? <span className="text-gray-600">—</span>}
                  </td>
                  {!isPostLaunch && (
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {deleteId === dept.id ? (
                          <>
                            <button onClick={() => handleDelete(dept.id)} disabled={deleting}
                              className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1">
                              {deleting ? "…" : "Delete"}
                            </button>
                            <button onClick={() => setDeleteId(null)} className="text-xs text-gray-500 hover:text-gray-300 px-1">Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(dept)} className="p-1.5 text-gray-500 hover:text-gray-300 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeleteId(dept.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
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
            <Layers className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No departments configured yet.</p>
            {!isPostLaunch && (
              <button onClick={openAdd} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300">
                Add your first department →
              </button>
            )}
          </div>
        )
      )}
    </div>
  )
}
