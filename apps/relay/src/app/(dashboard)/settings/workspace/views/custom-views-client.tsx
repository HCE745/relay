"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, Pencil, Trash2, Copy, Eye, EyeOff, GripVertical, ExternalLink,
} from "lucide-react"
import {
  CUSTOM_VIEW_ICON_NAMES, CUSTOM_VIEW_ICON_MAP,
  ISSUE_COLUMN_KEYS, ISSUE_COLUMN_LABELS,
  VIEW_SORT_OPTIONS,
  resolveViewIcon,
} from "@/lib/custom-view-config"
import { ISSUE_STATUS, ISSUE_PRIORITY, ISSUE_CATEGORY } from "@/lib/constants"

interface ViewRecord {
  id:            string
  name:          string
  icon:          string | null
  filters:       Record<string, unknown>
  columns:       string[] | null
  sortField:     string | null
  sortDir:       string | null
  showInSidebar: boolean
  sidebarOrder:  number
  createdAt:     string
}

interface Location {
  id:   string
  name: string
}

interface Props {
  initialViews: ViewRecord[]
  locations:    Location[]
}

const EMPTY_FORM = {
  name:          "",
  icon:          "",
  filterStatus:  "",
  filterPriority:"",
  filterCategory:"",
  filterSearch:  "",
  filterLocationId: "",
  filterIsEscalated: false,
  columns:       ISSUE_COLUMN_KEYS.slice() as string[],
  sort:          "priority_desc",
  showInSidebar: false,
  sidebarOrder:  0,
}

type FormState = typeof EMPTY_FORM

function viewToForm(v: ViewRecord): FormState {
  const f = v.filters ?? {}
  const sortVal = v.sortField && v.sortDir ? `${v.sortField}_${v.sortDir}` : "priority_desc"
  return {
    name:               v.name,
    icon:               v.icon ?? "",
    filterStatus:       typeof f.status      === "string"  ? f.status      : "",
    filterPriority:     typeof f.priority    === "string"  ? f.priority    : "",
    filterCategory:     typeof f.category    === "string"  ? f.category    : "",
    filterSearch:       typeof f.search      === "string"  ? f.search      : "",
    filterLocationId:   typeof f.locationId  === "string"  ? f.locationId  : "",
    filterIsEscalated:  f.isEscalated === true,
    columns:            v.columns ?? ISSUE_COLUMN_KEYS.slice() as string[],
    sort:               VIEW_SORT_OPTIONS.some(o => o.value === sortVal) ? sortVal : "priority_desc",
    showInSidebar:      v.showInSidebar,
    sidebarOrder:       v.sidebarOrder,
  }
}

function formToPayload(form: FormState) {
  const filters: Record<string, unknown> = {}
  if (form.filterStatus)     filters.status      = form.filterStatus
  if (form.filterPriority)   filters.priority    = form.filterPriority
  if (form.filterCategory)   filters.category    = form.filterCategory
  if (form.filterSearch)     filters.search      = form.filterSearch
  if (form.filterLocationId) filters.locationId  = form.filterLocationId
  if (form.filterIsEscalated) filters.isEscalated = true

  const allCols = ISSUE_COLUMN_KEYS as readonly string[]
  const columns = form.columns.length === allCols.length ? null : form.columns

  return {
    name:          form.name.trim(),
    icon:          form.icon || null,
    filters,
    columns,
    sort:          form.sort,
    showInSidebar: form.showInSidebar,
    sidebarOrder:  form.sidebarOrder,
  }
}

export function CustomViewsClient({ initialViews, locations }: Props) {
  const router = useRouter()
  const [views, setViews] = useState<ViewRecord[]>(initialViews)
  const [modal, setModal] = useState<"create" | "edit" | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setError("")
    setModal("create")
  }

  function openEdit(view: ViewRecord) {
    setForm(viewToForm(view))
    setEditingId(view.id)
    setError("")
    setModal("edit")
  }

  function closeModal() {
    setModal(null)
    setEditingId(null)
    setError("")
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleColumn(key: string) {
    setForm(prev => {
      const next = prev.columns.includes(key)
        ? prev.columns.filter(c => c !== key)
        : [...prev.columns, key]
      // Must keep at least one column
      return { ...prev, columns: next.length ? next : prev.columns }
    })
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    try {
      const payload = formToPayload(form)
      const url  = modal === "edit" ? `/api/custom-views/${editingId}` : "/api/custom-views"
      const method = modal === "edit" ? "PATCH" : "POST"
      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? "Save failed")
        return
      }
      closeModal()
      router.refresh()
      const updated = await fetch("/api/custom-views").then(r => r.json()) as ViewRecord[]
      setViews(updated)
    } catch { setError("Network error") }
    finally  { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this view? This cannot be undone.")) return
    await fetch(`/api/custom-views/${id}`, { method: "DELETE" })
    setViews(prev => prev.filter(v => v.id !== id))
    router.refresh()
  }

  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/custom-views/${id}/duplicate`, { method: "POST" })
    if (res.ok) {
      const copy = await res.json() as ViewRecord
      setViews(prev => [...prev, { ...copy, filters: (copy.filters ?? {}) as Record<string, unknown>, columns: Array.isArray(copy.columns) ? copy.columns as string[] : null, createdAt: new Date().toISOString() }])
      router.refresh()
    }
  }

  async function handleToggleSidebar(view: ViewRecord) {
    const res = await fetch(`/api/custom-views/${view.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        ...formToPayload(viewToForm(view)),
        showInSidebar: !view.showInSidebar,
      }),
    })
    if (res.ok) {
      setViews(prev => prev.map(v => v.id === view.id ? { ...v, showInSidebar: !v.showInSidebar } : v))
      router.refresh()
    }
  }

  const Icon404 = resolveViewIcon(null)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">

      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">
            Create filtered issue views and optionally pin them to the sidebar.
            Views are shared with everyone in your organization.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          New View
        </button>
      </div>

      {/* View list */}
      {views.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl py-12 text-center">
          <p className="text-gray-400 text-sm mb-3">No custom views yet</p>
          <button
            onClick={openCreate}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Create your first view
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {views.map(view => {
            const VIcon = resolveViewIcon(view.icon)
            const filterCount = Object.values(view.filters ?? {}).filter(Boolean).length
            return (
              <div key={view.id} className="flex items-center gap-3 px-4 py-3">
                <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <VIcon className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">{view.name}</span>
                    {view.showInSidebar && (
                      <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                        In sidebar
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {filterCount > 0 ? `${filterCount} filter${filterCount > 1 ? "s" : ""}` : "No filters — shows all issues"}
                    {view.showInSidebar && ` · order ${view.sidebarOrder}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={`/issues?view=${view.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Open view"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => handleToggleSidebar(view)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title={view.showInSidebar ? "Hide from sidebar" : "Show in sidebar"}
                  >
                    {view.showInSidebar ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDuplicate(view.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => openEdit(view)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(view.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal ────────────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto p-4 pt-10">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-auto my-4">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">
                {modal === "create" ? "New Custom View" : "Edit View"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  View Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setField("name", e.target.value)}
                  placeholder="e.g. Open Safety Issues"
                  maxLength={80}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Icon (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_VIEW_ICON_NAMES.map(name => {
                    const I = CUSTOM_VIEW_ICON_MAP[name]
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setField("icon", form.icon === name ? "" : name)}
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                          form.icon === name
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-gray-200 text-gray-500 hover:border-blue-300 hover:bg-blue-50"
                        }`}
                        title={name}
                      >
                        <I className="w-4 h-4" />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Filters */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Filters
                </label>
                <div className="space-y-2">
                  <select
                    value={form.filterStatus}
                    onChange={e => setField("filterStatus", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Any status</option>
                    {Object.entries(ISSUE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>

                  <select
                    value={form.filterPriority}
                    onChange={e => setField("filterPriority", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Any priority</option>
                    {Object.entries(ISSUE_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>

                  <select
                    value={form.filterCategory}
                    onChange={e => setField("filterCategory", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Any category</option>
                    {Object.entries(ISSUE_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>

                  {locations.length > 0 && (
                    <select
                      value={form.filterLocationId}
                      onChange={e => setField("filterLocationId", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Any location</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  )}

                  <input
                    type="text"
                    value={form.filterSearch}
                    onChange={e => setField("filterSearch", e.target.value)}
                    placeholder="Title contains… (optional)"
                    maxLength={200}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.filterIsEscalated}
                      onChange={e => setField("filterIsEscalated", e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600"
                    />
                    Escalated issues only
                  </label>
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Sort Order
                </label>
                <select
                  value={form.sort}
                  onChange={e => setField("sort", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {VIEW_SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Columns */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Visible Columns (desktop table)
                </label>
                <div className="flex flex-wrap gap-2">
                  {ISSUE_COLUMN_KEYS.map(key => (
                    <label key={key} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={form.columns.includes(key)}
                        onChange={() => toggleColumn(key)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                      />
                      {ISSUE_COLUMN_LABELS[key]}
                    </label>
                  ))}
                </div>
              </div>

              {/* Sidebar */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.showInSidebar}
                    onChange={e => setField("showInSidebar", e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                  Show in sidebar navigation
                </label>
                {form.showInSidebar && (
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-500 shrink-0">Order position</label>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={form.sidebarOrder}
                      onChange={e => setField("sidebarOrder", Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-400">(lower = higher in list)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <button
                onClick={closeModal}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {saving ? "Saving…" : modal === "create" ? "Create View" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
