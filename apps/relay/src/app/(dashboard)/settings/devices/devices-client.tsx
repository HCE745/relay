"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/lib/toast"
import { Trash2, RefreshCw, Monitor, CheckCircle2, XCircle } from "lucide-react"

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

interface Props {
  devices: Device[]
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

export function DevicesClient({ devices: initial }: Props) {
  const router    = useRouter()
  const [devices, setDevices] = useState(initial)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [rotating, setRotating] = useState<string | null>(null)

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
              <div key={device.id} className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl bg-white hover:border-gray-300 transition-colors">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Monitor className="w-4.5 h-4.5 text-blue-600" />
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
