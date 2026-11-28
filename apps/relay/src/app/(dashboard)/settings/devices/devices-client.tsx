"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/lib/toast"
import { Trash2, RefreshCw, Monitor, CheckCircle2, XCircle, Pencil, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react"

interface Device {
  id: string
  deviceName: string
  loginMode: string
  permittedMethods: string[]
  platform: string | null
  isActive: boolean
  registeredAt: string
  lastSeenAt: string | null
  revokedAt: string | null
  location:   { id: string; name: string } | null
  department: { id: string; name: string } | null
  inactivityTimeoutSeconds:  number | null
  maxSessionDurationSeconds: number | null
}

interface FilterOption { id: string; name: string }

interface Props {
  devices: Device[]
  locations?:   FilterOption[]
  departments?: FilterOption[]
}

function loginModeLabel(m: string) {
  return m === "QUICK_ACCESS" ? "Quick Access" : "Standard"
}

function methodLabel(m: string) {
  if (m === "EMPLOYEE_ID") return "ID"
  if (m === "ACCESS_CODE") return "Code"
  if (m === "BADGE")       return "Badge"
  return m
}

function relativeTime(iso: string | null) {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2)   return "just now"
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const ALL_METHODS = ["EMPLOYEE_ID", "ACCESS_CODE", "BADGE"] as const

interface EditState {
  deviceName:                string
  locationId:                string
  departmentId:              string
  stationId:                 string
  loginMode:                 "STANDARD" | "QUICK_ACCESS"
  permittedMethods:          Set<string>
  inactivityTimeoutSeconds:  string
  maxSessionDurationSeconds: string
  disableInactivityTimeout:  boolean
  disableMaxSessionDuration: boolean
}

function initEdit(d: Device): EditState {
  return {
    deviceName:                d.deviceName,
    locationId:                d.location?.id ?? "",
    departmentId:              d.department?.id ?? "",
    stationId:                 "",
    loginMode:                 d.loginMode === "QUICK_ACCESS" ? "QUICK_ACCESS" : "STANDARD",
    permittedMethods:          new Set(d.permittedMethods),
    inactivityTimeoutSeconds:  d.inactivityTimeoutSeconds ? String(Math.round(d.inactivityTimeoutSeconds / 60)) : "",
    maxSessionDurationSeconds: d.maxSessionDurationSeconds ? String(Math.round(d.maxSessionDurationSeconds / 60)) : "",
    disableInactivityTimeout:  false,
    disableMaxSessionDuration: false,
  }
}

function EditForm({
  device,
  locations,
  departments,
  onSave,
  onCancel,
}: {
  device: Device
  locations: FilterOption[]
  departments: FilterOption[]
  onSave: (updated: Partial<Device>) => void
  onCancel: () => void
}) {
  const [state, setState] = useState<EditState>(() => initEdit(device))
  const [saving, setSaving] = useState(false)
  const [invalidateSessions, setInvalidateSessions] = useState(false)

  function toggleMethod(m: string) {
    setState(prev => {
      const next = new Set(prev.permittedMethods)
      if (next.has(m)) { if (next.size > 1) next.delete(m) }
      else next.add(m)
      return { ...prev, permittedMethods: next }
    })
  }

  async function save() {
    setSaving(true)
    try {
      const body = {
        deviceName:   state.deviceName.trim() || device.deviceName,
        locationId:   state.locationId   || null,
        departmentId: state.departmentId || null,
        stationId:    state.stationId    || null,
        loginMode:    state.loginMode,
        permittedMethods: Array.from(state.permittedMethods),
        inactivityTimeoutSeconds:  state.disableInactivityTimeout  ? null : (state.inactivityTimeoutSeconds  ? Number(state.inactivityTimeoutSeconds)  * 60 : null),
        maxSessionDurationSeconds: state.disableMaxSessionDuration ? null : (state.maxSessionDurationSeconds ? Number(state.maxSessionDurationSeconds) * 60 : null),
        disableInactivityTimeout:  state.disableInactivityTimeout,
        disableMaxSessionDuration: state.disableMaxSessionDuration,
        invalidateSessions,
      }
      const res = await fetch(`/api/settings/devices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        toast.error(d.error ?? "Failed to save")
        return
      }
      toast.success("Device updated.")
      onSave({
        deviceName:       body.deviceName,
        loginMode:        body.loginMode,
        permittedMethods: body.permittedMethods,
      })
    } catch {
      toast.error("Connection error.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-3 text-sm">
      {/* Device name */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Device Name</label>
        <input
          type="text"
          value={state.deviceName}
          onChange={e => setState(s => ({ ...s, deviceName: e.target.value }))}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Location / Department */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
          <select
            value={state.locationId}
            onChange={e => setState(s => ({ ...s, locationId: e.target.value }))}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— none —</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
          <select
            value={state.departmentId}
            onChange={e => setState(s => ({ ...s, departmentId: e.target.value }))}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— none —</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {/* Station ID */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Station ID <span className="text-gray-400">(optional)</span></label>
        <input
          type="text"
          value={state.stationId}
          onChange={e => setState(s => ({ ...s, stationId: e.target.value }))}
          placeholder="e.g. KIOSK-01"
          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Login mode */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Login Mode</label>
        <div className="flex gap-3">
          {(["STANDARD", "QUICK_ACCESS"] as const).map(mode => (
            <label key={mode} className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="radio"
                checked={state.loginMode === mode}
                onChange={() => setState(s => ({ ...s, loginMode: mode }))}
              />
              {mode === "STANDARD" ? "Standard" : "Quick Access (kiosk)"}
            </label>
          ))}
        </div>
      </div>

      {/* Permitted methods */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Permitted Login Methods</label>
        <div className="flex gap-3 flex-wrap">
          {ALL_METHODS.map(m => (
            <label key={m} className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={state.permittedMethods.has(m)}
                onChange={() => toggleMethod(m)}
                disabled={state.permittedMethods.has(m) && state.permittedMethods.size === 1}
              />
              {methodLabel(m)}
            </label>
          ))}
        </div>
      </div>

      {/* Session timeouts */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Inactivity Timeout</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number" min="1" placeholder="mins"
              disabled={state.disableInactivityTimeout}
              value={state.inactivityTimeoutSeconds}
              onChange={e => setState(s => ({ ...s, inactivityTimeoutSeconds: e.target.value }))}
              className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={state.disableInactivityTimeout} onChange={e => setState(s => ({ ...s, disableInactivityTimeout: e.target.checked }))} />
              off
            </label>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Max Session Duration</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number" min="1" placeholder="mins"
              disabled={state.disableMaxSessionDuration}
              value={state.maxSessionDurationSeconds}
              onChange={e => setState(s => ({ ...s, maxSessionDurationSeconds: e.target.value }))}
              className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={state.disableMaxSessionDuration} onChange={e => setState(s => ({ ...s, disableMaxSessionDuration: e.target.checked }))} />
              off
            </label>
          </div>
        </div>
      </div>

      {/* Session invalidation */}
      <label className="flex items-start gap-2 p-2 rounded-lg border border-amber-100 bg-amber-50 cursor-pointer">
        <input
          type="checkbox"
          checked={invalidateSessions}
          onChange={e => setInvalidateSessions(e.target.checked)}
          className="mt-0.5"
        />
        <div>
          <span className="text-xs font-medium text-amber-800 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            Invalidate all active sessions on this device
          </span>
          <span className="text-xs text-amber-600">Employees currently logged in will be signed out immediately.</span>
        </div>
      </label>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function DevicesClient({ devices: initial, locations = [], departments = [] }: Props) {
  const router = useRouter()
  const [devices, setDevices] = useState(initial)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [rotating, setRotating] = useState<string | null>(null)
  const [editing,  setEditing]  = useState<string | null>(null)

  async function revoke(deviceId: string) {
    if (!confirm("Revoke this device? All active sessions on it will end immediately.")) return
    setRevoking(deviceId)
    try {
      const res = await fetch(`/api/settings/devices/${deviceId}`, { method: "DELETE" })
      if (!res.ok) { const d = await res.json() as { error?: string }; toast.error(d.error ?? "Failed"); return }
      setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, isActive: false, revokedAt: new Date().toISOString() } : d))
      toast.success("Device revoked.")
      router.refresh()
    } catch { toast.error("Connection error.") }
    finally { setRevoking(null) }
  }

  async function rotateToken(deviceId: string) {
    if (!confirm("Rotate this device's credential? Its login token will change and any saved sessions on it will be invalidated.")) return
    setRotating(deviceId)
    try {
      const res = await fetch(`/api/settings/devices/${deviceId}/rotate`, { method: "POST" })
      if (!res.ok) { const d = await res.json() as { error?: string }; toast.error(d.error ?? "Failed"); return }
      toast.success("Device credential rotated.")
    } catch { toast.error("Connection error.") }
    finally { setRotating(null) }
  }

  function handleEditSave(deviceId: string, updated: Partial<Device>) {
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, ...updated } : d))
    setEditing(null)
  }

  const active   = devices.filter(d => d.isActive)
  const inactive = devices.filter(d => !d.isActive)

  return (
    <div className="space-y-4">
      {devices.length === 0 && (
        <p className="text-sm text-gray-500 py-4 text-center">No registered devices.</p>
      )}

      {active.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Active</h3>
          <div className="space-y-2">
            {active.map(device => (
              <div key={device.id} className="p-4 border border-gray-200 rounded-xl bg-white hover:border-gray-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <Monitor className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">{device.deviceName}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      {device.platform && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{device.platform}</span>
                      )}
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{loginModeLabel(device.loginMode)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {device.permittedMethods.map(m => (
                        <span key={m} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{methodLabel(m)}</span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                      {device.location && <span>{device.location.name}</span>}
                      {device.department && <span>{device.department.name}</span>}
                      <span>Registered {relativeTime(device.registeredAt)}</span>
                      {device.lastSeenAt && <span>Last seen {relativeTime(device.lastSeenAt)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => setEditing(editing === device.id ? null : device.id)}
                      title="Edit device"
                      className={`p-2 border rounded-lg text-gray-400 hover:text-gray-600 transition-colors ${
                        editing === device.id ? "border-blue-300 bg-blue-50 text-blue-600" : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {editing === device.id ? <ChevronUp className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => rotateToken(device.id)}
                      disabled={rotating === device.id || revoking === device.id}
                      title="Rotate credential"
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${rotating === device.id ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      onClick={() => revoke(device.id)}
                      disabled={revoking === device.id || rotating === device.id}
                      title="Revoke device"
                      className="p-2 border border-gray-200 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-60"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {editing === device.id && (
                  <EditForm
                    device={device}
                    locations={locations}
                    departments={departments}
                    onSave={(updated) => handleEditSave(device.id, updated)}
                    onCancel={() => setEditing(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Revoked</h3>
          <div className="space-y-1.5">
            {inactive.map(device => (
              <div key={device.id} className="flex items-center gap-3 px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 opacity-60">
                <XCircle className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-600 flex-1 truncate">{device.deviceName}</span>
                <span className="text-xs text-gray-400">{device.revokedAt ? `Revoked ${relativeTime(device.revokedAt)}` : "Revoked"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
