"use client"

import { useEffect, useState, useCallback } from "react"
import { Loader2, AlertTriangle, Flag } from "lucide-react"
import { FEATURE_FLAG_LABELS, FEATURE_FLAG_DESCRIPTIONS, type OrgFeatureFlags } from "@/lib/pricing"

// Flags that make sense to configure at wizard time (subset of all flags)
const WIZARD_FLAGS: (keyof OrgFeatureFlags)[] = [
  "qr_codes_enabled",
  "regions_enabled",
  "advanced_escalations_enabled",
  "recognition_enabled",
  "executive_briefings_enabled",
  "health_scores_enabled",
  "trend_detection_enabled",
  "executive_goals_enabled",
  "customer_voice_enabled",
]

interface Props {
  onboardingId: string
  isPostLaunch: boolean
  onReady:      () => void
  onNotReady:   () => void
}

export function StepFeatureFlags({ onboardingId, isPostLaunch }: Props) {
  const [flags, setFlags]     = useState<Partial<Record<keyof OrgFeatureFlags, boolean>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [saved, setSaved]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/org-settings`)
      if (!res.ok) throw new Error("Failed to load settings")
      const data = await res.json() as { featureFlags: Partial<Record<keyof OrgFeatureFlags, boolean>> }
      setFlags(data.featureFlags ?? {})
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [onboardingId])

  useEffect(() => { void load() }, [load])

  async function save() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/org-settings`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ featureFlags: flags }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? "Save failed")
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  function toggle(key: keyof OrgFeatureFlags) {
    setFlags(f => ({ ...f, [key]: !f[key] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-900/40 rounded-lg text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
          <Flag className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Product Feature Flags</h3>
        </div>
        <p className="px-5 py-3 text-xs text-gray-400 border-b border-gray-800">
          Enable the product capabilities this customer's plan includes. These flags take effect immediately in their environment.
        </p>
        <ul className="divide-y divide-gray-800">
          {WIZARD_FLAGS.map(key => (
            <li key={key} className="flex items-start gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-100">{FEATURE_FLAG_LABELS[key]}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{FEATURE_FLAG_DESCRIPTIONS[key]}</div>
              </div>
              <label className="flex-shrink-0 relative cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={!!flags[key]}
                  disabled={isPostLaunch}
                  onChange={() => toggle(key)}
                />
                <div className={[
                  "w-10 h-5 rounded-full border transition-colors",
                  flags[key]
                    ? "bg-indigo-600 border-indigo-500"
                    : "bg-gray-800 border-gray-700",
                  isPostLaunch ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}>
                  <div className={[
                    "w-3.5 h-3.5 rounded-full bg-white shadow absolute top-0.5 transition-transform",
                    flags[key] ? "translate-x-5" : "translate-x-0.5",
                  ].join(" ")} />
                </div>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {!isPostLaunch && (
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs text-green-400">Saved</span>}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Feature Flags
          </button>
        </div>
      )}
    </div>
  )
}
