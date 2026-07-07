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
} from "lucide-react"

interface QrCodeItem {
  id: string
  name: string
  description: string | null
  token: string
  reportingMode: string
  locationId: string | null
  locationName: string | null
  area: string | null
  departmentId: string | null
  departmentName: string | null
  defaultCategory: string
  collectContactInfo: boolean
  requireContactInfo: boolean
  requirePhoto: boolean
  isActive: boolean
  submissionCount: number
  createdAt: string
}

const REPORTING_MODES = [
  { value: "PUBLIC_ISSUE", label: "Public Issue Reporting" },
  { value: "EMPLOYEE_REPORTING", label: "Employee Reporting" },
  { value: "ASSET_REPORTING", label: "Asset Reporting" },
  { value: "VISITOR_FEEDBACK", label: "Visitor Feedback" },
  { value: "SAFETY_REPORTING", label: "Safety Reporting" },
]

const CATEGORIES = [
  { value: "GENERAL", label: "General" },
  { value: "EQUIPMENT_BREAKDOWN", label: "Equipment Breakdown" },
  { value: "SAFETY", label: "Safety" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "VEHICLE", label: "Vehicle" },
  { value: "FACILITY", label: "Facility" },
]

const MODE_COLORS: Record<string, string> = {
  PUBLIC_ISSUE: "bg-blue-100 text-blue-700",
  EMPLOYEE_REPORTING: "bg-purple-100 text-purple-700",
  ASSET_REPORTING: "bg-orange-100 text-orange-700",
  VISITOR_FEEDBACK: "bg-teal-100 text-teal-700",
  SAFETY_REPORTING: "bg-red-100 text-red-700",
}

function modeBadge(mode: string) {
  const label = REPORTING_MODES.find(m => m.value === mode)?.label ?? mode
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${MODE_COLORS[mode] ?? "bg-gray-100 text-gray-600"}`}>
      {label}
    </span>
  )
}

function CreateModal({
  locations,
  departments,
  onClose,
  onCreated,
}: {
  locations: { id: string; name: string }[]
  departments: { id: string; name: string }[]
  onClose: () => void
  onCreated: (qr: QrCodeItem) => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [reportingMode, setReportingMode] = useState("PUBLIC_ISSUE")
  const [locationId, setLocationId] = useState("")
  const [area, setArea] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [defaultCategory, setDefaultCategory] = useState("GENERAL")
  const [collectContactInfo, setCollectContactInfo] = useState(false)
  const [requireContactInfo, setRequireContactInfo] = useState(false)
  const [requirePhoto, setRequirePhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/qr-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          reportingMode,
          locationId: locationId || null,
          area: area.trim() || null,
          departmentId: departmentId || null,
          defaultCategory,
          collectContactInfo,
          requireContactInfo: collectContactInfo ? requireContactInfo : false,
          requirePhoto,
        }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        setError(j.error ?? "Failed to create QR code")
        return
      }
      const j = await res.json() as { qrCode: QrCodeItem }
      onCreated(j.qrCode)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Create New QR Code</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
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
              placeholder="Optional description for this QR code"
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
                placeholder="e.g. Dock Door 12"
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
                onChange={e => {
                  setCollectContactInfo(e.target.checked)
                  if (!e.target.checked) setRequireContactInfo(false)
                }}
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
              {saving ? "Creating…" : "Create QR Code"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function QrCodesClient({
  qrCodes: initial,
  locations,
  departments,
}: {
  qrCodes: QrCodeItem[]
  locations: { id: string; name: string }[]
  departments: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [qrCodes, setQrCodes] = useState(initial)
  const [showCreate, setShowCreate] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  function handleCreated(qr: QrCodeItem) {
    setQrCodes(prev => [qr, ...prev])
    setShowCreate(false)
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
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            QR codes let employees, visitors, or the public submit reports by scanning a code placed anywhere in your facility.
          </p>
        </div>
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
          {qrCodes.map(qr => (
            <div
              key={qr.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
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
                  {modeBadge(qr.reportingMode)}
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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
