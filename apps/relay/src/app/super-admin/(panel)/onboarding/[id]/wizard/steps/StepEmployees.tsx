"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Loader2, X, UserPlus, Users, AlertTriangle } from "lucide-react"

type StagedEmployee = {
  id:             string
  name:           string
  email:          string
  role:           string
  employeeTypeId: string | null
  departmentId:   string | null
  locationId:     string | null
  managerId:      string | null
  createdAt:      string
}

type EmployeeType = { id: string; name: string; baseRole: string }
type Department   = { id: string; name: string }
type Location     = { id: string; name: string }
type OrgUser      = {
  id: string; name: string; email: string; role: string
  department: { name: string } | null
  location:   { name: string } | null
}

type StepData = {
  stagedEmployees:     StagedEmployee[]
  primaryContactEmail: string
}

type Props = {
  onboardingId: string
  isPostLaunch: boolean
  onReady:    () => void
  onNotReady: () => void
}

const BASE_ROLES = ["EMPLOYEE", "SUPERVISOR", "MANAGER", "HR", "ADMIN"] as const

const EMPTY_FORM = {
  name: "", email: "", role: "EMPLOYEE",
  employeeTypeId: "", departmentId: "", locationId: "", managerId: "",
}
type FormState = typeof EMPTY_FORM

export function StepEmployees({ onboardingId, isPostLaunch, onReady, onNotReady }: Props) {
  const [data, setData]           = useState<StepData | null>(null)
  const [empTypes, setEmpTypes]   = useState<EmployeeType[]>([])
  const [depts, setDepts]         = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [orgUsers, setOrgUsers]   = useState<OrgUser[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [tab, setTab]             = useState<"staged" | "existing">("staged")

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const stagedUrl  = `/api/super-admin/onboarding/${onboardingId}/configure/staged-employees`
  const usersUrl   = `/api/super-admin/onboarding/${onboardingId}/configure/users`
  const empTypeUrl = `/api/super-admin/onboarding/${onboardingId}/configure/employee-types`
  const deptUrl    = `/api/super-admin/onboarding/${onboardingId}/configure/departments`
  const locUrl     = `/api/super-admin/onboarding/${onboardingId}/configure/locations`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, uRes, etRes, dRes, lRes] = await Promise.all([
        fetch(stagedUrl), fetch(usersUrl), fetch(empTypeUrl), fetch(deptUrl), fetch(locUrl),
      ])
      if (!sRes.ok) throw new Error("Failed to load staged employees")
      const staged = await sRes.json() as StepData
      setData(staged)
      if (uRes.ok)  setOrgUsers((await uRes.json() as { users: OrgUser[] }).users)
      if (etRes.ok) setEmpTypes(await etRes.json() as EmployeeType[])
      if (dRes.ok)  setDepts(await dRes.json() as Department[])
      if (lRes.ok)  setLocations(await lRes.json() as Location[])
      staged.stagedEmployees.length >= 1 ? onReady() : onNotReady()
    } catch {
      setError("Failed to load employee data.")
    } finally {
      setLoading(false)
    }
  }, [stagedUrl, usersUrl, empTypeUrl, deptUrl, locUrl, onReady, onNotReady])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(emp: StagedEmployee) {
    setEditId(emp.id)
    setForm({
      name:           emp.name,
      email:          emp.email,
      role:           emp.role,
      employeeTypeId: emp.employeeTypeId ?? "",
      departmentId:   emp.departmentId   ?? "",
      locationId:     emp.locationId     ?? "",
      managerId:      emp.managerId      ?? "",
    })
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditId(null); setFormError(null) }

  async function handleSave() {
    if (!form.name.trim())  { setFormError("Name is required."); return }
    if (!form.email.trim()) { setFormError("Email is required."); return }
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        name:           form.name.trim(),
        email:          form.email.trim().toLowerCase(),
        role:           form.role,
        employeeTypeId: form.employeeTypeId || null,
        departmentId:   form.departmentId   || null,
        locationId:     form.locationId     || null,
        managerId:      form.managerId      || null,
      }
      const url    = editId ? `${stagedUrl}/${editId}` : stagedUrl
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
      const res = await fetch(`${stagedUrl}/${id}`, { method: "DELETE" })
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

  const staged   = data?.stagedEmployees ?? []
  const primary  = data?.primaryContactEmail ?? ""

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl px-4 py-3">
        <p className="text-xs text-indigo-300">
          <span className="font-semibold">Prepare invitations — no emails are sent.</span>{" "}
          Add employees here and they will be invited after the customer accepts their own launch invitation.
          {primary && <> The primary contact ({primary}) will receive the launch invitation separately.</>}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("staged")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            tab === "staged" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Staged ({staged.length})
        </button>
        <button
          onClick={() => setTab("existing")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            tab === "existing" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Existing Users ({orgUsers.length})
        </button>
      </div>

      {/* ── Staged employees tab ── */}
      {tab === "staged" && (
        <div className="space-y-3">
          {!isPostLaunch && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {staged.length === 0
                  ? "No employees staged yet. Add at least one to complete this step."
                  : `${staged.length} employee${staged.length === 1 ? "" : "s"} ready to invite at launch.`}
              </p>
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Employee
              </button>
            </div>
          )}

          {/* Add/Edit form */}
          {showForm && !isPostLaunch && (
            <div className="bg-gray-900 border border-indigo-800/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">{editId ? "Edit Employee" : "Add Employee"}</h4>
                <button onClick={closeForm} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
              </div>
              {formError && (
                <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded px-2 py-1">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />{formError}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Name <span className="text-red-400">*</span></label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email <span className="text-red-400">*</span></label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="jane@acme.com"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {primary && form.email.trim().toLowerCase() === primary.toLowerCase() && (
                    <p className="text-[11px] text-amber-500 mt-1">This is the primary contact — they receive the launch invitation separately.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Base Role</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {BASE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Employee Type</label>
                  <select
                    value={form.employeeTypeId}
                    onChange={e => setForm(f => ({ ...f, employeeTypeId: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">— None —</option>
                    {empTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                  </select>
                  {empTypes.length === 0 && (
                    <p className="text-[11px] text-gray-600 mt-1">Configure employee types in Step 4 first.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Department</label>
                  <select
                    value={form.departmentId}
                    onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">— None —</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Location</label>
                  <select
                    value={form.locationId}
                    onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">— None —</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editId ? "Save Changes" : "Add Employee"}
                </button>
                <button onClick={closeForm} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-300">Cancel</button>
              </div>
            </div>
          )}

          {staged.length > 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">Employee</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 hidden sm:table-cell">Role</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 hidden md:table-cell">Type</th>
                    {!isPostLaunch && <th className="px-2 py-2.5 w-16" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {staged.map(emp => {
                    const empTypeName = empTypes.find(et => et.id === emp.employeeTypeId)?.name
                    return (
                      <tr key={emp.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <UserPlus className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                            <div>
                              <p className="text-white font-medium text-sm">{emp.name}</p>
                              <p className="text-gray-500 text-xs">{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-300">
                            {emp.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                          {empTypeName ?? <span className="text-gray-600">—</span>}
                        </td>
                        {!isPostLaunch && (
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              {deleteId === emp.id ? (
                                <>
                                  <button onClick={() => handleDelete(emp.id)} disabled={deleting}
                                    className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1">
                                    {deleting ? "…" : "Remove"}
                                  </button>
                                  <button onClick={() => setDeleteId(null)} className="text-xs text-gray-500 hover:text-gray-300 px-1">Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => openEdit(emp)} className="p-1.5 text-gray-500 hover:text-gray-300 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => setDeleteId(emp.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            !showForm && (
              <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-8 text-center">
                <UserPlus className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No employees staged yet.</p>
                <p className="text-xs text-gray-600 mt-1">
                  Staged employees will receive an invitation after the customer accepts theirs.
                </p>
                {!isPostLaunch && (
                  <button onClick={openAdd} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300">
                    Add first employee →
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* ── Existing users tab ── */}
      {tab === "existing" && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
            These are users already in this organization's account. They do not affect step completion — this step tracks employees prepared in the wizard.
          </p>
          {orgUsers.length > 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">User</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 hidden sm:table-cell">Role</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5 hidden md:table-cell">Dept</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {orgUsers.map(u => (
                    <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                          <div>
                            <p className="text-white font-medium text-sm">{u.name}</p>
                            <p className="text-gray-500 text-xs">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-gray-400 text-xs">{u.role}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-400 text-xs">{u.department?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-6 text-center">
              <Users className="w-5 h-5 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No existing users in this organization.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
