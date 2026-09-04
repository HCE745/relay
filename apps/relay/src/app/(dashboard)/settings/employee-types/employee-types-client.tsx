"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Pencil, Users, X, Check, ChevronDown, ChevronUp } from "lucide-react"
import { CONFIGURABLE_PAGES, CONFIGURABLE_ACTIONS } from "@/lib/page-access"
import type { PageKey, ActionKey } from "@/lib/page-access"
import type { EmployeeTypePreset } from "@/lib/employee-type-presets"

interface EmployeeType {
  id: string
  name: string
  description: string | null
  baseRole: string
  pageAccess: PageKey[]
  actions: ActionKey[]
  canInvite: boolean
  canChangeEmail: boolean
  isPreset: boolean
  presetKey: string | null
  _count: { users: number }
}

interface Props {
  initialTypes: EmployeeType[]
  presets: EmployeeTypePreset[]
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-800",
    MANAGER: "bg-blue-100 text-blue-800",
    SUPERVISOR: "bg-indigo-100 text-indigo-800",
    HR: "bg-pink-100 text-pink-800",
    EMPLOYEE: "bg-gray-100 text-gray-700",
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[role] ?? "bg-gray-100 text-gray-700"}`}>
      {role}
    </span>
  )
}

function TypeForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<EmployeeType>
  onSave: (data: Omit<EmployeeType, "id" | "_count" | "isPreset" | "presetKey">) => void
  onCancel: () => void
  saving: boolean
}) {
  const [name, setName] = useState(initial.name ?? "")
  const [description, setDescription] = useState(initial.description ?? "")
  const [baseRole] = useState(initial.baseRole ?? "EMPLOYEE")
  const [pageAccess, setPageAccess] = useState<Set<PageKey>>(new Set(initial.pageAccess ?? ["my-submissions"]))
  const [actions, setActions] = useState<Set<ActionKey>>(new Set(initial.actions ?? []))
  const [canInvite, setCanInvite] = useState(initial.canInvite ?? false)
  const [canChangeEmail, setCanChangeEmail] = useState(initial.canChangeEmail ?? true)

  function togglePage(key: PageKey) {
    setPageAccess(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleAction(key: ActionKey) {
    setActions(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Field Technician"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional description"
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1.5">
          Page Access
          <span className="ml-1.5 text-blue-600">{pageAccess.size} selected</span>
        </p>
        <p className="text-xs text-gray-400 mb-2">Which pages this role can navigate to.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {CONFIGURABLE_PAGES.map(p => (
            <label key={p.key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={pageAccess.has(p.key)}
                onChange={() => togglePage(p.key)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1.5">
          Actions
          <span className="ml-1.5 text-blue-600">{actions.size} selected</span>
        </p>
        <p className="text-xs text-gray-400 mb-2">What this role can do within pages they can access.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {CONFIGURABLE_ACTIONS.map(a => (
            <label key={a.key} className="flex items-start gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={actions.has(a.key)}
                onChange={() => toggleAction(a.key)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5 shrink-0"
              />
              <div>
                <span className="text-sm text-gray-700">{a.label}</span>
                <p className="text-xs text-gray-400 leading-tight">{a.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={canInvite}
            onChange={e => setCanInvite(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Can invite users
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={canChangeEmail}
            onChange={e => setCanChangeEmail(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Can change email
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={() => onSave({
            name,
            description: description || null,
            baseRole,
            pageAccess: Array.from(pageAccess),
            actions: Array.from(actions),
            canInvite,
            canChangeEmail,
          })}
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  )
}

export function EmployeeTypesClient({ initialTypes, presets }: Props) {
  const router = useRouter()
  const [types, setTypes] = useState(initialTypes)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showPresets, setShowPresets] = useState(false)

  async function handleCreate(data: Omit<EmployeeType, "id" | "_count" | "isPreset" | "presetKey">) {
    setSaving(true); setError("")
    const res = await fetch("/api/employee-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    setSaving(false)
    if (res.ok) {
      const t = await res.json()
      setTypes(prev => [...prev, { ...t, _count: { users: 0 } }])
      setCreating(false)
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error ?? "Failed")
    }
  }

  async function handleEdit(id: string, data: Omit<EmployeeType, "id" | "_count" | "isPreset" | "presetKey">) {
    setSaving(true); setError("")
    const res = await fetch(`/api/employee-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setTypes(prev => prev.map(t => t.id === id ? { ...updated, _count: t._count } : t))
      setEditingId(null)
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error ?? "Failed")
    }
  }

  async function handleDelete(id: string) {
    setSaving(true); setError("")
    const res = await fetch(`/api/employee-types/${id}`, { method: "DELETE" })
    setSaving(false)
    if (res.ok) {
      setTypes(prev => prev.filter(t => t.id !== id))
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error ?? "Failed to delete")
    }
  }

  async function addFromPreset(preset: EmployeeTypePreset) {
    setSaving(true); setError("")
    const res = await fetch("/api/employee-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: preset.name,
        description: preset.description,
        baseRole: preset.baseRole,
        pageAccess: preset.pageAccess,
        actions: preset.actions ?? [],
        canInvite: preset.canInvite,
        canChangeEmail: preset.canChangeEmail,
        presetKey: preset.key,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const t = await res.json()
      setTypes(prev => [...prev, { ...t, _count: { users: 0 } }])
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error ?? "Failed")
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-900">Employee Types</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPresets(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Presets
              {showPresets ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => { setCreating(true); setEditingId(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5" />
              New Type
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Define employee types with configured page access and actions. Assign them when inviting users to automatically apply the right permissions.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Preset picker */}
        {showPresets && (
          <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-xs font-medium text-blue-700 mb-3">Add from preset — you can customize it after adding.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map(p => {
                const alreadyAdded = types.some(t => t.presetKey === p.key)
                return (
                  <button
                    key={p.key}
                    onClick={() => !alreadyAdded && addFromPreset(p)}
                    disabled={alreadyAdded || saving}
                    className="text-left px-3 py-2.5 rounded-lg border border-blue-200 bg-white hover:border-blue-400 disabled:opacity-50 disabled:cursor-default transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{p.name}</span>
                      {alreadyAdded
                        ? <span className="text-xs text-green-600 font-medium">Added</span>
                        : <Plus className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                    <RoleBadge role={p.baseRole} />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Create form */}
        {creating && (
          <div className="mb-5 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">New Employee Type</h3>
            <TypeForm
              initial={{}}
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
              saving={saving}
            />
          </div>
        )}

        {/* List */}
        {types.length === 0 && !creating ? (
          <div className="text-center py-10 text-sm text-gray-400">
            No employee types yet. Add from presets or create your own.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {types.map(t => (
              <div key={t.id} className="py-4">
                {editingId === t.id ? (
                  <TypeForm
                    initial={t}
                    onSave={data => handleEdit(t.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">{t.name}</span>
                        <RoleBadge role={t.baseRole} />
                        {t.isPreset && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">preset</span>
                        )}
                        {t._count.users > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Users className="w-3 h-3" />
                            {t._count.users}
                          </span>
                        )}
                      </div>
                      {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                      <div className="flex flex-wrap gap-3 mt-1">
                        <p className="text-xs text-gray-400">
                          <span className="font-medium text-gray-500">Pages:</span>{" "}
                          {(t.pageAccess as PageKey[]).length} configured
                        </p>
                        <p className="text-xs text-gray-400">
                          <span className="font-medium text-gray-500">Actions:</span>{" "}
                          {((t.actions ?? []) as ActionKey[]).length} configured
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingId(t.id); setCreating(false) }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                        title="Edit Access & Functions"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={t._count.users > 0 || saving}
                        title={t._count.users > 0 ? "Cannot delete — employees are assigned" : "Delete"}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
