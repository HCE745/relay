"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, GitBranch, ChevronRight, X } from "lucide-react"
import { ISSUE_CATEGORY, ISSUE_PRIORITY, ASSET_TYPE, USER_ROLE } from "@/lib/constants"
import { PeoplePicker } from "@/components/ui/people-picker"
import type { Person } from "@/components/ui/people-picker"

interface Location { id: string; name: string }
interface Department { id: string; name: string }
type UserOption = Person

interface RoutingRule {
  id: string
  name: string
  description: string | null
  isActive: boolean
  condCategory: string | null
  condLocationId: string | null
  condDeptId: string | null
  condAssetType: string | null
  condPriority: string | null
  assignToUserId: string | null
  assignToRole: string | null
  condLocation: { id: string; name: string } | null
  condDept: { id: string; name: string } | null
  assignToUser: { id: string; name: string } | null
}

interface Props {
  rules: RoutingRule[]
  locations: Location[]
  departments: Department[]
  users: UserOption[]
}

const EMPTY_FORM = {
  name: "",
  description: "",
  isActive: true,
  condCategory: "",
  condLocationId: "",
  condDeptId: "",
  condAssetType: "",
  condPriority: "",
  assignToUserId: "",
  assignToRole: "",
}

function conditionSummary(rule: RoutingRule): string {
  const parts: string[] = []
  if (rule.condCategory) parts.push(ISSUE_CATEGORY[rule.condCategory as keyof typeof ISSUE_CATEGORY] ?? rule.condCategory)
  if (rule.condPriority) parts.push(ISSUE_PRIORITY[rule.condPriority as keyof typeof ISSUE_PRIORITY] ?? rule.condPriority)
  if (rule.condLocation) parts.push(rule.condLocation.name)
  if (rule.condDept) parts.push(rule.condDept.name)
  if (rule.condAssetType) parts.push(ASSET_TYPE[rule.condAssetType as keyof typeof ASSET_TYPE] ?? rule.condAssetType)
  return parts.length > 0 ? parts.join(" · ") : "Catch-all (any issue)"
}

function targetSummary(rule: RoutingRule): string {
  if (rule.assignToUser) return `→ ${rule.assignToUser.name}`
  if (rule.assignToRole) return `→ Any ${USER_ROLE[rule.assignToRole as keyof typeof USER_ROLE] ?? rule.assignToRole}`
  return "→ Unassigned"
}

export function RoutingRulesManager({ rules: initialRules, locations, departments, users }: Props) {
  const router = useRouter()
  const [rules, setRules] = useState(initialRules)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(rule: RoutingRule) {
    setEditingId(rule.id)
    setForm({
      name: rule.name,
      description: rule.description ?? "",
      isActive: rule.isActive,
      condCategory: rule.condCategory ?? "",
      condLocationId: rule.condLocationId ?? "",
      condDeptId: rule.condDeptId ?? "",
      condAssetType: rule.condAssetType ?? "",
      condPriority: rule.condPriority ?? "",
      assignToUserId: rule.assignToUserId ?? "",
      assignToRole: rule.assignToRole ?? "",
    })
    setError(null)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    setError(null)
  }

  function set(key: keyof typeof EMPTY_FORM, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }))
    // Mutual exclusion: if picking a user, clear role and vice-versa
    if (key === "assignToUserId" && value) setForm(f => ({ ...f, assignToUserId: value as string, assignToRole: "" }))
    if (key === "assignToRole" && value) setForm(f => ({ ...f, assignToRole: value as string, assignToUserId: "" }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return }
    if (!form.assignToUserId && !form.assignToRole) { setError("Choose a target user or role"); return }
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name,
      description: form.description || null,
      isActive: form.isActive,
      condCategory: form.condCategory || null,
      condLocationId: form.condLocationId || null,
      condDeptId: form.condDeptId || null,
      condAssetType: form.condAssetType || null,
      condPriority: form.condPriority || null,
      assignToUserId: form.assignToUserId || null,
      assignToRole: form.assignToRole || null,
    }
    const url = editingId ? `/api/routing-rules/${editingId}` : "/api/routing-rules"
    const method = editingId ? "PUT" : "POST"
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save"); return }
    closeDialog()
    router.refresh()
    // Optimistic update by re-fetching
    const listRes = await fetch("/api/routing-rules")
    if (listRes.ok) setRules(await listRes.json())
  }

  async function handleDelete(id: string) {
    await fetch(`/api/routing-rules/${id}`, { method: "DELETE" })
    setDeleteConfirm(null)
    setRules(prev => prev.filter(r => r.id !== id))
  }

  async function handleToggle(rule: RoutingRule) {
    const res = await fetch(`/api/routing-rules/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    })
    if (res.ok) {
      const updated = await res.json()
      setRules(prev => prev.map(r => r.id === updated.id ? updated : r))
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Routing Rules</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Rules are matched by specificity — the most conditions a rule sets, the higher priority it gets.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <GitBranch className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No routing rules yet.</p>
          <p className="text-xs text-gray-400 mt-1">Add a rule to start automatically assigning issues.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${rule.isActive ? "bg-white border-gray-200" : "bg-gray-50 border-gray-200 opacity-60"}`}
            >
              {/* Toggle */}
              <button onClick={() => handleToggle(rule)} className="text-gray-400 hover:text-blue-600 shrink-0">
                {rule.isActive
                  ? <ToggleRight className="w-5 h-5 text-blue-600" />
                  : <ToggleLeft className="w-5 h-5" />}
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">{rule.name}</span>
                  {!rule.isActive && (
                    <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded">Disabled</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                  <span>{conditionSummary(rule)}</span>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  <span className="text-blue-600 font-medium">{targetSummary(rule)}</span>
                </div>
                {rule.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{rule.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(rule)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteConfirm(rule.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm inline */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Rule</h3>
            <p className="text-sm text-gray-500 mb-4">
              This routing rule will be permanently deleted and can&apos;t be recovered.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-3 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingId ? "Edit Rule" : "New Routing Rule"}</h3>
              <button onClick={closeDialog} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Rule Name *</label>
                <input
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  placeholder="e.g. Safety issues → Safety Manager"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <input
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Conditions */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Match Conditions <span className="font-normal text-gray-400">(leave blank to match any)</span></p>
                <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Category</label>
                      <select
                        value={form.condCategory}
                        onChange={e => set("condCategory", e.target.value)}
                        className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Any category</option>
                        {Object.entries(ISSUE_CATEGORY).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Priority</label>
                      <select
                        value={form.condPriority}
                        onChange={e => set("condPriority", e.target.value)}
                        className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Any priority</option>
                        {Object.entries(ISSUE_PRIORITY).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Location</label>
                      <select
                        value={form.condLocationId}
                        onChange={e => set("condLocationId", e.target.value)}
                        className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Any location</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Department</label>
                      <select
                        value={form.condDeptId}
                        onChange={e => set("condDeptId", e.target.value)}
                        className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Any department</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Asset Type</label>
                    <select
                      value={form.condAssetType}
                      onChange={e => set("condAssetType", e.target.value)}
                      className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Any asset type</option>
                      {Object.entries(ASSET_TYPE).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Target */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Assign To *</p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Specific User</label>
                    <PeoplePicker
                      people={users}
                      value={form.assignToUserId}
                      onChange={v => set("assignToUserId", v)}
                      placeholder="Search by name, role, department…"
                      emptyLabel="— select user —"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="flex-1 border-t border-gray-200" />
                    or assign by role
                    <div className="flex-1 border-t border-gray-200" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Role <span className="text-gray-400">(nearest user with this role)</span></label>
                    <select
                      value={form.assignToRole}
                      onChange={e => set("assignToRole", e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— select role —</option>
                      {Object.entries(USER_ROLE).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => set("isActive", !form.isActive)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${form.isActive ? "bg-blue-600" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-4" : ""}`} />
                </button>
                <span className="text-sm text-gray-700">Rule active</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={closeDialog} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium"
              >
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
