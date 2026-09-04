"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  QrCode,
  Plus,
  Edit,
  Download,
  BarChart2,
  PowerOff,
  Power,
  MapPin,
  Building2,
  CheckCircle,
  XCircle,
  User,
  Shuffle,
  AlertTriangle,
  X,
} from "lucide-react"
import { PeoplePicker } from "@/components/ui/people-picker"
import type { Person } from "@/components/ui/people-picker"

// ─── Types ────────────────────────────────────────────────────────────────────

interface QrCodeItem {
  id:                 string
  name:               string
  description:        string | null
  token:              string
  reportingMode:      string
  routingMode:        string
  assignedToId:       string | null
  assignedToName:     string | null
  assignedToRole:     string | null
  assignedToActive:   boolean
  locationId:         string | null
  locationName:       string | null
  area:               string | null
  departmentId:       string | null
  departmentName:     string | null
  defaultCategory:    string
  collectContactInfo: boolean
  requireContactInfo: boolean
  requirePhoto:       boolean
  isActive:           boolean
  submissionCount:    number
  createdAt:          string
}

type TeamMember = Person

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORTING_MODES = [
  { value: "PUBLIC_ISSUE",       label: "Public Issue Reporting" },
  { value: "EMPLOYEE_REPORTING", label: "Employee Reporting" },
  { value: "ASSET_REPORTING",    label: "Asset Reporting" },
  { value: "VISITOR_FEEDBACK",   label: "Visitor Feedback" },
  { value: "SAFETY_REPORTING",   label: "Safety Reporting" },
]

const CATEGORIES = [
  { value: "GENERAL",             label: "General" },
  { value: "EQUIPMENT_BREAKDOWN", label: "Equipment Breakdown" },
  { value: "SAFETY",              label: "Safety" },
  { value: "MAINTENANCE",         label: "Maintenance" },
  { value: "VEHICLE",             label: "Vehicle" },
  { value: "FACILITY",            label: "Facility" },
]

const MODE_COLORS: Record<string, string> = {
  PUBLIC_ISSUE:       "bg-blue-100 text-blue-700",
  EMPLOYEE_REPORTING: "bg-purple-100 text-purple-700",
  ASSET_REPORTING:    "bg-orange-100 text-orange-700",
  VISITOR_FEEDBACK:   "bg-teal-100 text-teal-700",
  SAFETY_REPORTING:   "bg-red-100 text-red-700",
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN:    "Admin",
  MANAGER:  "Manager",
  EMPLOYEE: "Employee",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function modeBadge(mode: string) {
  const label = REPORTING_MODES.find(m => m.value === mode)?.label ?? mode
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${MODE_COLORS[mode] ?? "bg-gray-100 text-gray-600"}`}>
      {label}
    </span>
  )
}

// ─── Routing Mode Section ─────────────────────────────────────────────────────

function RoutingSection({
  routingMode,
  assignedToId,
  members,
  onRoutingModeChange,
  onAssignedToChange,
}: {
  routingMode:         string
  assignedToId:        string
  members:             TeamMember[]
  onRoutingModeChange: (v: string) => void
  onAssignedToChange:  (v: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Routing</label>
      <div className="space-y-2">
        <label
          className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            routingMode === "AUTO"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:bg-gray-50"
          }`}
        >
          <input
            type="radio"
            name="routingMode"
            value="AUTO"
            checked={routingMode === "AUTO"}
            onChange={() => { onRoutingModeChange("AUTO"); onAssignedToChange("") }}
            className="mt-0.5 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex items-start gap-2">
            <Shuffle className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Automatic Routing</p>
              <p className="text-xs text-gray-500 mt-0.5">Uses your routing rules — category, department, and location determine who receives the report</p>
            </div>
          </div>
        </label>

        <label
          className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            routingMode === "MANUAL"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:bg-gray-50"
          }`}
        >
          <input
            type="radio"
            name="routingMode"
            value="MANUAL"
            checked={routingMode === "MANUAL"}
            onChange={() => onRoutingModeChange("MANUAL")}
            className="mt-0.5 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Assign to Specific Person</p>
              <p className="text-xs text-gray-500 mt-0.5">Always routes to one person regardless of category or routing rules</p>
            </div>
          </div>
        </label>
      </div>

      {routingMode === "MANUAL" && (
        <div className="mt-2">
          <PeoplePicker
            people={members}
            value={assignedToId}
            onChange={onAssignedToChange}
            placeholder="Search by name, role, department…"
            emptyLabel="Select a person…"
          />
          {members.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">No active team members found.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Routing Badge (card display) ─────────────────────────────────────────────

function RoutingBadge({ qr }: { qr: QrCodeItem }) {
  if (qr.routingMode === "MANUAL" && qr.assignedToName) {
    const needsUpdate = !qr.assignedToActive
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
          needsUpdate
            ? "bg-amber-100 text-amber-700 border border-amber-200"
            : "bg-indigo-100 text-indigo-700"
        }`}>
          <User className="w-3 h-3 shrink-0" />
          {qr.assignedToName}
          {qr.assignedToRole && (
            <span className="opacity-70">· {ROLE_LABELS[qr.assignedToRole] ?? qr.assignedToRole}</span>
          )}
        </span>
        {needsUpdate && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Needs routing update
          </span>
        )}
      </div>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
      <Shuffle className="w-3 h-3 shrink-0" />
      Automatic
    </span>
  )
}

// ─── Form fields shared by Create + Edit ─────────────────────────────────────

function QrFormFields({
  name, setName,
  description, setDescription,
  reportingMode, setReportingMode,
  routingMode, setRoutingMode,
  assignedToId, setAssignedToId,
  locationId, setLocationId,
  area, setArea,
  departmentId, setDepartmentId,
  defaultCategory, setDefaultCategory,
  collectContactInfo, setCollectContactInfo,
  requireContactInfo, setRequireContactInfo,
  requirePhoto, setRequirePhoto,
  locations, departments, members,
  saving, error, submitLabel, onCancel,
}: {
  name: string; setName: (v: string) => void
  description: string; setDescription: (v: string) => void
  reportingMode: string; setReportingMode: (v: string) => void
  routingMode: string; setRoutingMode: (v: string) => void
  assignedToId: string; setAssignedToId: (v: string) => void
  locationId: string; setLocationId: (v: string) => void
  area: string; setArea: (v: string) => void
  departmentId: string; setDepartmentId: (v: string) => void
  defaultCategory: string; setDefaultCategory: (v: string) => void
  collectContactInfo: boolean; setCollectContactInfo: (v: boolean) => void
  requireContactInfo: boolean; setRequireContactInfo: (v: boolean) => void
  requirePhoto: boolean; setRequirePhoto: (v: boolean) => void
  locations: { id: string; name: string }[]
  departments: { id: string; name: string }[]
  members: TeamMember[]
  saving: boolean; error: string; submitLabel: string; onCancel: () => void
}) {
  return (
    <>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Dock Door 12 Safety"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional description"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Mode</label>
        <select
          value={reportingMode}
          onChange={e => setReportingMode(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {REPORTING_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <RoutingSection
        routingMode={routingMode}
        assignedToId={assignedToId}
        members={members}
        onRoutingModeChange={setRoutingMode}
        onAssignedToChange={setAssignedToId}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <select
            value={locationId}
            onChange={e => setLocationId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No location</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
          <input
            value={area}
            onChange={e => setArea(e.target.value)}
            placeholder="e.g. Men's Restroom"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
        <select
          value={departmentId}
          onChange={e => setDepartmentId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">No department</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Default Category</label>
        <select
          value={defaultCategory}
          onChange={e => setDefaultCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="space-y-2 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={collectContactInfo}
            onChange={e => { setCollectContactInfo(e.target.checked); if (!e.target.checked) setRequireContactInfo(false) }}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm text-gray-700">Collect contact info (name, email, phone)</span>
        </label>
        <label className={`flex items-center gap-2 pl-6 cursor-pointer ${!collectContactInfo ? "opacity-40" : ""}`}>
          <input
            type="checkbox"
            checked={requireContactInfo}
            onChange={e => setRequireContactInfo(e.target.checked)}
            disabled={!collectContactInfo}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm text-gray-700">Require contact info</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={requirePhoto}
            onChange={e => setRequirePhoto(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm text-gray-700">Require photo</span>
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-colors">
          Cancel
        </button>
      </div>
    </>
  )
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({
  locations, departments, members, onClose, onCreated,
}: {
  locations:   { id: string; name: string }[]
  departments: { id: string; name: string }[]
  members:     TeamMember[]
  onClose:     () => void
  onCreated:   (qr: QrCodeItem) => void
}) {
  const [name,               setName]               = useState("")
  const [description,        setDescription]        = useState("")
  const [reportingMode,      setReportingMode]      = useState("PUBLIC_ISSUE")
  const [routingMode,        setRoutingMode]        = useState("AUTO")
  const [assignedToId,       setAssignedToId]       = useState("")
  const [locationId,         setLocationId]         = useState("")
  const [area,               setArea]               = useState("")
  const [departmentId,       setDepartmentId]       = useState("")
  const [defaultCategory,    setDefaultCategory]    = useState("GENERAL")
  const [collectContactInfo, setCollectContactInfo] = useState(false)
  const [requireContactInfo, setRequireContactInfo] = useState(false)
  const [requirePhoto,       setRequirePhoto]       = useState(false)
  const [saving,             setSaving]             = useState(false)
  const [error,              setError]              = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Name is required"); return }
    if (routingMode === "MANUAL" && !assignedToId) { setError("Please select a person for manual routing"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/qr-codes", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), description: description.trim() || null,
          reportingMode, routingMode,
          assignedToId: routingMode === "MANUAL" ? assignedToId : null,
          locationId: locationId || null, area: area.trim() || null,
          departmentId: departmentId || null, defaultCategory,
          collectContactInfo, requireContactInfo: collectContactInfo ? requireContactInfo : false,
          requirePhoto,
        }),
      })
      if (!res.ok) { const j = await res.json() as { error?: string }; setError(j.error ?? "Failed to create QR code"); return }
      const j = await res.json() as { qrCode: QrCodeItem }
      onCreated(j.qrCode)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Create New QR Code</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <QrFormFields
            name={name} setName={setName}
            description={description} setDescription={setDescription}
            reportingMode={reportingMode} setReportingMode={setReportingMode}
            routingMode={routingMode} setRoutingMode={setRoutingMode}
            assignedToId={assignedToId} setAssignedToId={setAssignedToId}
            locationId={locationId} setLocationId={setLocationId}
            area={area} setArea={setArea}
            departmentId={departmentId} setDepartmentId={setDepartmentId}
            defaultCategory={defaultCategory} setDefaultCategory={setDefaultCategory}
            collectContactInfo={collectContactInfo} setCollectContactInfo={setCollectContactInfo}
            requireContactInfo={requireContactInfo} setRequireContactInfo={setRequireContactInfo}
            requirePhoto={requirePhoto} setRequirePhoto={setRequirePhoto}
            locations={locations} departments={departments} members={members}
            saving={saving} error={error} submitLabel="Create QR Code" onCancel={onClose}
          />
        </form>
      </div>
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  qr, locations, departments, members, onClose, onSaved,
}: {
  qr:          QrCodeItem
  locations:   { id: string; name: string }[]
  departments: { id: string; name: string }[]
  members:     TeamMember[]
  onClose:     () => void
  onSaved:     (updated: QrCodeItem) => void
}) {
  const [name,               setName]               = useState(qr.name)
  const [description,        setDescription]        = useState(qr.description ?? "")
  const [reportingMode,      setReportingMode]      = useState(qr.reportingMode)
  const [routingMode,        setRoutingMode]        = useState(qr.routingMode)
  const [assignedToId,       setAssignedToId]       = useState(qr.assignedToId ?? "")
  const [locationId,         setLocationId]         = useState(qr.locationId ?? "")
  const [area,               setArea]               = useState(qr.area ?? "")
  const [departmentId,       setDepartmentId]       = useState(qr.departmentId ?? "")
  const [defaultCategory,    setDefaultCategory]    = useState(qr.defaultCategory)
  const [collectContactInfo, setCollectContactInfo] = useState(qr.collectContactInfo)
  const [requireContactInfo, setRequireContactInfo] = useState(qr.requireContactInfo)
  const [requirePhoto,       setRequirePhoto]       = useState(qr.requirePhoto)
  const [saving,             setSaving]             = useState(false)
  const [error,              setError]              = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Name is required"); return }
    if (routingMode === "MANUAL" && !assignedToId) { setError("Please select a person for manual routing"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/qr-codes/${qr.id}`, {
        method:  "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), description: description.trim() || null,
          reportingMode, routingMode,
          assignedToId: routingMode === "MANUAL" ? assignedToId : null,
          locationId: locationId || null, area: area.trim() || null,
          departmentId: departmentId || null, defaultCategory,
          collectContactInfo, requireContactInfo: collectContactInfo ? requireContactInfo : false,
          requirePhoto,
        }),
      })
      if (!res.ok) { const j = await res.json() as { error?: string }; setError(j.error ?? "Failed to save changes"); return }
      const j = await res.json() as { qrCode: QrCodeItem }
      onSaved(j.qrCode)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Edit — {qr.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <QrFormFields
            name={name} setName={setName}
            description={description} setDescription={setDescription}
            reportingMode={reportingMode} setReportingMode={setReportingMode}
            routingMode={routingMode} setRoutingMode={setRoutingMode}
            assignedToId={assignedToId} setAssignedToId={setAssignedToId}
            locationId={locationId} setLocationId={setLocationId}
            area={area} setArea={setArea}
            departmentId={departmentId} setDepartmentId={setDepartmentId}
            defaultCategory={defaultCategory} setDefaultCategory={setDefaultCategory}
            collectContactInfo={collectContactInfo} setCollectContactInfo={setCollectContactInfo}
            requireContactInfo={requireContactInfo} setRequireContactInfo={setRequireContactInfo}
            requirePhoto={requirePhoto} setRequirePhoto={setRequirePhoto}
            locations={locations} departments={departments} members={members}
            saving={saving} error={error} submitLabel="Save Changes" onCancel={onClose}
          />
        </form>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QrCodesClient({
  qrCodes: initial,
  locations,
  departments,
  members,
}: {
  qrCodes:     QrCodeItem[]
  locations:   { id: string; name: string }[]
  departments: { id: string; name: string }[]
  members:     TeamMember[]
}) {
  const router = useRouter()
  const [qrCodes, setQrCodes]         = useState(initial)
  const [showCreate, setShowCreate]   = useState(false)
  const [editingQr, setEditingQr]     = useState<QrCodeItem | null>(null)
  const [togglingId, setTogglingId]   = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  function handleCreated(qr: QrCodeItem) {
    setQrCodes(prev => [qr, ...prev])
    setShowCreate(false)
  }

  function handleSaved(updated: QrCodeItem) {
    setQrCodes(prev => prev.map(q => q.id === updated.id ? updated : q))
    setEditingQr(null)
  }

  async function toggleActive(qr: QrCodeItem) {
    setTogglingId(qr.id)
    try {
      const res = await fetch(`/api/qr-codes/${qr.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !qr.isActive }),
      })
      if (res.ok) {
        setQrCodes(prev => prev.map(q => q.id === qr.id ? { ...q, isActive: !q.isActive } : q))
      }
    } finally {
      setTogglingId(null)
    }
  }

  async function downloadPng(qr: QrCodeItem) {
    setDownloadingId(qr.id)
    try {
      const res = await fetch(`/api/qr-codes/${qr.id}/png`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `relay-qr-${qr.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {showCreate && (
        <CreateModal
          locations={locations}
          departments={departments}
          members={members}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {editingQr && (
        <EditModal
          qr={editingQr}
          locations={locations}
          departments={departments}
          members={members}
          onClose={() => setEditingQr(null)}
          onSaved={handleSaved}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          QR codes let employees, visitors, or the public submit reports by scanning a code placed anywhere in your facility.
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shrink-0 ml-4"
        >
          <Plus className="w-4 h-4" /> Create New QR Code
        </button>
      </div>

      {qrCodes.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-16 text-center">
          <QrCode className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 font-medium mb-1">No QR codes yet</p>
          <p className="text-sm text-gray-400">Create your first QR code to start collecting reports.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {qrCodes.map(qr => {
            const needsRoutingUpdate = qr.routingMode === "MANUAL" && !qr.assignedToActive
            return (
              <div
                key={qr.id}
                className={`bg-white dark:bg-gray-900 border rounded-xl p-5 flex flex-col gap-3 ${
                  needsRoutingUpdate
                    ? "border-amber-300 dark:border-amber-700"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{qr.name}</h3>
                      {qr.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                          <XCircle className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {modeBadge(qr.reportingMode)}
                      <RoutingBadge qr={qr} />
                    </div>
                  </div>
                  <QrCode className="w-8 h-8 text-gray-200 dark:text-gray-700 shrink-0" />
                </div>

                {qr.description && (
                  <p className="text-sm text-gray-500 line-clamp-2">{qr.description}</p>
                )}

                <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                  {(qr.locationName || qr.area) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {[qr.locationName, qr.area].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {qr.departmentName && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {qr.departmentName}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <BarChart2 className="w-3 h-3" />
                    {qr.submissionCount} submission{qr.submissionCount !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => router.push(`/settings/qr-codes/${qr.id}/analytics`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
                  >
                    <BarChart2 className="w-3.5 h-3.5" /> Analytics
                  </button>

                  <button
                    onClick={() => downloadPng(qr)}
                    disabled={downloadingId === qr.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" /> {downloadingId === qr.id ? "…" : "Download QR"}
                  </button>

                  <button
                    onClick={() => toggleActive(qr)}
                    disabled={togglingId === qr.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 border ${
                      qr.isActive
                        ? "text-red-600 border-red-200 hover:bg-red-50"
                        : "text-green-600 border-green-200 hover:bg-green-50"
                    }`}
                  >
                    {qr.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                    {togglingId === qr.id ? "…" : qr.isActive ? "Deactivate" : "Activate"}
                  </button>

                  <button
                    onClick={() => setEditingQr(qr)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
