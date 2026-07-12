"use client"

import { useState } from "react"
import {
  ALL_WC_FLAGS, WC_FLAG_LABELS, WC_FLAG_DESCRIPTIONS, WC_FLAG_PLAN,
  type OrgWCFlags,
} from "@/lib/workforce-comms-meta"

const TIER_LABEL: Record<string, string> = {
  essentials:        "Essentials",
  professional:      "Professional",
  professional_plus: "Professional Plus",
  enterprise:        "Enterprise",
}

const TIER_COLOR: Record<string, string> = {
  essentials:        "text-gray-400",
  professional:      "text-blue-400",
  professional_plus: "text-purple-400",
  enterprise:        "text-amber-400",
}

interface Props {
  orgId: string
  flags: OrgWCFlags
}

const TIER_ORDER = ["essentials", "professional", "professional_plus", "enterprise"]

export function OrgWCFlagsPanel({ orgId, flags: initialFlags }: Props) {
  const [flags, setFlags]   = useState(initialFlags)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError]   = useState("")

  async function toggle(key: keyof OrgWCFlags, value: boolean) {
    setSaving(key); setError("")
    try {
      const res = await fetch(`/api/super-admin/organizations/${orgId}/wc-feature-flags`, {
        method:  "PATCH",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ [key]: value }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        setError(j.error ?? "Failed to save"); return
      }
      setFlags(f => ({ ...f, [key]: value }))
    } finally { setSaving(null) }
  }

  const byTier = TIER_ORDER.map(tier => ({
    tier,
    flags: ALL_WC_FLAGS.filter(k => WC_FLAG_PLAN[k] === tier),
  }))

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        Workforce Communications Feature Flags
      </h2>
      <p className="text-xs text-gray-600 mb-4">
        Super admins can override individual flags independent of plan tier — e.g., trial features.
        All changes are logged in the audit trail.
      </p>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <div className="space-y-6">
        {byTier.map(({ tier, flags: tierFlags }) => (
          <div key={tier}>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${TIER_COLOR[tier]}`}>
              {TIER_LABEL[tier]}
            </p>
            <div className="space-y-3">
              {tierFlags.map(key => {
                const enabled  = flags[key]
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
                      <p className="text-sm font-medium text-gray-200">{WC_FLAG_LABELS[key]}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{WC_FLAG_DESCRIPTIONS[key]}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
