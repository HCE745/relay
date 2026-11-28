"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, Trash2, Loader2, AlertTriangle, Bell, ArrowRight, ChevronDown, ChevronUp } from "lucide-react"

// ── Constants ─────────────────────────────────────────────────────────────────

const ISSUE_CATEGORIES = [
  { value: "GENERAL",             label: "General" },
  { value: "EQUIPMENT_BREAKDOWN", label: "Equipment Breakdown" },
  { value: "SAFETY",              label: "Safety" },
  { value: "MAINTENANCE",         label: "Maintenance" },
  { value: "FACILITY",            label: "Facility" },
  { value: "VEHICLE",             label: "Vehicle" },
]

const PRIORITY_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
const ROLES = ["ADMIN", "MANAGER", "SUPERVISOR", "HR", "EMPLOYEE"]
interface AckEscalationConfig {
  enabled:      boolean
  delayMinutes: number
  recipients:   { roles: string[] }
}

interface RoutingRule {
  id:             string
  name:           string
  description:    string | null
  isActive:       boolean
  condCategory:   string | null
  condLocationId: string | null
  condDeptId:     string | null
  condPriority:   string | null
  assignToRole:   string | null
  assignToUserId: string | null
  condLocation:   { id: string; name: string } | null
  condDept:       { id: string; name: string } | null
  assignToUser:   { id: string; name: string } | null
}

interface EscalationChain {
  id:               string
  name:             string
  description:      string | null
  isActive:         boolean
  triggerPriority:  string | null
  triggerCategory:  string | null
  hoursToFirst:     number
  steps:            Array<{
    id:                 string
    stepOrder:          number
    label:              string | null
    role:               string | null
    userId:             string | null
    notifyVia:          string
    hoursAfterPrevious: number
  }>
}

interface Props {
  onboardingId: string
  isPostLaunch: boolean
  onReady:      () => void
  onNotReady:   () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StepNotifications({ onboardingId, isPostLaunch }: Props) {
  const [routingRules, setRoutingRules]     = useState<RoutingRule[]>([])
  const [chains, setChains]                 = useState<EscalationChain[]>([])
  const [loading, setLoading]               = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [saved, setSaved]                   = useState(false)
  const [expandedChain, setExpandedChain]   = useState<string | null>(null)

  // New rule form
  const [showRuleForm, setShowRuleForm]     = useState(false)
  const [newRule, setNewRule]               = useState({ name: "", condCategory: "", condPriority: "", assignToRole: "MANAGER" })

  // New chain form
  const [showChainForm, setShowChainForm]   = useState(false)
  const [newChain, setNewChain]             = useState({ name: "", triggerPriority: "", hoursToFirst: 24 })

  // Ack config local state
  const [ackEnabled, setAckEnabled]         = useState(false)
  const [ackDelay, setAckDelay]             = useState(60)
  const [ackRoles, setAckRoles]             = useState<string[]>(["MANAGER"])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, rulesRes, chainsRes] = await Promise.all([
        fetch(`/api/super-admin/onboarding/${onboardingId}/configure/org-settings`),
        fetch(`/api/super-admin/onboarding/${onboardingId}/configure/routing-rules`),
        fetch(`/api/super-admin/onboarding/${onboardingId}/configure/escalations`),
      ])
      if (!settingsRes.ok || !rulesRes.ok || !chainsRes.ok) throw new Error("Failed to load")
      const settings = await settingsRes.json() as { ackEscalationConfig: AckEscalationConfig | null }
      const rules    = await rulesRes.json() as RoutingRule[]
      const chainList = await chainsRes.json() as EscalationChain[]

      setRoutingRules(rules)
      setChains(chainList)

      const ack = settings.ackEscalationConfig
      if (ack) {
        setAckEnabled(ack.enabled)
        setAckDelay(ack.delayMinutes)
        setAckRoles(ack.recipients?.roles ?? ["MANAGER"])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }, [onboardingId])

  useEffect(() => { void load() }, [load])

  async function saveAckEscalation() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/org-settings`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ackEscalationConfig: { enabled: ackEnabled, delayMinutes: ackDelay, recipients: { roles: ackRoles } },
        }),
      })
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Save failed")
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function addRoutingRule() {
    if (!newRule.name.trim() || !newRule.assignToRole) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/routing-rules`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:         newRule.name.trim(),
          condCategory: newRule.condCategory || undefined,
          condPriority: newRule.condPriority || undefined,
          assignToRole: newRule.assignToRole,
        }),
      })
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Failed")
      const created = await res.json() as RoutingRule
      setRoutingRules(r => [...r, { ...created, condLocation: null, condDept: null, assignToUser: null }])
      setNewRule({ name: "", condCategory: "", condPriority: "", assignToRole: "MANAGER" })
      setShowRuleForm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add rule")
    } finally {
      setSaving(false)
    }
  }

  async function deleteRoutingRule(ruleId: string) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/routing-rules/${ruleId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete rule")
      setRoutingRules(r => r.filter(rule => rule.id !== ruleId))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setSaving(false)
    }
  }

  async function addEscalationChain() {
    if (!newChain.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/escalations`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:            newChain.name.trim(),
          triggerPriority: newChain.triggerPriority || undefined,
          hoursToFirst:    newChain.hoursToFirst,
          steps:           [
            { stepOrder: 1, role: "MANAGER",  notifyVia: "EMAIL", hoursAfterPrevious: 24, label: "Manager alert" },
          ],
        }),
      })
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Failed")
      const created = await res.json() as EscalationChain
      setChains(c => [...c, created])
      setNewChain({ name: "", triggerPriority: "", hoursToFirst: 24 })
      setShowChainForm(false)
      setExpandedChain(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add chain")
    } finally {
      setSaving(false)
    }
  }

  async function deleteChain(chainId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/super-admin/onboarding/${onboardingId}/configure/escalations/${chainId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete chain")
      setChains(c => c.filter(ch => ch.id !== chainId))
      if (expandedChain === chainId) setExpandedChain(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setSaving(false)
    }
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

      {/* ── Acknowledgment Escalation ──────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Acknowledgment Escalation</h3>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Automatically notify managers when a reported issue hasn't been acknowledged within a set time window.
        </p>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ackEnabled}
              onChange={e => setAckEnabled(e.target.checked)}
              disabled={isPostLaunch}
              className="rounded border-gray-600 bg-gray-800 text-indigo-500"
            />
            <span className="text-sm text-gray-200">Enable acknowledgment escalation</span>
          </label>
          {ackEnabled && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Escalate after (minutes)</label>
                <input
                  type="number"
                  min={5}
                  value={ackDelay}
                  onChange={e => setAckDelay(Math.max(5, parseInt(e.target.value) || 60))}
                  disabled={isPostLaunch}
                  className="w-32 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Notify roles</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map(role => (
                    <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ackRoles.includes(role)}
                        disabled={isPostLaunch}
                        onChange={e => setAckRoles(r => e.target.checked ? [...r, role] : r.filter(x => x !== role))}
                        className="rounded border-gray-600 bg-gray-800 text-indigo-500"
                      />
                      <span className="text-xs text-gray-400">{role}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        {!isPostLaunch && (
          <div className="flex items-center justify-end gap-3 mt-4">
            {saved && <span className="text-xs text-green-400">Saved</span>}
            <button
              onClick={saveAckEscalation}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Save
            </button>
          </div>
        )}
      </div>

      {/* ── Routing Rules ──────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-semibold text-white">Issue Routing Rules</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Auto-assign issues to the right role based on category, location, or department.
            </p>
          </div>
          {!isPostLaunch && (
            <button
              onClick={() => setShowRuleForm(v => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-800/50 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Rule
            </button>
          )}
        </div>

        {showRuleForm && (
          <div className="mt-3 p-3 border border-gray-700 rounded-lg space-y-2 bg-gray-800/40">
            <input
              type="text"
              value={newRule.name}
              onChange={e => setNewRule(r => ({ ...r, name: e.target.value }))}
              placeholder="Rule name *"
              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newRule.condCategory}
                onChange={e => setNewRule(r => ({ ...r, condCategory: e.target.value }))}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="">Any category</option>
                {ISSUE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select
                value={newRule.condPriority}
                onChange={e => setNewRule(r => ({ ...r, condPriority: e.target.value }))}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="">Any priority</option>
                {PRIORITY_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 flex-shrink-0">Assign to role:</label>
              <select
                value={newRule.assignToRole}
                onChange={e => setNewRule(r => ({ ...r, assignToRole: e.target.value }))}
                className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowRuleForm(false); setNewRule({ name: "", condCategory: "", condPriority: "", assignToRole: "MANAGER" }) }}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addRoutingRule}
                disabled={!newRule.name.trim() || saving}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {routingRules.length === 0 && !showRuleForm ? (
          <p className="text-xs text-gray-600 py-3 text-center mt-3">
            No routing rules. Issues will be unassigned by default.
          </p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {routingRules.map(rule => (
              <div key={rule.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-800/40 border border-gray-800 rounded-lg">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${rule.isActive ? "bg-green-500" : "bg-gray-600"}`} />
                <span className="flex-1 text-sm text-gray-200 font-medium">{rule.name}</span>
                <span className="text-xs text-gray-500">
                  {rule.condCategory ?? "any cat."} / {rule.condPriority ?? "any pri."}
                </span>
                <span className="flex items-center gap-1 text-xs text-indigo-400">
                  <ArrowRight className="w-3 h-3" /> {rule.assignToRole ?? rule.assignToUser?.name ?? "—"}
                </span>
                {!isPostLaunch && (
                  <button onClick={() => deleteRoutingRule(rule.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Escalation Chains ──────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-semibold text-white">Escalation Chains</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Multi-step escalation paths that fire when issues remain unresolved past a threshold.
            </p>
          </div>
          {!isPostLaunch && (
            <button
              onClick={() => setShowChainForm(v => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-800/50 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Chain
            </button>
          )}
        </div>

        {showChainForm && (
          <div className="mt-3 p-3 border border-gray-700 rounded-lg space-y-2 bg-gray-800/40">
            <input
              type="text"
              value={newChain.name}
              onChange={e => setNewChain(c => ({ ...c, name: e.target.value }))}
              placeholder="Chain name *"
              className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newChain.triggerPriority}
                onChange={e => setNewChain(c => ({ ...c, triggerPriority: e.target.value }))}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="">Any priority</option>
                {PRIORITY_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={newChain.hoursToFirst}
                  onChange={e => setNewChain(c => ({ ...c, hoursToFirst: Math.max(1, parseInt(e.target.value) || 24) }))}
                  className="w-20 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
                <span className="text-xs text-gray-500">hrs to first step</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowChainForm(false); setNewChain({ name: "", triggerPriority: "", hoursToFirst: 24 }) }}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addEscalationChain}
                disabled={!newChain.name.trim() || saving}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {chains.length === 0 && !showChainForm ? (
          <p className="text-xs text-gray-600 py-3 text-center mt-3">
            No escalation chains. Issues will not auto-escalate unless configured here.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {chains.map(chain => (
              <div key={chain.id} className="border border-gray-800 rounded-lg overflow-hidden">
                <div
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-800/40 transition-colors"
                  onClick={() => setExpandedChain(expandedChain === chain.id ? null : chain.id)}
                >
                  <span className="flex-1 text-sm font-medium text-gray-200">{chain.name}</span>
                  {chain.triggerPriority && (
                    <span className="text-xs text-gray-500">trigger: {chain.triggerPriority}</span>
                  )}
                  <span className="text-xs text-gray-600">
                    {chain.steps.length} step{chain.steps.length !== 1 ? "s" : ""} · first @ {chain.hoursToFirst}h
                  </span>
                  {!isPostLaunch && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteChain(chain.id) }}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {expandedChain === chain.id
                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                    : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                </div>
                {expandedChain === chain.id && (
                  <div className="px-4 py-3 border-t border-gray-800 space-y-2">
                    {chain.steps.map((step, idx) => (
                      <div key={step.id} className="flex items-center gap-3 text-xs">
                        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-indigo-900/40 border border-indigo-800/50 text-indigo-400 font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-gray-400 font-medium">{step.role ?? step.userId ?? "—"}</span>
                        <span className="text-gray-600">via {step.notifyVia}</span>
                        {idx > 0 && (
                          <span className="text-gray-600">+{step.hoursAfterPrevious}h</span>
                        )}
                        {step.label && (
                          <span className="text-gray-500 italic">{step.label}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
