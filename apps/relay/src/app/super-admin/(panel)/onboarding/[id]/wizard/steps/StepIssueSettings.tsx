"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Trash2, Loader2, AlertTriangle, ChevronDown, ChevronUp, Settings2 } from "lucide-react"
// ── Constants ─────────────────────────────────────────────────────────────────

const ISSUE_CATEGORIES = [
  { value: "GENERAL",             label: "General" },
  { value: "EQUIPMENT_BREAKDOWN", label: "Equipment Breakdown" },
  { value: "SAFETY",              label: "Safety" },
  { value: "MAINTENANCE",         label: "Maintenance" },
  { value: "FACILITY",            label: "Facility" },
  { value: "VEHICLE",             label: "Vehicle" },
]

const PRIORITY_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const
type Priority = typeof PRIORITY_LEVELS[number]

const PRIORITY_COLORS: Record<Priority, string> = {
  CRITICAL: "text-red-400",
  HIGH:     "text-orange-400",
  MEDIUM:   "text-yellow-400",
  LOW:      "text-blue-400",
}

const TERM_KEYS = [
  { key: "issueSingular",      label: "Issue (singular)",      placeholder: "Issue" },
  { key: "issuePlural",        label: "Issue (plural)",         placeholder: "Issues" },
  { key: "locationSingular",   label: "Location (singular)",    placeholder: "Location" },
  { key: "locationPlural",     label: "Location (plural)",      placeholder: "Locations" },
  { key: "departmentSingular", label: "Department (singular)",  placeholder: "Department" },
  { key: "departmentPlural",   label: "Department (plural)",    placeholder: "Departments" },
]

interface PriorityRule {
  id:                 string
  name:               string
  enabled:            boolean
  conditions: {
    category?:    string[]
    titleKeywords?: string[]
  }
  setMinimumPriority: Priority
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onboardingId: string
  isPostLaunch: boolean
  onReady:      () => void
  onNotReady:   () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StepIssueSettings({ onboardingId, isPostLaunch }: Props) {
  const [terminology, setTerminology] = useState<Record<string, string>>({})
  const [rules, setRules]             = useState<PriorityRule[]>([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [saved, setSaved]             = useState(false)
  const [expandedRule, setExpandedRule] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/org-settings`)
      if (!res.ok) throw new Error("Failed to load settings")
      const data = await res.json() as {
        terminologyConfig:   Record<string, string> | null
        priorityRulesConfig: unknown
      }
      setTerminology((data.terminologyConfig ?? {}) as Record<string, string>)
      const raw = data.priorityRulesConfig
      if (Array.isArray(raw)) {
        setRules(raw as PriorityRule[])
      }
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
        body:    JSON.stringify({
          terminologyConfig:   terminology,
          priorityRulesConfig: rules,
        }),
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

  function addRule() {
    const id = crypto.randomUUID()
    setRules(r => [...r, {
      id, name: "New rule", enabled: true,
      conditions: {}, setMinimumPriority: "HIGH",
    }])
    setExpandedRule(id)
  }

  function updateRule(id: string, patch: Partial<PriorityRule>) {
    setRules(r => r.map(rule => rule.id === id ? { ...rule, ...patch } : rule))
  }

  function updateRuleConditions(id: string, patch: Partial<PriorityRule["conditions"]>) {
    setRules(r => r.map(rule => rule.id === id
      ? { ...rule, conditions: { ...rule.conditions, ...patch } }
      : rule
    ))
  }

  function removeRule(id: string) {
    setRules(r => r.filter(rule => rule.id !== id))
    if (expandedRule === id) setExpandedRule(null)
  }

  function setTermValue(key: string, value: string) {
    setTerminology(t => {
      const next = { ...t }
      if (!value.trim()) delete next[key]
      else next[key] = value.trim()
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-900/40 rounded-lg text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* ── Terminology ───────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Terminology</h3>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Customize the labels used throughout the customer's Relay interface. Leave blank to use Relay's default terms.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {TERM_KEYS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
              <input
                type="text"
                value={terminology[key] ?? ""}
                onChange={e => setTermValue(key, e.target.value)}
                placeholder={placeholder}
                disabled={isPostLaunch}
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 disabled:opacity-50"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Priority Rules ─────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Priority Rules</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Automatically elevate issue priority based on category or keywords. Rules are applied in order.
            </p>
          </div>
          {!isPostLaunch && (
            <button
              onClick={addRule}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-800/50 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Rule
            </button>
          )}
        </div>

        {rules.length === 0 ? (
          <p className="text-xs text-gray-600 py-3 text-center">
            No priority rules configured. Issues will use AI-assigned priorities.
          </p>
        ) : (
          <div className="space-y-2">
            {rules.map(rule => (
              <div key={rule.id} className="border border-gray-800 rounded-lg overflow-hidden">
                {/* Rule header */}
                <div
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-800/40 transition-colors"
                  onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                >
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={e => { e.stopPropagation(); updateRule(rule.id, { enabled: e.target.checked }) }}
                    disabled={isPostLaunch}
                    className="rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-600"
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="flex-1 text-sm font-medium text-gray-200 truncate">{rule.name || "Unnamed rule"}</span>
                  <span className={`text-xs font-bold ${PRIORITY_COLORS[rule.setMinimumPriority]}`}>
                    → {rule.setMinimumPriority}
                  </span>
                  {!isPostLaunch && (
                    <button
                      onClick={e => { e.stopPropagation(); removeRule(rule.id) }}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {expandedRule === rule.id
                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                    : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                </div>

                {/* Expanded rule editor */}
                {expandedRule === rule.id && (
                  <div className="px-4 py-3 border-t border-gray-800 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Rule name</label>
                      <input
                        type="text"
                        value={rule.name}
                        onChange={e => updateRule(rule.id, { name: e.target.value })}
                        disabled={isPostLaunch}
                        className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Set minimum priority</label>
                      <select
                        value={rule.setMinimumPriority}
                        onChange={e => updateRule(rule.id, { setMinimumPriority: e.target.value as Priority })}
                        disabled={isPostLaunch}
                        className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600 disabled:opacity-50"
                      >
                        {PRIORITY_LEVELS.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Match categories <span className="text-gray-600">(empty = any)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ISSUE_CATEGORIES.map(cat => {
                          const checked = (rule.conditions.category ?? []).includes(cat.value)
                          return (
                            <label key={cat.value} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isPostLaunch}
                                onChange={e => {
                                  const current = rule.conditions.category ?? []
                                  updateRuleConditions(rule.id, {
                                    category: e.target.checked
                                      ? [...current, cat.value]
                                      : current.filter(c => c !== cat.value),
                                  })
                                }}
                                className="rounded border-gray-600 bg-gray-800 text-indigo-500"
                              />
                              <span className="text-xs text-gray-400">{cat.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Title keywords <span className="text-gray-600">(comma-separated, empty = any)</span>
                      </label>
                      <input
                        type="text"
                        value={(rule.conditions.titleKeywords ?? []).join(", ")}
                        onChange={e => updateRuleConditions(rule.id, {
                          titleKeywords: e.target.value
                            ? e.target.value.split(",").map(k => k.trim()).filter(Boolean)
                            : undefined,
                        })}
                        placeholder="fire, spill, emergency"
                        disabled={isPostLaunch}
                        className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 disabled:opacity-50"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Save ───────────────────────────────────────────────────────────── */}
      {!isPostLaunch && (
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs text-green-400">Saved</span>}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Settings
          </button>
        </div>
      )}
    </div>
  )
}
