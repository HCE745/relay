"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Trash2, Edit2, Loader2, AlertTriangle, QrCode, Check, X, Download } from "lucide-react"

const ISSUE_CATEGORIES = [
  { value: "GENERAL",             label: "General" },
  { value: "EQUIPMENT_BREAKDOWN", label: "Equipment Breakdown" },
  { value: "SAFETY",              label: "Safety" },
  { value: "MAINTENANCE",         label: "Maintenance" },
  { value: "FACILITY",            label: "Facility" },
  { value: "VEHICLE",             label: "Vehicle" },
]

const REPORTING_MODES = [
  { value: "PUBLIC_ISSUE",      label: "Public Issue Reporting" },
  { value: "EMPLOYEE_REPORTING", label: "Employee Reporting" },
  { value: "SAFETY_REPORTING",  label: "Safety Reporting" },
  { value: "VISITOR_FEEDBACK",  label: "Visitor Feedback" },
  { value: "ASSET_REPORTING",   label: "Asset Reporting" },
]

interface QrCodeRecord {
  id:              string
  name:            string
  description:     string | null
  token:           string
  locationId:      string | null
  departmentId:    string | null
  defaultCategory: string
  reportingMode:   string
  isActive:        boolean
  location:        { id: string; name: string } | null
  department:      { id: string; name: string } | null
}

interface Location   { id: string; name: string }
interface Department { id: string; name: string }

interface QrForm {
  name:            string
  description:     string
  locationId:      string
  departmentId:    string
  defaultCategory: string
  reportingMode:   string
}

const EMPTY_FORM: QrForm = {
  name: "", description: "", locationId: "", departmentId: "",
  defaultCategory: "GENERAL", reportingMode: "PUBLIC_ISSUE",
}

interface Props {
  onboardingId: string
  isPostLaunch: boolean
  onReady:      () => void
  onNotReady:   () => void
}

export function StepQrCodes({ onboardingId, isPostLaunch, onReady, onNotReady }: Props) {
  const [codes, setCodes]         = useState<QrCodeRecord[]>([])
  const [locs, setLocs]           = useState<Location[]>([])
  const [depts, setDepts]         = useState<Department[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [form, setForm]           = useState<QrForm>(EMPTY_FORM)

  const appUrl = typeof window !== "undefined" ? window.location.origin : ""

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [codesRes, locsRes, deptsRes] = await Promise.all([
        fetch(`/api/super-admin/onboarding/${onboardingId}/configure/qr-codes`),
        fetch(`/api/super-admin/onboarding/${onboardingId}/configure/locations`),
        fetch(`/api/super-admin/onboarding/${onboardingId}/configure/departments`),
      ])
      if (!codesRes.ok) throw new Error("Failed to load QR codes")
      const codeList = await codesRes.json() as QrCodeRecord[]
      const locList  = locsRes.ok ? (await locsRes.json() as Location[]) : []
      const deptList = deptsRes.ok ? (await deptsRes.json() as Department[]) : []
      setCodes(codeList)
      setLocs(locList)
      setDepts(deptList)
      if (codeList.length >= 1) onReady()
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

  function openEdit(code: QrCodeRecord) {
    setEditId(code.id)
    setForm({
      name:            code.name,
      description:     code.description ?? "",
      locationId:      code.locationId   ?? "",
      departmentId:    code.departmentId ?? "",
      defaultCategory: code.defaultCategory,
      reportingMode:   code.reportingMode,
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  async function handleSubmit() {
    if (!form.name.trim()) return setError("Name is required")
    setSaving(true)
    setError(null)
    try {
      if (editId) {
        const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/qr-codes/${editId}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            name:            form.name.trim(),
            description:     form.description.trim() || null,
            locationId:      form.locationId   || null,
            departmentId:    form.departmentId || null,
            defaultCategory: form.defaultCategory,
            reportingMode:   form.reportingMode,
          }),
        })
        if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Update failed")
        const updated = await res.json() as QrCodeRecord
        setCodes(c => c.map(x => x.id === editId ? { ...x, ...updated } : x))
      } else {
        const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/qr-codes`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            name:            form.name.trim(),
            description:     form.description.trim() || undefined,
            locationId:      form.locationId   || undefined,
            departmentId:    form.departmentId || undefined,
            defaultCategory: form.defaultCategory,
            reportingMode:   form.reportingMode,
          }),
        })
        if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Create failed")
        const created = await res.json() as QrCodeRecord
        const next = [...codes, { ...created, location: null, department: null }]
        setCodes(next)
        if (next.length >= 1) onReady()
      }
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(codeId: string) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/qr-codes/${codeId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete QR code")
      const next = codes.filter(c => c.id !== codeId)
      setCodes(next)
      if (next.length === 0) onNotReady()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setSaving(false)
    }
  }

  function getReportUrl(token: string) {
    return `${appUrl}/report/${token}`
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(getReportUrl(token))
    } catch {
      // fallback: select text
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

      {/* QR code list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">QR Codes</span>
            <span className="text-xs text-gray-500 ml-1">({codes.length})</span>
          </div>
          {!isPostLaunch && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-800/50 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add QR Code
            </button>
          )}
        </div>

        {codes.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-500">No QR codes yet. Create one to let employees report issues by scanning a posted sign.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-800">
            {codes.map(code => (
              <li key={code.id} className="px-5 py-3">
                <div className="flex items-start gap-4">
                  {/* QR visual placeholder */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-gray-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-100">{code.name}</span>
                      <span className="text-[10px] font-medium text-indigo-400 bg-indigo-900/30 border border-indigo-800/40 px-1.5 py-0.5 rounded">
                        {REPORTING_MODES.find(m => m.value === code.reportingMode)?.label ?? code.reportingMode}
                      </span>
                      {code.defaultCategory !== "GENERAL" && (
                        <span className="text-[10px] text-gray-500">
                          {code.defaultCategory.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {code.location && (
                        <span className="text-xs text-gray-500">{code.location.name}</span>
                      )}
                      {code.department && (
                        <span className="text-xs text-gray-500">{code.department.name}</span>
                      )}
                    </div>
                    {/* Report link */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-gray-600 font-mono truncate max-w-xs">
                        /report/{code.token}
                      </span>
                      <button
                        onClick={() => copyLink(code.token)}
                        title="Copy link"
                        className="text-[10px] text-gray-600 hover:text-indigo-400 transition-colors flex items-center gap-0.5"
                      >
                        <Download className="w-3 h-3" /> Copy Link
                      </button>
                    </div>
                  </div>
                  {!isPostLaunch && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(code)}
                        className="p-1.5 text-gray-500 hover:text-indigo-400 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(code.id)}
                        disabled={saving}
                        className="p-1.5 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && !isPostLaunch && (
        <div className="bg-gray-900 border border-indigo-800/40 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">{editId ? "Edit QR Code" : "New QR Code"}</h3>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Dock Door 12 — Safety Reporting"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Location</label>
              <select
                value={form.locationId}
                onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="">None</option>
                {locs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Department</label>
              <select
                value={form.departmentId}
                onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="">None</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Default category</label>
              <select
                value={form.defaultCategory}
                onChange={e => setForm(f => ({ ...f, defaultCategory: e.target.value }))}
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                {ISSUE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Reporting mode</label>
              <select
                value={form.reportingMode}
                onChange={e => setForm(f => ({ ...f, reportingMode: e.target.value }))}
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                {REPORTING_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description for internal reference"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>
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
              {editId ? "Save Changes" : "Create QR Code"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
