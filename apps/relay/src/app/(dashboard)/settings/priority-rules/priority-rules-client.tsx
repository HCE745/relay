"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronUp, Zap } from "lucide-react"
import { toast } from "@/lib/toast"
import type { PriorityRule } from "@/lib/priority-rules"

const CATEGORY_OPTIONS = ["EQUIPMENT", "SAFETY", "INJURY", "MAINTENANCE", "QUALITY", "GENERAL"]
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const
const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH:     "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW:      "bg-gray-100 text-gray-700 border-gray-200",
}

function newRule(): PriorityRule {
  return {
    id: crypto.randomUUID(),
    name: "New Rule",
    enabled: true,
    conditions: { category: ["EQUIPMENT"] },
    setMinimumPriority: "HIGH",
  }
}

interface Props {
  initialRules: unknown
  locations: { id: string; name: string }[]
  departments: { id: string; name: string }[]
}

function parseRules(raw: unknown): PriorityRule[] {
  if (!Array.isArray(raw)) return []
  return raw as PriorityRule[]
}

export function PriorityRulesClient({ initialRules, locations, departments }: Props) {
  const [rules, setRules]     = useState<PriorityRule[]>(() => parseRules(initialRules))
  const [saving, setSaving]   = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function save(updated: PriorityRule[]) {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/priority-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: updated }),
      })
      if (res.ok) toast.success("Priority rules saved")
      else toast.error("Failed to save rules")
    } catch {
      toast.error("Connection error")
    } finally {
      setSaving(false)
    }
  }

  function addRule() {
    const r = newRule()
    const next = [...rules, r]
    setRules(next)
    setExpanded(prev => new Set([...prev, r.id]))
    save(next)
  }

  function deleteRule(id: string) {
    const next = rules.filter(r => r.id !== id)
    setRules(next)
    save(next)
  }

  function updateRule(id: string, patch: Partial<PriorityRule>) {
    const next = rules.map(r => r.id === id ? { ...r, ...patch } : r)
    setRules(next)
    save(next)
  }

  function toggleCategory(rule: PriorityRule, c: string) {
    const cur = rule.conditions.category ?? []
    const next = cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c]
    updateRule(rule.id, { conditions: { ...rule.conditions, category: next } })
  }

  function toggleLocation(rule: PriorityRule, locId: string) {
    const cur = rule.conditions.locationIds ?? []
    const next = cur.includes(locId) ? cur.filter(x => x !== locId) : [...cur, locId]
    updateRule(rule.id, { conditions: { ...rule.conditions, locationIds: next } })
  }

  function updateKeywords(rule: PriorityRule, value: string) {
    const keywords = value.split(",").map(k => k.trim()).filter(Boolean)
    updateRule(rule.id, { conditions: { ...rule.conditions, titleKeywords: keywords } })
  }

  return (
    <div className="space-y-4">
      {rules.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Zap className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-900 mb-1">No priority rules</p>
          <p className="text-sm text-gray-500 mb-5">
            By default, priority is set by AI. Add rules to guarantee minimum priority for certain issue types.
          </p>
          <button
            onClick={addRule}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium"
          >
            Add First Rule
          </button>
        </div>
      )}

      {rules.map(rule => (
        <div key={rule.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
              className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${rule.enabled ? "bg-blue-500" : "bg-gray-200"}`}
              role="switch"
              aria-checked={rule.enabled}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.enabled ? "translate-x-4" : ""}`} />
            </button>
            <input
              className="flex-1 font-medium text-sm text-gray-900 bg-transparent outline-none focus:bg-gray-50 rounded px-1"
              value={rule.name}
              onChange={e => updateRule(rule.id, { name: e.target.value })}
              onBlur={() => save(rules)}
            />
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${PRIORITY_COLOR[rule.setMinimumPriority]}`}>
              min {rule.setMinimumPriority}
            </span>
            <button onClick={() => toggleExpand(rule.id)} className="p-1 text-gray-400 hover:text-gray-600">
              {expanded.has(rule.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button onClick={() => deleteRule(rule.id)} className="p-1 text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {!expanded.has(rule.id) && (
            <div className="px-4 pb-3 text-xs text-gray-500 flex flex-wrap gap-2">
              {rule.conditions.category?.length ? (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {rule.conditions.category.join(", ")}
                </span>
              ) : <span className="text-gray-400">Any category</span>}
            </div>
          )}

          {expanded.has(rule.id) && (
            <div className="border-t border-gray-100 px-4 py-4 space-y-5">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">When category is</h4>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => toggleCategory(rule, c)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        rule.conditions.category?.includes(c)
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                  <button
                    onClick={() => updateRule(rule.id, { conditions: { ...rule.conditions, category: [] } })}
                    className="px-3 py-1 rounded-full text-xs text-gray-400 border border-dashed border-gray-200 hover:border-gray-300"
                  >
                    Any category
                  </button>
                </div>
              </div>

              {locations.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">And location is</h4>
                  <div className="flex flex-wrap gap-2">
                    {locations.map(l => (
                      <button
                        key={l.id}
                        onClick={() => toggleLocation(rule, l.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          rule.conditions.locationIds?.includes(l.id)
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {l.name}
                      </button>
                    ))}
                    <button
                      onClick={() => updateRule(rule.id, { conditions: { ...rule.conditions, locationIds: [] } })}
                      className="px-3 py-1 rounded-full text-xs text-gray-400 border border-dashed border-gray-200 hover:border-gray-300"
                    >
                      Any location
                    </button>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Or title contains keywords</h4>
                <input
                  type="text"
                  placeholder="e.g. conveyor, press, forklift (comma-separated)"
                  value={(rule.conditions.titleKeywords ?? []).join(", ")}
                  onChange={e => updateKeywords(rule, e.target.value)}
                  onBlur={() => save(rules)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Then set minimum priority to</h4>
                <div className="flex gap-2">
                  {PRIORITY_OPTIONS.map(p => (
                    <button
                      key={p}
                      onClick={() => updateRule(rule.id, { setMinimumPriority: p })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        rule.setMinimumPriority === p
                          ? PRIORITY_COLOR[p]
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Rules raise priority only — they never lower it.</p>
              </div>
            </div>
          )}
        </div>
      ))}

      {rules.length > 0 && (
        <button
          onClick={addRule}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 text-gray-600 rounded-lg text-sm hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      )}

      {saving && <p className="text-xs text-gray-400">Saving…</p>}
    </div>
  )
}
