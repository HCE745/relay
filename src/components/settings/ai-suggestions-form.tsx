"use client"

import { useState } from "react"
import { Sparkles, Loader2, ChevronDown } from "lucide-react"

// ── Org-level policy + audience form (ADMIN only) ─────────────────────────────

interface OrgPolicyFormProps {
  initialPolicy: string
  initialAudience: string
}

export function AiSuggestionsPolicyForm({ initialPolicy, initialAudience }: OrgPolicyFormProps) {
  const [policy, setPolicy] = useState(initialPolicy)
  const [audience, setAudience] = useState(initialAudience)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  async function save(updates: { policy?: string; audience?: string }) {
    setSaving(true)
    setSaved(false)
    setError("")
    try {
      const res = await fetch("/api/settings/ai-suggestions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        setError(json.error ?? "Failed to save")
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  const policyOptions = [
    {
      value: "off_all",
      label: "Off for everyone",
      description: "AI suggestions are disabled organization-wide. Individual users cannot override this.",
    },
    {
      value: "user_choice",
      label: "User choice (recommended)",
      description: "Each user can enable or disable suggestions in their own settings. Defaults to on.",
    },
    {
      value: "on_all",
      label: "On for everyone",
      description: "Suggestions are always shown. Individual users cannot disable this.",
    },
  ]

  const audienceOptions = [
    {
      value: "both",
      label: "Both submitter and assignee",
      description: "The person who reported the issue sees a reassuring summary; the assignee sees technical guidance.",
    },
    {
      value: "submitter_only",
      label: "Submitter only",
      description: "Only the person who reported the issue sees a suggestion after submission.",
    },
    {
      value: "assignee_only",
      label: "Assignee only",
      description: "Only the person the issue is assigned to sees technical guidance at the top of the issue.",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Policy */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Availability</h3>
        <div className="space-y-2">
          {policyOptions.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                policy === opt.value
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="aiPolicy"
                value={opt.value}
                checked={policy === opt.value}
                onChange={() => { setPolicy(opt.value); save({ policy: opt.value }) }}
                className="mt-0.5 accent-blue-600"
                disabled={saving}
              />
              <div>
                <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Audience — only relevant when not off_all */}
      {policy !== "off_all" && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Who sees suggestions</h3>
          <p className="text-xs text-gray-400 mb-3">
            Submitter suggestions are reassuring (what to expect). Assignee suggestions are technical and action-oriented.
          </p>
          <div className="space-y-2">
            {audienceOptions.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                  audience === opt.value
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="aiAudience"
                  value={opt.value}
                  checked={audience === opt.value}
                  onChange={() => { setAudience(opt.value); save({ audience: opt.value }) }}
                  className="mt-0.5 accent-blue-600"
                  disabled={saving}
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="h-5 flex items-center">
        {saving && <span className="flex items-center gap-1.5 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>}
        {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
        AI Suggestions are a beta feature and will continue to improve over time. Suggestions are generated by Claude and may not always be accurate.
      </p>
    </div>
  )
}

// ── Per-user display defaults ─────────────────────────────────────────────────

function PanelDisplayToggle({
  label,
  description,
  iconColor,
  initialCollapsed,
  fieldName,
}: {
  label: string
  description: string
  iconColor: string
  initialCollapsed: boolean
  fieldName: "aiSuggestionsCollapsed" | "sopPanelsCollapsed"
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  async function save(target: boolean) {
    if (target === collapsed || saving) return
    setSaving(true)
    setSaved(false)
    setError("")
    setCollapsed(target)
    try {
      const res = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [fieldName]: target }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        setError(json.error ?? "Failed to save")
        setCollapsed(!target)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setError("Network error")
      setCollapsed(!target)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
          <ChevronDown className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">{label}</div>
          <div className="text-xs text-gray-500 mt-0.5">{description}</div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {saving && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
          {error && <span className="text-xs text-red-500">Error</span>}
        </div>
      </div>
      <div className="ml-11 flex rounded-lg border border-gray-200 overflow-hidden w-fit">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving}
          className={`px-5 py-1.5 text-sm font-medium transition-colors focus:outline-none ${
            !collapsed ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Expanded
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={saving}
          className={`px-5 py-1.5 text-sm font-medium border-l border-gray-200 transition-colors focus:outline-none ${
            collapsed ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Collapsed
        </button>
      </div>
    </div>
  )
}

interface DisplayToggleProps {
  initialCollapsed: boolean
}

export function AiSuggestionsDisplayToggle({ initialCollapsed }: DisplayToggleProps) {
  return (
    <PanelDisplayToggle
      label="AI Suggestions Default Display"
      description="Choose whether AI suggestion panels (submitter guidance, assignee guidance, and suggestion implementation approaches) start expanded or collapsed when you open an issue. You can still toggle each panel individually at any time."
      iconColor="bg-blue-50 text-blue-600"
      initialCollapsed={initialCollapsed}
      fieldName="aiSuggestionsCollapsed"
    />
  )
}

export function SopPanelsDisplayToggle({ initialCollapsed }: DisplayToggleProps) {
  return (
    <PanelDisplayToggle
      label="SOP Panel Default Display"
      description="Choose whether SOP-related panels (Possible SOP Violation callout and SOP Linking section) start expanded or collapsed when you open an issue. You can still toggle each panel individually at any time."
      iconColor="bg-teal-50 text-teal-600"
      initialCollapsed={initialCollapsed}
      fieldName="sopPanelsCollapsed"
    />
  )
}

// ── Per-user toggle (all roles, only when policy = user_choice) ───────────────

interface UserToggleProps {
  initialOn: boolean
  policyLocked: boolean
  forcedValue?: boolean
}

export function AiSuggestionsUserToggle({ initialOn, policyLocked, forcedValue }: UserToggleProps) {
  const [on, setOn] = useState(initialOn)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  async function toggle() {
    if (policyLocked) return
    const next = !on
    setSaving(true)
    setSaved(false)
    setError("")
    setOn(next)
    try {
      const res = await fetch("/api/account/ai-suggestion", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aiSuggestionsOn: next }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        setError(json.error ?? "Failed to save")
        setOn(!next)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setError("Network error")
      setOn(!next)
    } finally {
      setSaving(false)
    }
  }

  const displayed = policyLocked ? (forcedValue ?? false) : on

  return (
    <div className="flex items-start gap-4">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">AI Resolution Suggestions</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {policyLocked
              ? `Your organization has ${forcedValue ? "enabled" : "disabled"} this for everyone.`
              : "Show AI-powered guidance after submitting issues or when issues are assigned to you."}
          </div>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={displayed}
        onClick={toggle}
        disabled={policyLocked || saving}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none
          ${displayed ? "bg-blue-600" : "bg-gray-200"}
          ${policyLocked ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform
            transition duration-200 ease-in-out
            ${displayed ? "translate-x-5" : "translate-x-0"}
          `}
        />
      </button>

      <div className="w-16 flex items-center">
        {saving && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
        {saved && <span className="text-xs text-green-600">Saved</span>}
        {error && <span className="text-xs text-red-500">Error</span>}
      </div>
    </div>
  )
}
