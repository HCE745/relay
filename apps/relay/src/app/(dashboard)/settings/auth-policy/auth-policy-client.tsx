"use client"

import { useState } from "react"
import { toast } from "@/lib/toast"
import { ToggleLeft, ToggleRight } from "lucide-react"

const ALL_METHODS = ["EMPLOYEE_ID", "ACCESS_CODE", "BADGE"] as const
type Method = typeof ALL_METHODS[number]

const METHOD_LABELS: Record<Method, { label: string; desc: string }> = {
  EMPLOYEE_ID: { label: "Employee ID", desc: "Login with an alphanumeric employee identifier" },
  ACCESS_CODE: { label: "Access Code",  desc: "Login with a 6-character generated code" },
  BADGE:       { label: "Badge / QR",   desc: "Login by scanning a QR code or badge" },
}

function minutesToSeconds(m: string | number): number | null {
  const n = Number(m)
  if (Number.isNaN(n) || n <= 0) return null
  return Math.round(n * 60)
}

function secondsToMinutes(s: number | null): string {
  if (s === null) return ""
  return String(Math.round(s / 60))
}

interface PolicyState {
  permittedMethods:          Method[]
  inactivityTimeoutSeconds:  number | null
  maxSessionDurationSeconds: number | null
  disableInactivityTimeout:  boolean
  disableMaxSessionDuration: boolean
}

export interface AuthPolicyClientProps {
  initialPolicy: PolicyState | null
}
type Props = AuthPolicyClientProps

export function AuthPolicyClient({ initialPolicy }: Props) {
  const defaults: PolicyState = {
    permittedMethods:          ["EMPLOYEE_ID", "ACCESS_CODE", "BADGE"],
    inactivityTimeoutSeconds:  null,
    maxSessionDurationSeconds: null,
    disableInactivityTimeout:  false,
    disableMaxSessionDuration: false,
  }

  const init = initialPolicy ?? defaults

  const [methods, setMethods]       = useState<Set<Method>>(new Set(init.permittedMethods as Method[]))
  const [inactivityMin, setInactMin]   = useState(secondsToMinutes(init.inactivityTimeoutSeconds))
  const [maxDurMin, setMaxDurMin]      = useState(secondsToMinutes(init.maxSessionDurationSeconds))
  const [disableInact, setDisableInact] = useState(init.disableInactivityTimeout)
  const [disableMax, setDisableMax]     = useState(init.disableMaxSessionDuration)
  const [saving, setSaving]             = useState(false)

  function toggleMethod(m: Method) {
    setMethods(prev => {
      const next = new Set(prev)
      if (next.has(m)) { if (next.size > 1) next.delete(m) }
      else next.add(m)
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      const body = {
        permittedMethods:          Array.from(methods),
        inactivityTimeoutSeconds:  disableInact ? null : minutesToSeconds(inactivityMin),
        maxSessionDurationSeconds: disableMax   ? null : minutesToSeconds(maxDurMin),
        disableInactivityTimeout:  disableInact,
        disableMaxSessionDuration: disableMax,
      }
      const res = await fetch("/api/settings/auth-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        toast.error(d.error ?? "Failed to save")
      } else {
        toast.success("Auth policy saved.")
      }
    } catch {
      toast.error("Connection error.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Permitted Auth Methods */}
      <div>
        <h3 className="text-sm font-medium text-gray-800 mb-3">Permitted Login Methods</h3>
        <p className="text-xs text-gray-500 mb-3">
          At least one method must be enabled. These control which credentials employees can use on the kiosk.
        </p>
        <div className="space-y-2">
          {ALL_METHODS.map(m => (
            <label key={m} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={methods.has(m)}
                onChange={() => toggleMethod(m)}
                disabled={methods.has(m) && methods.size === 1}
                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{METHOD_LABELS[m].label}</p>
                <p className="text-xs text-gray-500">{METHOD_LABELS[m].desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Inactivity Timeout */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-medium text-gray-800">Inactivity Timeout</h3>
            <p className="text-xs text-gray-500 mt-0.5">Session ends after this many minutes without a heartbeat</p>
          </div>
          <button
            onClick={() => setDisableInact(v => !v)}
            className="ml-3 shrink-0"
            title={disableInact ? "Enable inactivity timeout" : "Disable inactivity timeout"}
          >
            {disableInact
              ? <ToggleLeft className="w-8 h-8 text-gray-300" />
              : <ToggleRight className="w-8 h-8 text-blue-600" />
            }
          </button>
        </div>
        {!disableInact && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              placeholder="e.g. 30"
              value={inactivityMin}
              onChange={e => setInactMin(e.target.value)}
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">minutes (blank = no timeout)</span>
          </div>
        )}
        {disableInact && <p className="text-xs text-gray-400">Inactivity timeout disabled — per-device settings still apply.</p>}
      </div>

      {/* Max Session Duration */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-medium text-gray-800">Max Session Duration</h3>
            <p className="text-xs text-gray-500 mt-0.5">Session expires after this many minutes regardless of activity</p>
          </div>
          <button
            onClick={() => setDisableMax(v => !v)}
            className="ml-3 shrink-0"
            title={disableMax ? "Enable max session duration" : "Disable max session duration"}
          >
            {disableMax
              ? <ToggleLeft className="w-8 h-8 text-gray-300" />
              : <ToggleRight className="w-8 h-8 text-blue-600" />
            }
          </button>
        </div>
        {!disableMax && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              placeholder="e.g. 480"
              value={maxDurMin}
              onChange={e => setMaxDurMin(e.target.value)}
              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">minutes (blank = no limit)</span>
          </div>
        )}
        {disableMax && <p className="text-xs text-gray-400">Max session duration disabled — sessions last until inactivity timeout or manual logout.</p>}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save Policy"}
      </button>
    </div>
  )
}
