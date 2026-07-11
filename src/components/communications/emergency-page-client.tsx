"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Siren, CheckCircle2, AlertTriangle, Plus, X } from "lucide-react"

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

function CreateForm({ onCreated, onCancel }: { onCreated: (b: Broadcast) => void; onCancel: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const [form, setForm]     = useState({ type: "fire" as EmergencyType, title: "", body: "" })

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value as never }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/emergency-broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
}: {
  broadcasts: Broadcast[]
  userId: string
  canCreate: boolean
  canResolve: boolean
  showCreate: boolean
}) {
  const [broadcasts, setBroadcasts] = useState(initial)
  const [creating, setCreating]     = useState(showCreate)
  const [working, setWorking]       = useState<string | null>(null)

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
                        {b.type.replace("_", " ")}
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
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Resolved</h2>
          <div className="space-y-2">
            {resolved.map(b => (
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
