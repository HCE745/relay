"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Monitor, CheckCircle2, AlertCircle } from "lucide-react"

interface Location  { id: string; name: string }
interface Department { id: string; name: string }

type Step = "auth" | "configure" | "done"

export default function RegisterDevicePage() {
  const router = useRouter()
  const [step, setStep]           = useState<Step>("auth")
  const [locations, setLocations]   = useState<Location[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [err, setErr]               = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)

  // Form fields
  const [deviceName, setDeviceName]       = useState("")
  const [locationId, setLocationId]       = useState("")
  const [departmentId, setDepartmentId]   = useState("")
  const [loginMode, setLoginMode]         = useState("STANDARD")
  const [inactMin, setInactMin]           = useState("")
  const [maxDurMin, setMaxDurMin]         = useState("")

  // Check if already registered + load org data
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings/devices")
        if (res.status === 401) { router.replace("/login"); return }
        if (res.status === 403) { setErr("Only admins can register devices."); return }
        if (!res.ok) return
        const data = await res.json() as { devices: { id: string }[] }
        // If already a device cookie, check if it's one of our devices
        void data
      } catch { /* network error — stay */ }
    })()
  }, [router])

  // Load locations and departments for the form
  useEffect(() => {
    if (step !== "configure") return
    void (async () => {
      try {
        const [locRes, deptRes] = await Promise.all([
          fetch("/api/locations"),
          fetch("/api/departments"),
        ])
        if (locRes.ok)  setLocations(await locRes.json() as Location[])
        if (deptRes.ok) setDepartments(await deptRes.json() as Department[])
      } catch { /* skip — optional enrichment */ }
    })()
  }, [step])

  async function handleRegister() {
    if (!deviceName.trim()) { setErr("Device name is required"); return }
    setSaving(true); setErr(null)
    try {
      const inactSec = inactMin ? Math.round(Number(inactMin) * 60) : null
      const maxSec   = maxDurMin ? Math.round(Number(maxDurMin) * 60) : null
      const res = await fetch("/api/settings/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceName: deviceName.trim(),
          locationId:  locationId  || null,
          departmentId: departmentId || null,
          loginMode,
          permittedMethods: ["EMPLOYEE_ID", "ACCESS_CODE", "BADGE"],
          inactivityTimeoutSeconds:  inactSec,
          maxSessionDurationSeconds: maxSec,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setErr(d.error ?? "Registration failed")
        return
      }
      setStep("done")
    } catch {
      setErr("Connection error. Please check your network.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Monitor className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Register This Device</h1>
          <p className="text-sm text-gray-500 mt-1">Set up this device as an employee kiosk</p>
        </div>

        {err && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {err}
          </div>
        )}

        {step === "done" ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Device Registered</h2>
            <p className="text-sm text-gray-500 mb-6">
              <strong>{deviceName}</strong> is now registered. Employees can log in on this device using their credentials.
              Your admin session has been recorded; you can now close your admin session on this device.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              Go to Employee Login
            </button>
          </div>
        ) : step === "auth" ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <p className="text-sm text-gray-600 mb-6">
              You must be signed in as an Admin to register a device. If you&apos;re already signed in, continue to configure this device.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setStep("configure")}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
              >
                Configure Device
              </button>
              <button
                onClick={() => router.push("/login?next=/register-device")}
                className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Sign in as Admin
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
                placeholder="e.g. Lobby Kiosk, Warehouse A"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {locations.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <select
                  value={locationId}
                  onChange={e => setLocationId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Any location —</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}

            {departments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={departmentId}
                  onChange={e => setDepartmentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Any department —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Login Mode</label>
              <select
                value={loginMode}
                onChange={e => setLoginMode(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="STANDARD">Standard — employee searches by name then authenticates</option>
                <option value="QUICK_ACCESS">Quick Access — employee scans badge or enters code directly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inactivity Timeout (minutes)</label>
              <input
                type="number"
                min="1"
                value={inactMin}
                onChange={e => setInactMin(e.target.value)}
                placeholder="Leave blank to use org default"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Session Duration (minutes)</label>
              <input
                type="number"
                min="1"
                value={maxDurMin}
                onChange={e => setMaxDurMin(e.target.value)}
                placeholder="Leave blank to use org default"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep("auth")}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleRegister}
                disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-xl text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Registering…" : "Register Device"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
