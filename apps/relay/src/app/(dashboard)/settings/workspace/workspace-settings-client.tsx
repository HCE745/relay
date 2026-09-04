"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { TermKey } from "@/lib/workspace-config"

interface NavItemDescriptor {
  href: string
  defaultLabel: string
  currentLabel: string
}

interface TermItemDescriptor {
  key: TermKey
  label: string
  group: string
  platformDefault: string
  currentValue: string
}

interface Props {
  industry: string
  navItems: NavItemDescriptor[] | null
  termItems: TermItemDescriptor[]
  initialNavConfig: { labelOverrides?: Record<string, string> }
  initialTermConfig: Record<string, string>
}

export function WorkspaceSettingsClient({
  industry,
  navItems,
  termItems,
  initialNavConfig,
  initialTermConfig,
}: Props) {
  const router = useRouter()

  // Nav label overrides state
  const [navOverrides, setNavOverrides] = useState<Record<string, string>>(
    initialNavConfig.labelOverrides ?? {}
  )

  // Terminology overrides state
  const [termOverrides, setTermOverrides] = useState<Record<string, string>>(
    initialTermConfig
  )

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  function setNavLabel(href: string, value: string, defaultLabel: string) {
    setNavOverrides(prev => {
      const next = { ...prev }
      if (!value || value === defaultLabel) {
        delete next[href]
      } else {
        next[href] = value
      }
      return next
    })
    setSaved(false)
  }

  function setTermValue(key: string, value: string) {
    setTermOverrides(prev => {
      const next = { ...prev }
      if (!value) {
        delete next[key]
      } else {
        next[key] = value
      }
      return next
    })
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const res = await fetch("/api/settings/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          navigationConfig:  { labelOverrides: navOverrides },
          terminologyConfig: termOverrides,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? "Failed to save. Please try again.")
        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setError("Network error — please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleResetAll() {
    if (!confirm("Reset all workspace customizations to defaults?")) return
    setSaving(true)
    setError("")
    try {
      await fetch("/api/settings/workspace", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "all" }),
      })
      setNavOverrides({})
      setTermOverrides({})
      setSaved(true)
      router.refresh()
    } catch {
      setError("Reset failed — please try again.")
    } finally {
      setSaving(false)
    }
  }

  const hasChanges =
    Object.keys(navOverrides).length > 0 || Object.keys(termOverrides).length > 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

      {/* Header description */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
        <h2 className="text-sm font-semibold text-blue-900 mb-1">Workspace Customization</h2>
        <p className="text-sm text-blue-700">
          Customize how Relay labels navigation items and key terms across your workspace.
          {industry && ` Changes apply to all users in your organization.`}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Navigation labels ────────────────────────────────────────────── */}
      {navItems ? (
        <section>
          <div className="mb-4">
            <h3 className="text-base font-bold text-gray-900">Navigation Labels</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Rename items in your sidebar and mobile navigation.
              Leave blank to use the {industry} default.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {navItems.map(item => {
              const override = navOverrides[item.href] ?? ""
              return (
                <div key={item.href} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-40 shrink-0">
                    <div className="text-xs font-medium text-gray-400 truncate" title={item.href}>
                      Default: <span className="text-gray-700 font-semibold">{item.defaultLabel}</span>
                    </div>
                    <div className="text-[11px] text-gray-400 truncate mt-0.5">{item.href}</div>
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={override}
                      onChange={e => setNavLabel(item.href, e.target.value, item.defaultLabel)}
                      placeholder={item.defaultLabel}
                      maxLength={48}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                    />
                  </div>
                  {override && (
                    <button
                      type="button"
                      onClick={() => setNavLabel(item.href, "", item.defaultLabel)}
                      className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <section>
          <div className="mb-4">
            <h3 className="text-base font-bold text-gray-900">Navigation Labels</h3>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-sm text-gray-500">
            Navigation label customization is available for industry-specific workspaces (Car Wash, Property Management, Manufacturing).
            Your workspace uses the standard Relay navigation.
          </div>
        </section>
      )}

      {/* ── Terminology ──────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h3 className="text-base font-bold text-gray-900">Terminology</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Rename core Relay concepts to match your organization&apos;s language.
            Leave blank to use the {industry || "platform"} default.
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {termItems.map(item => {
            const override = termOverrides[item.key] ?? ""
            return (
              <div key={item.key} className="flex items-center gap-4 px-4 py-3">
                <div className="w-44 shrink-0">
                  <div className="text-xs font-medium text-gray-700">{item.label}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    Default: <span className="font-medium">{item.platformDefault}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={override}
                    onChange={e => setTermValue(item.key, e.target.value)}
                    placeholder={item.platformDefault}
                    maxLength={40}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                  />
                </div>
                {override && (
                  <button
                    type="button"
                    onClick={() => setTermValue(item.key, "")}
                    className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={handleResetAll}
          disabled={saving || !hasChanges}
          className="text-sm text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reset all to defaults
        </button>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-emerald-600 font-medium">Saved</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}
