"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Siren, CheckCircle2, AlertTriangle, Plus, X, Search } from "lucide-react"
import { ScopeSelector } from "@/components/communications/scope-selector"
import type { SelectOption } from "@/components/ui/searchable-select"
import type { ScopeLead } from "@/components/communications/scope-selector"
import type { Person } from "@/components/ui/people-picker"

type EmergencyType = "fire" | "power_outage" | "water_leak" | "plant_closure" | "evacuation" | "medical_emergency" | "security_incident" | "other"

interface User { id: string; name: string; role?: string }
interface Ack  { userId: string; acknowledgedAt: Date | string }

interface Broadcast {
  id: string; type: EmergencyType; title: string; body: string
  scopeType: string; resolvedAt?: Date | string | null
  createdAt: Date | string
  createdBy: User; resolvedBy?: User | null
  acknowledgments: Ack[]
  _count: { acknowledgments: number }
}

const EMERGENCY_TYPES: { value: EmergencyType; label: string }[] = [
  { value: "fire",               label: "Fire" },
  { value: "evacuation",         label: "Evacuation" },
  { value: "medical_emergency",  label: "Medical Emergency" },
  { value: "security_incident",  label: "Security Incident" },
  { value: "power_outage",       label: "Power Outage" },
  { value: "water_leak",         label: "Water Leak" },
  { value: "plant_closure",      label: "Plant Closure" },
  { value: "other",              label: "Other" },
]

const SCOPE_OPTIONS = [
  { value: "org",        label: "Entire organization" },
  { value: "location",   label: "Specific location" },
  { value: "department", label: "Specific department" },
  { value: "team",       label: "Specific team" },
  { value: "individual", label: "Individual person" },
] as const

const SCOPE_REQUIRES_ID = new Set(["location", "department", "team", "individual"])

interface CreateFormProps {
  locations:   SelectOption[]
  departments: SelectOption[]
  teamLeads:   ScopeLead[]
  users:       Person[]
  onCreated:   (b: Broadcast) => void
  onCancel:    () => void
}

function CreateForm({ locations, departments, teamLeads, users, onCreated, onCancel }: CreateFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const [form, setForm]     = useState({ type: "fire" as EmergencyType, title: "", body: "", scopeType: "org" })
  const [scopeId, setScopeId] = useState("")

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value as never }))

  function handleScopeTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setForm(p => ({ ...p, scopeType: e.target.value }))
    setScopeId("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (SCOPE_REQUIRES_ID.has(form.scopeType) && !scopeId) {
      const label = SCOPE_OPTIONS.find(o => o.value === form.scopeType)?.label ?? form.scopeType
      setError(`Please select a specific ${label.toLowerCase()} for this broadcast`)
      return
    }

    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/emergency-broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scopeId: SCOPE_REQUIRES_ID.has(form.scopeType) ? scopeId : undefined,
        }),
      })
      const json = await res.json() as { broadcast?: Broadcast; error?: string }
      if (!res.ok) { setError(json.error ?? "Failed"); return }
      onCreated(json.broadcast!)
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Siren className="w-5 h-5 text-red-600" />
          <h2 className="font-bold text-red-700 dark:text-red-300">New Emergency Broadcast</h2>
        </div>
        <button type="button" onClick={onCancel} className="text-red-500 hover:text-red-700">
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-100 dark:bg-red-900/30 rounded-lg p-2">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1">Type *</label>
        <select value={form.type} onChange={set("type")}
          className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {EMERGENCY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1">Scope</label>
        <select value={form.scopeType} onChange={handleScopeTypeChange}
          className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {SCOPE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {SCOPE_REQUIRES_ID.has(form.scopeType) && (
        <div className="pl-3 border-l-2 border-red-300 dark:border-red-700">
          <ScopeSelector
            key={form.scopeType}
            scopeType={form.scopeType}
            scopeId={scopeId}
            onScopeIdChange={setScopeId}
            locations={locations}
            departments={departments}
            teamLeads={teamLeads}
            users={users}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1">Title *</label>
        <input value={form.title} onChange={set("title")} required placeholder="Short description of the emergency"
          className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1">Details *</label>
        <textarea value={form.body} onChange={set("body")} required rows={3}
          placeholder="What happened, what actions to take, where to go..."
          className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      <button type="submit" disabled={saving}
        className="w-full py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
      >
        {saving ? "Broadcasting..." : "Send Emergency Broadcast"}
      </button>
    </form>
  )
}

export function EmergencyPageClient({
  broadcasts: initial,
  userId,
  canCreate,
  canResolve,
  showCreate,
  locations,
  departments,
  teamLeads,
  users,
}: {
  broadcasts:  Broadcast[]
  userId:      string
  canCreate:   boolean
  canResolve:  boolean
  showCreate:  boolean
  locations:   SelectOption[]
  departments: SelectOption[]
  teamLeads:   ScopeLead[]
  users:       Person[]
}) {
  const [broadcasts, setBroadcasts] = useState(initial)
  const [creating, setCreating]     = useState(showCreate)
  const [working, setWorking]       = useState<string | null>(null)
  const [query, setQuery]           = useState("")

  async function acknowledge(id: string) {
    if (working) return
    setWorking(id)
    try {
      const res = await fetch(`/api/emergency-broadcasts/${id}/acknowledge`, { method: "POST" })
      if (res.ok) {
        setBroadcasts(prev => prev.map(b =>
          b.id !== id ? b : {
            ...b,
            acknowledgments: [...b.acknowledgments, { userId, acknowledgedAt: new Date().toISOString() }],
            _count: { ...b._count, acknowledgments: b._count.acknowledgments + 1 },
          }
        ))
      }
    } finally {
      setWorking(null)
    }
  }

  async function resolve(id: string) {
    if (working) return
    if (!confirm("Mark this emergency as resolved?")) return
    setWorking(id)
    try {
      const res = await fetch(`/api/emergency-broadcasts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      })
      if (res.ok) {
        setBroadcasts(prev => prev.map(b =>
          b.id !== id ? b : { ...b, resolvedAt: new Date().toISOString() }
        ))
      }
    } finally {
      setWorking(null)
    }
  }

  const active   = broadcasts.filter(b => !b.resolvedAt)
  const resolved = broadcasts.filter(b =>  b.resolvedAt)

  const filteredResolved = resolved.filter(b =>
    !query ||
    b.title.toLowerCase().includes(query.toLowerCase()) ||
    b.body.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Emergency Broadcasts</h1>
        {canCreate && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Emergency
          </button>
        )}
      </div>

      {creating && (
        <CreateForm
          locations={locations}
          departments={departments}
          teamLeads={teamLeads}
          users={users}
          onCreated={b => { setBroadcasts(p => [b, ...p]); setCreating(false) }}
          onCancel={() => setCreating(false)}
        />
      )}

      {active.length === 0 && !creating ? (
        <div className="text-center py-12 text-gray-400">
          <Siren className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No active emergencies</p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(b => {
            const userAcked = b.acknowledgments.some(a => a.userId === userId)
            return (
              <div key={b.id} className="bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <Siren className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-red-700 dark:text-red-300">{b.title}</span>
                      <span className="text-xs px-2 py-0.5 bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300 rounded-full">
                        {b.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-sm text-red-800 dark:text-red-200 mt-1 whitespace-pre-wrap">{b.body}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-red-600 dark:text-red-400">
                      <span>By {b.createdBy.name}</span>
                      <span>·</span>
                      <span>{new Date(b.createdAt).toLocaleString()}</span>
                      <span>·</span>
                      <span>{b._count.acknowledgments} acknowledged</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {!userAcked ? (
                    <button
                      onClick={() => acknowledge(b.id)}
                      disabled={working === b.id}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      I Acknowledge
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Acknowledged
                    </span>
                  )}
                  {canResolve && (
                    <button
                      onClick={() => resolve(b.id)}
                      disabled={working === b.id}
                      className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Resolved ({resolved.length})
            </h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search resolved..."
                className="pl-8 pr-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
              />
            </div>
          </div>
          <div className="space-y-2">
            {filteredResolved.map(b => (
              <div key={b.id} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 opacity-70">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{b.title}</span>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Resolved {b.resolvedAt ? new Date(b.resolvedAt).toLocaleString() : ""}
                      {b.resolvedBy && ` by ${b.resolvedBy.name}`}
                    </div>
                  </div>
                  <CheckCircle2 className={cn("w-4 h-4 text-green-500")} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
