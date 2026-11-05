"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronUp, Bell, BellOff } from "lucide-react"
import { toast } from "@/lib/toast"
import type { NotificationRule } from "@/lib/notification-rules"

const PRIORITY_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
const CATEGORY_OPTIONS = ["EQUIPMENT", "SAFETY", "INJURY", "MAINTENANCE", "QUALITY", "GENERAL"]
const ROLE_OPTIONS = ["ADMIN", "MANAGER", "SUPERVISOR", "HR", "EMPLOYEE"]

function newRule(): NotificationRule {
  return {
    id: crypto.randomUUID(),
    name: "New Rule",
    enabled: true,
    conditions: { priority: ["CRITICAL", "HIGH"] },
    recipients: { roles: ["ADMIN", "MANAGER"] },
    channels: { inApp: true, email: true, push: false },
  }
}

interface Props {
  initialRules: unknown
  locations: { id: string; name: string }[]
  departments: { id: string; name: string }[]
  users: { id: string; name: string; role: string }[]
}

function parseRules(raw: unknown): NotificationRule[] {
  if (!Array.isArray(raw)) return []
  return raw as NotificationRule[]
}

export function NotificationRulesClient({ initialRules, locations, departments, users }: Props) {
  const [rules, setRules]     = useState<NotificationRule[]>(() => parseRules(initialRules))
  const [saving, setSaving]   = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function save(updated: NotificationRule[]) {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/notification-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: updated }),
      })
      if (res.ok) {
        toast.success("Notification rules saved")
      } else {
        toast.error("Failed to save rules")
      }
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

  function updateRule(id: string, patch: Partial<NotificationRule>) {
    const next = rules.map(r => r.id === id ? { ...r, ...patch } : r)
    setRules(next)
    save(next)
  }

  function togglePriority(rule: NotificationRule, p: string) {
    const cur = rule.conditions.priority ?? []
    const next = cur.includes(p) ? cur.filter(x => x !== p) : [...cur, p]
    updateRule(rule.id, { conditions: { ...rule.conditions, priority: next } })
  }

  function toggleCategory(rule: NotificationRule, c: string) {
    const cur = rule.conditions.category ?? []
    const next = cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c]
    updateRule(rule.id, { conditions: { ...rule.conditions, category: next } })
  }

  function toggleRole(rule: NotificationRule, role: string) {
    const cur = rule.recipients.roles ?? []
    const next = cur.includes(role) ? cur.filter(x => x !== role) : [...cur, role]
    updateRule(rule.id, { recipients: { ...rule.recipients, roles: next } })
  }

  function toggleLocation(rule: NotificationRule, locId: string) {
    const cur = rule.conditions.locationIds ?? []
    const next = cur.includes(locId) ? cur.filter(x => x !== locId) : [...cur, locId]
    updateRule(rule.id, { conditions: { ...rule.conditions, locationIds: next } })
  }

  function toggleRecipientDept(rule: NotificationRule, deptId: string) {
    const cur = rule.recipients.recipientDepartmentIds ?? []
    const next = cur.includes(deptId) ? cur.filter(x => x !== deptId) : [...cur, deptId]
    updateRule(rule.id, { recipients: { ...rule.recipients, recipientDepartmentIds: next } })
  }

  function toggleUserId(rule: NotificationRule, userId: string) {
    const cur = rule.recipients.userIds ?? []
    const next = cur.includes(userId) ? cur.filter(x => x !== userId) : [...cur, userId]
    updateRule(rule.id, { recipients: { ...rule.recipients, userIds: next } })
  }

  return (
    <div className="space-y-4">
      {rules.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Bell className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-900 mb-1">No notification rules</p>
          <p className="text-sm text-gray-500 mb-5">
            By default only the assignee is notified. Add rules to alert additional people for critical issues.
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
          {/* Rule header */}
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
            {!rule.enabled && <BellOff className="w-4 h-4 text-gray-400" />}
            <button
              onClick={() => toggleExpand(rule.id)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              {expanded.has(rule.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={() => deleteRule(rule.id)}
              className="p-1 text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Summary line when collapsed */}
          {!expanded.has(rule.id) && (
            <div className="px-4 pb-3 text-xs text-gray-500 flex flex-wrap gap-2">
              {rule.conditions.priority?.length ? (
                <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">
                  {rule.conditions.priority.join(", ")}
                </span>
              ) : null}
              {(rule.recipients.roles?.length ?? 0) > 0 && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  → {rule.recipients.roles!.join(", ")}
                </span>
              )}
              {rule.channels.inApp && <span className="text-gray-400">In-app</span>}
              {rule.channels.email && <span className="text-gray-400">Email</span>}
            </div>
          )}

          {/* Expanded editor */}
          {expanded.has(rule.id) && (
            <div className="border-t border-gray-100 px-4 py-4 space-y-5">
              {/* Conditions */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">When issue priority is</h4>
                <div className="flex flex-wrap gap-2">
                  {PRIORITY_OPTIONS.map(p => (
                    <button
                      key={p}
                      onClick={() => togglePriority(rule, p)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        rule.conditions.priority?.includes(p)
                          ? "bg-orange-100 text-orange-800 border-orange-200"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => updateRule(rule.id, { conditions: { ...rule.conditions, priority: [] } })}
                    className="px-3 py-1 rounded-full text-xs text-gray-400 border border-dashed border-gray-200 hover:border-gray-300"
                  >
                    Any priority
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">And category is</h4>
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

              {/* Recipients — roles */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Then notify these roles</h4>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map(role => (
                    <button
                      key={role}
                      onClick={() => toggleRole(rule, role)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        rule.recipients.roles?.includes(role)
                          ? "bg-purple-100 text-purple-800 border-purple-200"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipients — departments */}
              {departments.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">And/or notify all members of these departments</h4>
                  <div className="flex flex-wrap gap-2">
                    {departments.map(d => (
                      <button
                        key={d.id}
                        onClick={() => toggleRecipientDept(rule, d.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          rule.recipients.recipientDepartmentIds?.includes(d.id)
                            ? "bg-teal-100 text-teal-800 border-teal-200"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recipients — specific employees */}
              {users.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">And/or notify specific employees</h4>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {users.map(u => (
                      <button
                        key={u.id}
                        onClick={() => toggleUserId(rule, u.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          rule.recipients.userIds?.includes(u.id)
                            ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {u.name}
                        <span className="ml-1 text-gray-400">{u.role.toLowerCase()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recipients — assignee */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.recipients.includeAssignee ?? false}
                    onChange={e => updateRule(rule.id, { recipients: { ...rule.recipients, includeAssignee: e.target.checked } })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Also notify the issue's assigned owner</span>
                </label>
              </div>

              {/* Channels */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Via channels</h4>
                <div className="flex gap-3">
                  {(["inApp", "email", "push"] as const).map(ch => (
                    <label key={ch} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.channels[ch]}
                        onChange={e => updateRule(rule.id, { channels: { ...rule.channels, [ch]: e.target.checked } })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700 capitalize">{ch === "inApp" ? "In-app" : ch}</span>
                    </label>
                  ))}
                </div>
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
