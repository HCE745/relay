"use client"

import { useState } from "react"
import { Plus, ChevronDown, ChevronRight, Trash2, ToggleLeft, ToggleRight, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { PeoplePicker } from "@/components/ui/people-picker"
import type { Person } from "@/components/ui/people-picker"

interface Step {
  id: string
  stepOrder: number
  label: string | null
  userId: string | null
  role: string | null
  notifyVia: string
  hoursAfterPrevious: number
}

interface Chain {
  id: string
  name: string
  description: string | null
  isActive: boolean
  triggerPriority: string | null
  triggerCategory: string | null
  triggerLocationId: string | null
  triggerDepartmentId: string | null
  hoursToFirst: number
  steps: Step[]
}

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
const CATEGORIES = ["GENERAL", "EQUIPMENT_BREAKDOWN", "SAFETY", "MAINTENANCE", "VEHICLE", "FACILITY"]
const ROLES = ["SUPERVISOR", "MANAGER", "ADMIN", "HR"]

function badge(text: string, color: string) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{text}</span>
  )
}

function ChainCard({ chain, onToggle, onDelete, locations, departments, users }: {
  chain: Chain
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
  locations: { id: string; name: string }[]
  departments: { id: string; name: string }[]
  users: Person[]
}) {
  const [expanded, setExpanded] = useState(false)
  const locName = chain.triggerLocationId ? (locations.find(l => l.id === chain.triggerLocationId)?.name ?? "—") : null
  const deptName = chain.triggerDepartmentId ? (departments.find(d => d.id === chain.triggerDepartmentId)?.name ?? "—") : null

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-colors ${chain.isActive ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
      <div className="flex items-center gap-3 px-5 py-4">
        <button onClick={() => setExpanded(e => !e)} className="text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{chain.name}</span>
            {chain.triggerPriority && badge(chain.triggerPriority, "bg-red-100 text-red-700")}
            {chain.triggerCategory && badge(chain.triggerCategory.replace(/_/g, " "), "bg-blue-100 text-blue-700")}
            {locName && badge(locName, "bg-indigo-100 text-indigo-700")}
            {deptName && badge(deptName, "bg-purple-100 text-purple-700")}
          </div>
          {chain.description && <p className="text-xs text-gray-500 mt-0.5">{chain.description}</p>}
          <p className="text-xs text-gray-400 mt-1">{chain.steps.length} steps · fires after {chain.hoursToFirst}h</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onToggle(chain.id, !chain.isActive)}
            className={`p-1.5 rounded transition-colors ${chain.isActive ? "text-green-500 hover:text-green-700" : "text-gray-300 hover:text-gray-500"}`}
            title={chain.isActive ? "Deactivate" : "Activate"}
          >
            {chain.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
          <button onClick={() => onDelete(chain.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {chain.steps.map((step, i) => (
              <div key={step.id} className="flex items-center gap-2">
                <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <div className="font-medium text-gray-900">
                    {step.label ?? (step.role ?? (users.find(u => u.id === step.userId)?.name ?? "Unknown"))}
                  </div>
                  <div className="text-xs text-gray-400">
                    {i === 0 ? `After ${chain.hoursToFirst}h` : `+${step.hoursAfterPrevious}h`} · {step.notifyVia}
                  </div>
                </div>
                {i < chain.steps.length - 1 && <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Existing escalation policies continue to work. This chain extends escalation behavior.
          </p>
        </div>
      )}
    </div>
  )
}

function NewChainForm({
  onSave, onCancel, locations, departments, users,
}: {
  onSave: (chain: Chain) => void
  onCancel: () => void
  locations: { id: string; name: string }[]
  departments: { id: string; name: string }[]
  users: Person[]
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [triggerPriority, setTriggerPriority] = useState("")
  const [triggerCategory, setTriggerCategory] = useState("")
  const [triggerLocationId, setTriggerLocationId] = useState("")
  const [triggerDepartmentId, setTriggerDepartmentId] = useState("")
  const [hoursToFirst, setHoursToFirst] = useState(24)
  const [steps, setSteps] = useState<Array<{ label: string; userId: string; role: string; hoursAfterPrevious: number }>>([
    { label: "", userId: "", role: "", hoursAfterPrevious: 24 },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function addStep() {
    setSteps(s => [...s, { label: "", userId: "", role: "", hoursAfterPrevious: 24 }])
  }
  function removeStep(i: number) {
    setSteps(s => s.filter((_, idx) => idx !== i))
  }
  function updateStep(i: number, field: string, value: string | number) {
    setSteps(s => s.map((step, idx) => idx === i ? { ...step, [field]: value } : step))
  }

  async function submit() {
    if (!name.trim()) { setError("Name is required"); return }
    if (steps.length === 0) { setError("Add at least one step"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/escalation-chains", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), description, triggerPriority: triggerPriority || null,
          triggerCategory: triggerCategory || null, triggerLocationId: triggerLocationId || null,
          triggerDepartmentId: triggerDepartmentId || null, hoursToFirst,
          steps: steps.map(s => ({
            label: s.label || null, userId: s.userId || null,
            role: s.role || null, hoursAfterPrevious: s.hoursAfterPrevious,
          })),
        }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        setError(j.error ?? "Failed to save"); return
      }
      const j = await res.json() as { chain: Chain }
      onSave(j.chain)
    } finally { setSaving(false) }
  }

  const sel = (value: string, onChange: (v: string) => void, opts: { value: string; label: string }[], placeholder: string) => (
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
      <option value="">{placeholder}</option>
      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-5">New Escalation Chain</h3>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Critical Safety Chain" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Trigger on Priority</label>
            {sel(triggerPriority, setTriggerPriority, PRIORITIES.map(p => ({ value: p, label: p })), "Any priority")}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Trigger on Category</label>
            {sel(triggerCategory, setTriggerCategory, CATEGORIES.map(c => ({ value: c, label: c.replace(/_/g, " ") })), "Any category")}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Trigger on Location</label>
            {sel(triggerLocationId, setTriggerLocationId, locations.map(l => ({ value: l.id, label: l.name })), "Any location")}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Trigger on Department</label>
            {sel(triggerDepartmentId, setTriggerDepartmentId, departments.map(d => ({ value: d.id, label: d.name })), "Any department")}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hours before first escalation</label>
          <input type="number" min={1} value={hoursToFirst} onChange={e => setHoursToFirst(Number(e.target.value))} className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">Escalation Steps</label>
            <button onClick={addStep} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add step
            </button>
          </div>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-2 items-start bg-gray-50 rounded-lg p-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-1">{i + 1}</div>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input value={step.label} onChange={e => updateStep(i, "label", e.target.value)} placeholder="Label (e.g. Plant Manager)" className="px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <select value={step.role} onChange={e => updateStep(i, "role", e.target.value)} className="px-2.5 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">By role…</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <PeoplePicker
                    people={users}
                    value={step.userId}
                    onChange={v => updateStep(i, "userId", v)}
                    placeholder="Or specific user…"
                    emptyLabel="Or specific user…"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 shrink-0">{i === 0 ? "After" : "+"}h:</span>
                    <input type="number" min={1} value={step.hoursAfterPrevious} onChange={e => updateStep(i, "hoursAfterPrevious", Number(e.target.value))} className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                {steps.length > 1 && (
                  <button onClick={() => removeStep(i)} className="text-gray-300 hover:text-red-500 mt-1 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors">
            {saving ? "Saving…" : "Create Chain"}
          </button>
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 border border-gray-300 hover:border-gray-400 text-sm rounded-lg transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export function EscalationChainsClient({
  chains: initialChains,
  locations,
  departments,
  users,
}: {
  chains: Chain[]
  locations: { id: string; name: string }[]
  departments: { id: string; name: string }[]
  users: Person[]
}) {
  const router = useRouter()
  const [chains, setChains] = useState(initialChains)
  const [showForm, setShowForm] = useState(false)

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/escalation-chains/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive }),
    })
    setChains(cs => cs.map(c => c.id === id ? { ...c, isActive } : c))
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this escalation chain?")) return
    await fetch(`/api/escalation-chains/${id}`, { method: "DELETE" })
    setChains(cs => cs.filter(c => c.id !== id))
  }

  function handleSave(chain: Chain) {
    setChains(cs => [chain, ...cs])
    setShowForm(false)
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Note:</strong> Advanced escalation chains extend the existing escalation system. Your existing policies continue to work. Chains fire when an issue matches all specified trigger conditions and remains unresolved for the configured time.
      </div>

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Escalation Chain
        </button>
      )}

      {showForm && (
        <NewChainForm
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          locations={locations}
          departments={departments}
          users={users}
        />
      )}

      {chains.length === 0 && !showForm ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500 text-sm">No escalation chains yet. Create one to define multi-step escalation paths.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chains.map(c => (
            <ChainCard
              key={c.id}
              chain={c}
              onToggle={handleToggle}
              onDelete={handleDelete}
              locations={locations}
              departments={departments}
              users={users}
            />
          ))}
        </div>
      )}
    </div>
  )
}
