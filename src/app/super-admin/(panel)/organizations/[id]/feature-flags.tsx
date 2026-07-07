"use client"

import { useState } from "react"
import { FEATURE_FLAG_LABELS, FEATURE_FLAG_DESCRIPTIONS, type OrgFeatureFlags } from "@/lib/pricing"

interface Props {
  orgId: string
  flags: OrgFeatureFlags
}

const FLAG_KEYS = Object.keys(FEATURE_FLAG_LABELS) as (keyof OrgFeatureFlags)[]

export function OrgFeatureFlagsPanel({ orgId, flags: initialFlags }: Props) {
  const [flags, setFlags] = useState(initialFlags)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function toggle(key: keyof OrgFeatureFlags, value: boolean) {
    setSaving(key); setError("")
    try {
      const res = await fetch(`/api/super-admin/organizations/${orgId}/feature-flags`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        setError(j.error ?? "Failed to save"); return
      }
      setFlags(f => ({ ...f, [key]: value }))
    } finally { setSaving(null) }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Professional Plus Feature Flags</h2>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      <div className="space-y-3">
        {FLAG_KEYS.map(key => {
          const enabled = flags[key]
          const isSaving = saving === key
          return (
            <div key={key} className="flex items-start gap-3">
              <button
                onClick={() => toggle(key, !enabled)}
                disabled={isSaving}
                className={`relative inline-flex h-5 w-9 shrink-0 mt-0.5 rounded-full transition-colors duration-200 focus:outline-none ${
                  enabled ? "bg-indigo-500" : "bg-gray-700"
                } ${isSaving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                role="switch"
                aria-checked={enabled}
              >
                <span className={`inline-block h-4 w-4 mt-0.5 ml-0.5 transform rounded-full bg-white shadow transition-transform duration-200 ${enabled ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-200">{FEATURE_FLAG_LABELS[key]}</p>
                <p className="text-xs text-gray-500 mt-0.5">{FEATURE_FLAG_DESCRIPTIONS[key]}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
