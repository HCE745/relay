"use client"

import { useState } from "react"
import { ToggleLeft, ToggleRight, Lock } from "lucide-react"
import {
  CONFIGURABLE_PAGES,
  CONFIGURABLE_ROLES,
  ALWAYS_ON,
  type PageKey,
  type PageAccessConfig,
} from "@/lib/page-access"

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: "Employee",
  SUPERVISOR: "Supervisor",
  MANAGER: "Manager",
  HR: "HR",
  VENDOR: "Vendor",
}

interface Props {
  initialConfig: PageAccessConfig
  defaultAccess: Record<string, PageKey[]>
}

export function PageAccessManager({ initialConfig, defaultAccess }: Props) {
  const [activeRole, setActiveRole] = useState<string>(CONFIGURABLE_ROLES[0])
  const [config, setConfig] = useState<PageAccessConfig>(() => {
    // Merge initialConfig with defaults so all roles have an explicit array
    const merged: PageAccessConfig = {}
    for (const role of CONFIGURABLE_ROLES) {
      merged[role] = initialConfig[role] ?? defaultAccess[role] ?? []
    }
    return merged
  })
  const [saving, setSaving] = useState<string | null>(null) // page key being saved
  const [error, setError] = useState("")

  const alwaysOn = new Set(ALWAYS_ON[activeRole] ?? [])
  const currentPages = new Set(config[activeRole] ?? [])

  async function togglePage(pageKey: PageKey, enabled: boolean) {
    if (alwaysOn.has(pageKey)) return // locked — can't toggle

    const currentList = config[activeRole] ?? []
    const newList = enabled
      ? [...new Set([...currentList, pageKey])]
      : currentList.filter(p => p !== pageKey)

    // Optimistic update
    setConfig(prev => ({ ...prev, [activeRole]: newList }))
    setSaving(pageKey)
    setError("")

    const res = await fetch("/api/settings/page-access", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: activeRole, pages: newList }),
    })

    setSaving(null)
    if (!res.ok) {
      // Revert
      setConfig(prev => ({ ...prev, [activeRole]: currentList }))
      const data = await res.json()
      setError(data.error ?? "Failed to save")
    }
  }

  return (
    <div>
      {/* Role tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-100 pb-1 overflow-x-auto">
        {CONFIGURABLE_ROLES.map(role => (
          <button
            key={role}
            onClick={() => setActiveRole(role)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              activeRole === role
                ? "bg-blue-100 text-blue-700"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            {ROLE_LABEL[role] ?? role}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="space-y-2">
        {CONFIGURABLE_PAGES.map(({ key, label }) => {
          const isLocked = alwaysOn.has(key)
          const isOn = isLocked || currentPages.has(key)
          const isSaving = saving === key

          return (
            <div
              key={key}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${
                isLocked ? "border-gray-100 bg-gray-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {isLocked && <Lock className="w-3 h-3 text-gray-300" />}
                <span className={`text-sm font-medium ${isLocked ? "text-gray-400" : "text-gray-800"}`}>
                  {label}
                </span>
                {isLocked && <span className="text-xs text-gray-400">(always on)</span>}
              </div>

              <button
                onClick={() => togglePage(key, !isOn)}
                disabled={isLocked || isSaving}
                className="shrink-0 disabled:cursor-not-allowed"
                aria-label={`${isOn ? "Disable" : "Enable"} ${label}`}
              >
                {isOn
                  ? <ToggleRight className={`w-8 h-8 ${isLocked ? "text-gray-300" : "text-blue-600"}`} />
                  : <ToggleLeft className="w-8 h-8 text-gray-300" />
                }
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Changes apply immediately. ADMIN always has full access and is not configurable.
      </p>
    </div>
  )
}
