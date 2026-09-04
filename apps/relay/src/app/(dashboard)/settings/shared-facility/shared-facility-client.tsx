"use client"

import { useState } from "react"
import { Plus, Building2, Trash2, CheckCircle, Clock, XCircle, ChevronDown, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"

interface Rule {
  id: string
  issueCategories: string[]
  routingOrgId: string
  routingDeptId: string | null
}

interface Relationship {
  id: string
  orgIdA: string
  orgAName: string
  orgIdB: string | null
  orgBName: string
  relationshipType: string
  status: string
  inviteEmail: string | null
  rules: Rule[]
}

const RELATIONSHIP_TYPES = [
  { value: "facility_owner",    label: "Facility Owner" },
  { value: "facility_operator", label: "Facility Operator" },
  { value: "tenant",            label: "Tenant" },
  { value: "contractor",        label: "Contractor" },
  { value: "partner",           label: "Partner" },
  { value: "parent",            label: "Parent Company" },
  { value: "subsidiary",        label: "Subsidiary" },
  { value: "vendor",            label: "Vendor" },
]

const CATEGORIES = ["GENERAL", "EQUIPMENT_BREAKDOWN", "SAFETY", "MAINTENANCE", "VEHICLE", "FACILITY"]

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    active:  "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    inactive:"bg-gray-100 text-gray-500",
  }
  const icons: Record<string, React.ReactNode> = {
    active:  <CheckCircle className="w-3 h-3" />,
    pending: <Clock className="w-3 h-3" />,
    inactive:<XCircle className="w-3 h-3" />,
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] ?? colors.inactive}`}>
      {icons[status]} {status}
    </span>
  )
}

function RelationshipCard({
  rel, orgId, departments, onDelete, onAddRule, onDeleteRule,
}: {
  rel: Relationship
  orgId: string
  departments: { id: string; name: string }[]
  onDelete: (id: string) => void
  onAddRule: (relId: string, categories: string[], routingOrgId: string, deptId?: string) => Promise<void>
  onDeleteRule: (ruleId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [ruleCategories, setRuleCategories] = useState<string[]>([])
  const [routingOrgId, setRoutingOrgId] = useState(rel.orgIdB ?? "")
  const [routingDeptId, setRoutingDeptId] = useState("")
  const [savingRule, setSavingRule] = useState(false)

  const isOrgA = rel.orgIdA === orgId
  const partnerName = isOrgA ? rel.orgBName : rel.orgAName
  const partnerOrgId = isOrgA ? rel.orgIdB : rel.orgIdA

  async function saveRule() {
    if (ruleCategories.length === 0 || !routingOrgId) return
    setSavingRule(true)
    await onAddRule(rel.id, ruleCategories, routingOrgId, routingDeptId || undefined)
    setShowRuleForm(false); setRuleCategories([]); setRoutingOrgId(rel.orgIdB ?? "")
    setSavingRule(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <button onClick={() => setExpanded(e => !e)} className="text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{partnerName}</span>
            {statusBadge(rel.status)}
            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600 capitalize">
              {rel.relationshipType.replace(/_/g, " ")}
            </span>
          </div>
          {rel.inviteEmail && rel.status === "pending" && (
            <p className="text-xs text-gray-400 mt-0.5">Invited: {rel.inviteEmail}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">{rel.rules.length} routing rule{rel.rules.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => onDelete(rel.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
          {rel.status !== "active" ? (
            <p className="text-sm text-gray-500">Routing rules can be configured once the relationship is active.</p>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Routing Rules</p>
                {rel.rules.length === 0 ? (
                  <p className="text-sm text-gray-400">No routing rules yet. Add a rule to define which issue categories route to the partner organization.</p>
                ) : (
                  <div className="space-y-2">
                    {rel.rules.map(rule => (
                      <div key={rule.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1">
                            {rule.issueCategories.map(c => (
                              <span key={c} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{c.replace(/_/g, " ")}</span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Routes to: {rule.routingOrgId === orgId ? "Your organization" : partnerName}
                            {rule.routingDeptId && ` (dept: ${departments.find(d => d.id === rule.routingDeptId)?.name ?? rule.routingDeptId})`}
                          </p>
                        </div>
                        <button onClick={() => onDeleteRule(rule.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {showRuleForm ? (
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-medium text-gray-600">Categories to route</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(c => (
                      <button key={c} onClick={() => setRuleCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${ruleCategories.includes(c) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"}`}>
                        {c.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Route issues to</p>
                    <select value={routingOrgId} onChange={e => setRoutingOrgId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select organization…</option>
                      <option value={orgId}>Your organization</option>
                      {partnerOrgId && <option value={partnerOrgId}>{partnerName}</option>}
                    </select>
                  </div>

                  {departments.length > 0 && routingOrgId === orgId && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Department (optional)</p>
                      <select value={routingDeptId} onChange={e => setRoutingDeptId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Any department</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={saveRule} disabled={savingRule || ruleCategories.length === 0 || !routingOrgId} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors">
                      {savingRule ? "Saving…" : "Add Rule"}
                    </button>
                    <button onClick={() => setShowRuleForm(false)} className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowRuleForm(true)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  <Plus className="w-3.5 h-3.5" /> Add routing rule
                </button>
              )}

              <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                <p className="text-xs text-indigo-700">
                  <strong>Visibility:</strong> {partnerName} can only see issues routed to them — never your internal workspace.
                  Full audit trails are maintained for all cross-org actions.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function SharedFacilityClient({
  orgId,
  orgName,
  relationships: initialRels,
  departments,
}: {
  orgId: string
  orgName: string
  relationships: Relationship[]
  departments: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [rels, setRels] = useState(initialRels)
  const [showForm, setShowForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [orgBName, setOrgBName] = useState("")
  const [relationshipType, setRelationshipType] = useState("facility_operator")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function invite() {
    if (!inviteEmail.trim() || !orgBName.trim()) { setError("All fields required"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/shared-facility/relationships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteEmail, orgBName, relationshipType }),
      })
      if (!res.ok) { const j = await res.json() as { error?: string }; setError(j.error ?? "Failed"); return }
      router.refresh()
      setShowForm(false); setInviteEmail(""); setOrgBName("")
    } finally { setSaving(false) }
  }

  async function deleteRel(id: string) {
    if (!confirm("Remove this relationship? All routing rules will be deleted.")) return
    await fetch(`/api/shared-facility/relationships/${id}`, { method: "DELETE" })
    setRels(rs => rs.filter(r => r.id !== id))
  }

  async function addRule(relId: string, categories: string[], routingOrgId: string, deptId?: string) {
    const res = await fetch("/api/shared-facility/rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ relationshipId: relId, issueCategories: categories, routingOrgId, routingDeptId: deptId }),
    })
    if (!res.ok) return
    const j = await res.json() as { rule: Rule }
    setRels(rs => rs.map(r => r.id === relId ? { ...r, rules: [...r.rules, j.rule] } : r))
  }

  async function deleteRule(ruleId: string) {
    await fetch(`/api/shared-facility/rules?id=${ruleId}`, { method: "DELETE" })
    setRels(rs => rs.map(r => ({ ...r, rules: r.rules.filter(rule => rule.id !== ruleId) })))
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-2">About Shared Facility</h2>
        <p className="text-sm text-gray-600 mb-3">
          When two or more organizations share the same facility, issues can be routed between them automatically.
          For example: an employee from one company can submit an issue that routes to the facility owner&apos;s team.
        </p>
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm text-indigo-800">
          <strong>Example:</strong> ABC Manufacturing owns the building. XYZ Recycling operates in the back.
          When XYZ sees a roof leak, they submit an issue — it routes automatically to ABC&apos;s Facilities department.
        </div>
      </div>

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Invite Partner Organization
        </button>
      )}

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Invite Partner Organization</h3>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partner organization name</label>
              <input value={orgBName} onChange={e => setOrgBName(e.target.value)} placeholder="e.g. XYZ Recycling" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin email at partner organization</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="admin@partner.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Relationship type</label>
              <select value={relationshipType} onChange={e => setRelationshipType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {RELATIONSHIP_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={invite} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? "Sending invite…" : "Send Invitation"}
              </button>
              <button onClick={() => { setShowForm(false); setError("") }} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {rels.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No shared facility relationships yet. Invite a partner organization to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rels.map(r => (
            <RelationshipCard
              key={r.id}
              rel={r}
              orgId={orgId}
              departments={departments}
              onDelete={deleteRel}
              onAddRule={addRule}
              onDeleteRule={deleteRule}
            />
          ))}
        </div>
      )}
    </div>
  )
}
