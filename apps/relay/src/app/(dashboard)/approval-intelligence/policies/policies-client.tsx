"use client"

import { useState } from "react"
import {
  Plus, Edit2, Trash2, Shield, Star, ChevronDown, ChevronUp,
  FlaskConical, ArrowRight, Check,
} from "lucide-react"
import Link from "next/link"

const CATEGORIES = [
  "GENERAL", "Cleaning Supplies", "Janitorial", "PPE", "Office Supplies",
  "Warehouse Supplies", "Safety Equipment", "Maintenance Parts", "Other",
]

const APPROVAL_PATHS = [
  { value: "AUTO_APPROVE",        label: "Auto-Approve" },
  { value: "SUPERVISOR",          label: "Requires Supervisor" },
  { value: "DEPARTMENT_MANAGER",  label: "Requires Department Manager" },
  { value: "PURCHASING",          label: "Requires Purchasing" },
]

const inputCls  = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
const selectCls = `${inputCls} bg-white`

interface Dept    { id: string; name: string }
interface Location { id: string; name: string }
interface Vendor  { id: string; name: string }
interface CatalogItem { id: string; name: string; category: string; estimatedCost: number | null }

interface PolicyRule {
  id?: string; priority: number
  minAmount: number | null; maxAmount: number | null
  category: string | null; departmentId: string | null
  locationId: string | null; vendorId: string | null
  approvalPath: string; escalateAfterHours: number | null
}

interface Policy {
  id: string; name: string; description: string | null
  isDefault: boolean; escalateAfterHours: number
  createdAt: string; rules: PolicyRule[]
  catalogItemCount: number; requestCount: number
}

interface Props {
  initialPolicies: Policy[]
  departments: Dept[]
  locations: Location[]
  vendors: Vendor[]
  catalogItems: CatalogItem[]
}

function RuleRow({
  rule, departments, locations, vendors, index,
  onChange, onDelete,
}: {
  rule: PolicyRule
  departments: Dept[]; locations: Location[]; vendors: Vendor[]
  index: number
  onChange: (r: PolicyRule) => void
  onDelete: () => void
}) {
  const f = (field: keyof PolicyRule, val: unknown) => onChange({ ...rule, [field]: val })
  const mini = "px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rule #{index + 1}</span>
        <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">Remove</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Min Amount ($)</label>
          <input type="number" min="0" step="0.01" value={rule.minAmount ?? ""} onChange={e => f("minAmount", e.target.value ? Number(e.target.value) : null)} placeholder="None" className={mini} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Max Amount ($)</label>
          <input type="number" min="0" step="0.01" value={rule.maxAmount ?? ""} onChange={e => f("maxAmount", e.target.value ? Number(e.target.value) : null)} placeholder="None" className={mini} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <select value={rule.category ?? ""} onChange={e => f("category", e.target.value || null)} className={mini}>
            <option value="">Any</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Dept</label>
          <select value={rule.departmentId ?? ""} onChange={e => f("departmentId", e.target.value || null)} className={mini}>
            <option value="">Any</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Location</label>
          <select value={rule.locationId ?? ""} onChange={e => f("locationId", e.target.value || null)} className={mini}>
            <option value="">Any</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Vendor</label>
          <select value={rule.vendorId ?? ""} onChange={e => f("vendorId", e.target.value || null)} className={mini}>
            <option value="">Any</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Approval Path *</label>
          <select value={rule.approvalPath} onChange={e => f("approvalPath", e.target.value)} className={mini}>
            {APPROVAL_PATHS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Escalate After (hrs)</label>
          <input type="number" min="1" value={rule.escalateAfterHours ?? ""} onChange={e => f("escalateAfterHours", e.target.value ? Number(e.target.value) : null)} placeholder="Policy default" className={mini} />
        </div>
      </div>
    </div>
  )
}

function PolicyModal({
  policy, departments, locations, vendors,
  onClose, onSaved,
}: {
  policy: Policy | null
  departments: Dept[]; locations: Location[]; vendors: Vendor[]
  onClose: () => void
  onSaved: (p: Policy) => void
}) {
  const [name, setName]             = useState(policy?.name ?? "")
  const [description, setDesc]      = useState(policy?.description ?? "")
  const [isDefault, setIsDefault]   = useState(policy?.isDefault ?? false)
  const [escalate, setEscalate]     = useState(policy?.escalateAfterHours?.toString() ?? "24")
  const [rules, setRules]           = useState<PolicyRule[]>(policy?.rules ?? [])
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState("")

  function addRule() {
    setRules(prev => [...prev, {
      priority: (prev.length + 1) * 10,
      minAmount: null, maxAmount: null, category: null,
      departmentId: null, locationId: null, vendorId: null,
      approvalPath: "AUTO_APPROVE", escalateAfterHours: null,
    }])
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    try {
      const payload = {
        name, description: description || null, isDefault,
        escalateAfterHours: Number(escalate) || 24,
        rules: rules.map((r, i) => ({ ...r, priority: (i + 1) * 10 })),
      }
      const res = await fetch(policy ? `/api/approval-policies/${policy.id}` : "/api/approval-policies", {
        method: policy ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? "Save failed"); return }
      const saved = await res.json() as Policy & { _count?: { catalogItems: number; purchaseRequests: number } }
      onSaved({
        ...saved,
        catalogItemCount: saved._count?.catalogItems ?? policy?.catalogItemCount ?? 0,
        requestCount:     saved._count?.purchaseRequests ?? policy?.requestCount ?? 0,
      })
    } catch { setError("Network error") } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{policy ? "Edit Policy" : "New Approval Policy"}</h2>
          <p className="text-sm text-gray-500 mt-1">Define rules that determine how purchase requests are approved.</p>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Policy Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Purchasing Policy" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input value={description} onChange={e => setDesc(e.target.value)} placeholder="Brief description" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Default Escalation (hours)</label>
              <input type="number" min="1" value={escalate} onChange={e => setEscalate(e.target.value)} className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">Auto-escalate if approver doesn&apos;t act within this time</p>
            </div>
            <div className="flex items-center gap-3 pt-4">
              <input type="checkbox" id="isDefault" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="w-4 h-4 text-indigo-600" />
              <label htmlFor="isDefault" className="text-sm text-gray-700">Set as default policy for all requests</label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Rules</h3>
                <p className="text-xs text-gray-400">Rules are evaluated in order — first match wins. More specific rules should have lower priority numbers.</p>
              </div>
              <button onClick={addRule} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add Rule
              </button>
            </div>
            {rules.length === 0 && (
              <div className="text-center py-6 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                No rules yet. Add rules to define approval paths for different conditions.
              </div>
            )}
            <div className="space-y-3">
              {rules.map((rule, i) => (
                <RuleRow
                  key={i} rule={rule} index={i}
                  departments={departments} locations={locations} vendors={vendors}
                  onChange={updated => setRules(prev => { const next = [...prev]; next[i] = updated; return next })}
                  onDelete={() => setRules(prev => prev.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300">
            {saving ? "Saving…" : policy ? "Save Changes" : "Create Policy"}
          </button>
        </div>
      </div>
    </div>
  )
}

function SimulatorPanel({ catalogItems }: { catalogItems: CatalogItem[] }) {
  const [amount, setAmount]       = useState("")
  const [category, setCategory]   = useState("")
  const [catalogId, setCatalogId] = useState("")
  const [result, setResult]       = useState<SimResult | null>(null)
  const [loading, setLoading]     = useState(false)

  interface SimResult {
    approvalPath: string; policyName?: string; reason: string
    matchedConditions?: string[]; expectedOutcome?: string; source: string
  }

  async function simulate() {
    setLoading(true)
    try {
      const res = await fetch("/api/approval-policies/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: amount ? Number(amount) : null,
          category: category || undefined,
          catalogItemId: catalogId || undefined,
        }),
      })
      const data = await res.json() as SimResult
      setResult(data)
    } finally { setLoading(false) }
  }

  const pathColor: Record<string, string> = {
    AUTO_APPROVE:       "bg-green-50 border-green-200 text-green-800",
    SUPERVISOR:         "bg-blue-50 border-blue-200 text-blue-800",
    DEPARTMENT_MANAGER: "bg-amber-50 border-amber-200 text-amber-800",
    PURCHASING:         "bg-purple-50 border-purple-200 text-purple-800",
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <FlaskConical className="w-5 h-5 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-900">Policy Simulator</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">Test what would happen if you submitted a specific request.</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 150" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls}>
            <option value="">— Any —</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Catalog Item (optional)</label>
          <select value={catalogId} onChange={e => setCatalogId(e.target.value)} className={selectCls}>
            <option value="">— No specific item —</option>
            {catalogItems.map(i => <option key={i.id} value={i.id}>{i.name}{i.estimatedCost ? ` ($${i.estimatedCost})` : ""}</option>)}
          </select>
        </div>
      </div>
      <button onClick={simulate} disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:bg-indigo-300">
        {loading ? "Simulating…" : <><FlaskConical className="w-4 h-4" /> Simulate</>}
      </button>

      {result && (
        <div className={`mt-4 border rounded-xl p-4 ${pathColor[result.approvalPath] ?? "bg-gray-50 border-gray-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-semibold">
              {APPROVAL_PATHS.find(p => p.value === result.approvalPath)?.label ?? result.approvalPath}
            </span>
          </div>
          <p className="text-xs">{result.reason}</p>
          {result.matchedConditions && result.matchedConditions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {result.matchedConditions.map(c => (
                <span key={c} className="inline-flex items-center gap-1 text-xs bg-white/60 border border-current/20 rounded px-1.5 py-0.5">
                  <Check className="w-2.5 h-2.5" /> {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PoliciesClient({ initialPolicies, departments, locations, vendors, catalogItems }: Props) {
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies)
  const [editing, setEditing]   = useState<Policy | null | "new">(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  function handleSaved(saved: Policy) {
    setPolicies(prev => {
      const idx = prev.findIndex(p => p.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        // If new default, clear old defaults
        if (saved.isDefault) next.forEach((p, i) => { if (i !== idx) next[i] = { ...p, isDefault: false } })
        next[idx] = saved
        return next
      }
      if (saved.isDefault) return [saved, ...prev.map(p => ({ ...p, isDefault: false }))]
      return [saved, ...prev]
    })
    setEditing(null)
  }

  async function handleDelete(policy: Policy) {
    if (!confirm(`Delete policy "${policy.name}"? Catalog items using it will fall back to the default policy.`)) return
    const res = await fetch(`/api/approval-policies/${policy.id}`, { method: "DELETE" })
    if (res.ok) setPolicies(prev => prev.filter(p => p.id !== policy.id))
  }

  const pathBadge: Record<string, string> = {
    AUTO_APPROVE:       "bg-green-100 text-green-700",
    SUPERVISOR:         "bg-blue-100 text-blue-700",
    DEPARTMENT_MANAGER: "bg-amber-100 text-amber-700",
    PURCHASING:         "bg-purple-100 text-purple-700",
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/approval-intelligence" className="hover:text-gray-700">Approval Intelligence</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Approval Policies</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Policy list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">{policies.length} {policies.length === 1 ? "Policy" : "Policies"}</h2>
            <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
              <Plus className="w-4 h-4" /> New Policy
            </button>
          </div>

          {policies.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-gray-400">
              <Shield className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium">No policies yet</p>
              <p className="text-xs mt-1">Create your first approval policy to define how requests are routed.</p>
            </div>
          )}

          {policies.map(policy => (
            <div key={policy.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900">{policy.name}</h3>
                      {policy.isDefault && (
                        <span className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium">
                          <Star className="w-3 h-3" /> Default
                        </span>
                      )}
                    </div>
                    {policy.description && <p className="text-xs text-gray-500 mt-0.5">{policy.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span>{policy.rules.length} rule{policy.rules.length !== 1 ? "s" : ""}</span>
                      <span>·</span>
                      <span>{policy.catalogItemCount} catalog item{policy.catalogItemCount !== 1 ? "s" : ""}</span>
                      <span>·</span>
                      <span>Escalate after {policy.escalateAfterHours}h</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setExpanded(expanded === policy.id ? null : policy.id)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                      {expanded === policy.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setEditing(policy)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(policy)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {expanded === policy.id && policy.rules.length > 0 && (
                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                  <div className="space-y-2">
                    {policy.rules.map((rule, i) => (
                      <div key={rule.id ?? i} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400 w-4 flex-shrink-0">#{i + 1}</span>
                        <div className="flex flex-wrap gap-1 flex-1">
                          {rule.minAmount != null || rule.maxAmount != null ? (
                            <span className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                              {rule.minAmount != null && rule.maxAmount != null
                                ? `$${rule.minAmount}–$${rule.maxAmount}`
                                : rule.minAmount != null ? `≥$${rule.minAmount}` : `≤$${rule.maxAmount}`}
                            </span>
                          ) : null}
                          {rule.category && <span className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{rule.category}</span>}
                          {!rule.minAmount && !rule.maxAmount && !rule.category && !rule.departmentId && !rule.locationId && !rule.vendorId && (
                            <span className="text-gray-400 italic">Default rule (matches everything)</span>
                          )}
                        </div>
                        <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                        <span className={`rounded-full px-2 py-0.5 font-medium ${pathBadge[rule.approvalPath] ?? "bg-gray-100 text-gray-600"}`}>
                          {APPROVAL_PATHS.find(p => p.value === rule.approvalPath)?.label ?? rule.approvalPath}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Simulator */}
        <div className="lg:col-span-1">
          <SimulatorPanel catalogItems={catalogItems} />
        </div>
      </div>

      {editing !== null && (
        <PolicyModal
          policy={editing === "new" ? null : editing as Policy}
          departments={departments}
          locations={locations}
          vendors={vendors}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
