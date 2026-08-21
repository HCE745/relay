"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Eye,
  ChevronUp,
  ChevronDown,
  X,
  LayoutDashboard,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { resolveViewIcon, CUSTOM_VIEW_ICON_NAMES } from "@/lib/custom-view-config"
import { ISSUE_COLUMN_KEYS, ISSUE_COLUMN_LABELS, VIEW_SORT_OPTIONS } from "@/lib/custom-view-config"
import {
  WIDGET_META,
  WIDGET_TYPES,
  WIDGET_WIDTHS,
  KPI_METRICS,
  KPI_METRIC_KEYS,
  type CustomPageRow,
  type PageWidget,
  type WidgetTypeKey,
  type WidgetWidth,
} from "@/lib/widget-registry"

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomView { id: string; name: string }
interface Location   { id: string; name: string }

interface Props {
  initialPages: CustomPageRow[]
  customViews:  CustomView[]
  locations:    Location[]
}

type WidgetDraft = {
  id:     string
  type:   WidgetTypeKey
  width:  WidgetWidth
  config: Record<string, unknown>
}

type PageDraft = {
  name:         string
  icon:         string | null
  description:  string
  showInSidebar: boolean
  sidebarOrder: number
  widgets:      WidgetDraft[]
}

type ModalState =
  | { view: "list" }
  | { view: "page-form"; mode: "create" | "edit"; pageId?: string }
  | { view: "widget-pick" }
  | { view: "widget-config"; widgetIndex: number | null; type: WidgetTypeKey }

const BLANK_DRAFT: PageDraft = {
  name:         "",
  icon:         null,
  description:  "",
  showInSidebar: false,
  sidebarOrder: 0,
  widgets:      [],
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function widgetDefaultConfig(type: WidgetTypeKey): Record<string, unknown> {
  switch (type) {
    case "kpi-count":      return { metric: "open_issues" }
    case "issues-list":    return { maxRows: 10, filters: {} }
    case "custom-view":    return { viewId: "" }
    case "assets-list":    return { maxRows: 10 }
    case "locations-list": return { maxRows: 10 }
    case "text":           return { body: "" }
    case "link-block":     return { title: "", url: "" }
  }
}

function pageRowToWidgets(page: CustomPageRow): WidgetDraft[] {
  return page.widgets.map(w => ({
    id:     w.id,
    type:   w.type,
    width:  w.width,
    config: w.config as unknown as Record<string, unknown>,
  }))
}

function draftToPayload(draft: PageDraft): Record<string, unknown> {
  const widgets: PageWidget[] = draft.widgets.map((w, i) => ({
    id:     w.id,
    type:   w.type,
    width:  w.width,
    order:  i,
    config: { type: w.type, ...w.config } as PageWidget["config"],
  }))
  return {
    name:         draft.name,
    icon:         draft.icon,
    description:  draft.description || null,
    showInSidebar: draft.showInSidebar,
    sidebarOrder: draft.sidebarOrder,
    widgets,
  }
}

// ── Widget type label ─────────────────────────────────────────────────────────

function WidgetTypeLabel({ type }: { type: WidgetTypeKey }) {
  const meta = WIDGET_META.find(m => m.type === type)
  return <span className="text-xs text-gray-500">{meta?.name ?? type}</span>
}

// ── Icon picker ───────────────────────────────────────────────────────────────

function IconPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "w-8 h-8 rounded-lg border-2 flex items-center justify-center text-xs transition-colors",
          value === null ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300",
        )}
        title="No icon"
      >
        <LayoutDashboard className="w-4 h-4 text-gray-400" />
      </button>
      {CUSTOM_VIEW_ICON_NAMES.map(name => {
        const Icon = resolveViewIcon(name)
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className={cn(
              "w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-colors",
              value === name ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300",
            )}
            title={name}
          >
            <Icon className="w-4 h-4 text-gray-600" />
          </button>
        )
      })}
    </div>
  )
}

// ── Widget config form ────────────────────────────────────────────────────────

function WidgetConfigForm({
  type,
  config,
  onChange,
  customViews,
  locations,
}: {
  type:        WidgetTypeKey
  config:      Record<string, unknown>
  onChange:    (c: Record<string, unknown>) => void
  customViews: CustomView[]
  locations:   Location[]
}) {
  const set = (key: string, val: unknown) => onChange({ ...config, [key]: val })
  const filters = (config.filters ?? {}) as Record<string, unknown>
  const setFilter = (k: string, v: unknown) =>
    set("filters", v ? { ...filters, [k]: v } : Object.fromEntries(Object.entries(filters).filter(([fk]) => fk !== k)))

  switch (type) {
    case "kpi-count":
      return (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-700">
            Metric <span className="text-red-500">*</span>
            <select
              value={String(config.metric ?? "open_issues")}
              onChange={e => set("metric", e.target.value)}
              className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {KPI_METRIC_KEYS.map(k => (
                <option key={k} value={k}>{KPI_METRICS[k]}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Custom title (optional)
            <input
              type="text"
              value={String(config.title ?? "")}
              onChange={e => set("title", e.target.value || undefined)}
              placeholder={KPI_METRICS[(config.metric as keyof typeof KPI_METRICS) ?? "open_issues"]}
              className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      )

    case "issues-list":
      return (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-700">
            Section title (optional)
            <input
              type="text"
              value={String(config.title ?? "")}
              onChange={e => set("title", e.target.value || undefined)}
              placeholder="Issues"
              className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Max rows
            <input
              type="number"
              min={1}
              max={20}
              value={Number(config.maxRows ?? 10)}
              onChange={e => set("maxRows", Math.min(20, Math.max(1, parseInt(e.target.value) || 10)))}
              className="mt-1 block w-24 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-gray-700">
              Status filter
              <select
                value={String(filters.status ?? "")}
                onChange={e => setFilter("status", e.target.value || undefined)}
                className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any</option>
                <option>OPEN</option>
                <option>IN_PROGRESS</option>
                <option>RESOLVED</option>
                <option>CLOSED</option>
                <option>ESCALATED</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Priority filter
              <select
                value={String(filters.priority ?? "")}
                onChange={e => setFilter("priority", e.target.value || undefined)}
                className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any</option>
                <option>CRITICAL</option>
                <option>HIGH</option>
                <option>MEDIUM</option>
                <option>LOW</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Category filter
              <select
                value={String(filters.category ?? "")}
                onChange={e => setFilter("category", e.target.value || undefined)}
                className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any</option>
                <option value="GENERAL">General</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="SAFETY">Safety</option>
                <option value="EQUIPMENT_BREAKDOWN">Equipment Breakdown</option>
                <option value="CUSTOMER_REPORT">Customer Report</option>
                <option value="INJURY">Injury</option>
              </select>
            </label>
            {locations.length > 0 && (
              <label className="block text-xs font-medium text-gray-700">
                Location filter
                <select
                  value={String(filters.locationId ?? "")}
                  onChange={e => setFilter("locationId", e.target.value || undefined)}
                  className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <label className="block text-xs font-medium text-gray-700">
            Sort
            <select
              value={String(config.sort ?? "")}
              onChange={e => set("sort", e.target.value || undefined)}
              className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Default (priority)</option>
              {VIEW_SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">Visible columns</p>
            <div className="flex flex-wrap gap-2">
              {ISSUE_COLUMN_KEYS.map(col => {
                const cols = Array.isArray(config.columns) ? config.columns as string[] : null
                const checked = cols === null || cols.includes(col)
                return (
                  <label key={col} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        const current: string[] = cols ?? [...ISSUE_COLUMN_KEYS]
                        const next = e.target.checked
                          ? [...new Set([...current, col])]
                          : current.filter(c => c !== col)
                        // If all selected, store null (= all); else store the subset
                        set("columns", next.length === ISSUE_COLUMN_KEYS.length ? undefined : next)
                      }}
                      className="rounded"
                    />
                    {ISSUE_COLUMN_LABELS[col]}
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      )

    case "custom-view":
      return (
        <div className="space-y-3">
          {customViews.length === 0 ? (
            <p className="text-sm text-gray-500">No saved views found. Create one in Workspace → Custom Views first.</p>
          ) : (
            <label className="block text-xs font-medium text-gray-700">
              Saved View <span className="text-red-500">*</span>
              <select
                value={String(config.viewId ?? "")}
                onChange={e => set("viewId", e.target.value)}
                className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a view…</option>
                {customViews.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
          )}
          <label className="block text-xs font-medium text-gray-700">
            Custom title (optional)
            <input
              type="text"
              value={String(config.title ?? "")}
              onChange={e => set("title", e.target.value || undefined)}
              placeholder="Uses view name by default"
              className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      )

    case "assets-list":
    case "locations-list":
      return (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-700">
            Section title (optional)
            <input
              type="text"
              value={String(config.title ?? "")}
              onChange={e => set("title", e.target.value || undefined)}
              placeholder={type === "assets-list" ? "Assets" : "Locations"}
              className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Max rows
            <input
              type="number"
              min={1}
              max={20}
              value={Number(config.maxRows ?? 10)}
              onChange={e => set("maxRows", Math.min(20, Math.max(1, parseInt(e.target.value) || 10)))}
              className="mt-1 block w-24 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      )

    case "text":
      return (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-700">
            Heading (optional)
            <input
              type="text"
              value={String(config.title ?? "")}
              onChange={e => set("title", e.target.value || undefined)}
              className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Body <span className="text-red-500">*</span>
            <textarea
              rows={5}
              value={String(config.body ?? "")}
              onChange={e => set("body", e.target.value)}
              placeholder="Plain text content…"
              maxLength={2000}
              className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            <span className="text-xs text-gray-400 float-right">{String(config.body ?? "").length}/2000</span>
          </label>
        </div>
      )

    case "link-block":
      return (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-700">
            Link title <span className="text-red-500">*</span>
            <input
              type="text"
              value={String(config.title ?? "")}
              onChange={e => set("title", e.target.value)}
              className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            URL <span className="text-red-500">*</span>
            <input
              type="url"
              value={String(config.url ?? "")}
              onChange={e => set("url", e.target.value)}
              placeholder="https://example.com or /internal/path"
              className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">Must start with https:// or /</span>
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Description (optional)
            <input
              type="text"
              value={String(config.description ?? "")}
              onChange={e => set("description", e.target.value || undefined)}
              maxLength={200}
              className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      )

    default:
      return <p className="text-sm text-gray-400">No configuration for this widget type.</p>
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function PagesClient({ initialPages, customViews, locations }: Props) {
  const [pages, setPages]     = useState<CustomPageRow[]>(initialPages)
  const [modal, setModal]     = useState<ModalState>({ view: "list" })
  const [draft, setDraft]     = useState<PageDraft>(BLANK_DRAFT)
  const [editingWidget, setEditingWidget] = useState<WidgetDraft | null>(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Open forms ──────────────────────────────────────────────────────────────

  function openCreate() {
    setDraft(BLANK_DRAFT)
    setError(null)
    setModal({ view: "page-form", mode: "create" })
  }

  function openEdit(page: CustomPageRow) {
    setDraft({
      name:         page.name,
      icon:         page.icon,
      description:  page.description ?? "",
      showInSidebar: page.showInSidebar,
      sidebarOrder: page.sidebarOrder,
      widgets:      pageRowToWidgets(page),
    })
    setError(null)
    setModal({ view: "page-form", mode: "edit", pageId: page.id })
  }

  function closeModal() {
    setModal({ view: "list" })
    setEditingWidget(null)
    setError(null)
  }

  // ── Widget operations ────────────────────────────────────────────────────────

  function pickWidget() {
    setModal({ view: "widget-pick" })
  }

  function selectWidgetType(type: WidgetTypeKey) {
    const meta = WIDGET_META.find(m => m.type === type)!
    setEditingWidget({ id: newId(), type, width: meta.defaultWidth, config: widgetDefaultConfig(type) })
    setModal({ view: "widget-config", widgetIndex: null, type })
  }

  function editWidget(index: number) {
    const w = draft.widgets[index]
    setEditingWidget({ ...w })
    setModal({ view: "widget-config", widgetIndex: index, type: w.type })
  }

  function confirmWidget() {
    if (!editingWidget) return
    if (modal.view !== "widget-config") return
    const { widgetIndex } = modal
    setDraft(prev => {
      const widgets = [...prev.widgets]
      if (widgetIndex === null) {
        widgets.push(editingWidget)
      } else {
        widgets[widgetIndex] = editingWidget
      }
      return { ...prev, widgets }
    })
    setEditingWidget(null)
    setModal({ view: "page-form", mode: modal.view === "widget-config" ? "edit" : "create" })
  }

  function cancelWidget() {
    setEditingWidget(null)
    // Return to page form — figure out mode from current state
    const pageId = (modal as { pageId?: string }).pageId
    setModal({ view: "page-form", mode: pageId ? "edit" : "create", pageId })
  }

  function removeWidget(index: number) {
    setDraft(prev => ({ ...prev, widgets: prev.widgets.filter((_, i) => i !== index) }))
  }

  function moveWidget(index: number, dir: -1 | 1) {
    setDraft(prev => {
      const widgets = [...prev.widgets]
      const target = index + dir
      if (target < 0 || target >= widgets.length) return prev
      ;[widgets[index], widgets[target]] = [widgets[target], widgets[index]]
      return { ...prev, widgets }
    })
  }

  function setWidgetWidth(index: number, width: WidgetWidth) {
    setDraft(prev => {
      const widgets = [...prev.widgets]
      widgets[index] = { ...widgets[index], width }
      return { ...prev, widgets }
    })
  }

  // ── CRUD operations ──────────────────────────────────────────────────────────

  const savePage = useCallback(async () => {
    setError(null)
    setSaving(true)
    try {
      const isEdit   = modal.view === "page-form" && modal.mode === "edit"
      const pageId   = isEdit ? (modal as { pageId?: string }).pageId : null
      const url      = pageId ? `/api/custom-pages/${pageId}` : "/api/custom-pages"
      const method   = pageId ? "PATCH" : "POST"
      const res      = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(draftToPayload(draft)),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        setError(j.error ?? "Failed to save")
        return
      }
      const saved = await res.json()
      setPages(prev =>
        pageId
          ? prev.map(p => p.id === pageId ? { ...saved, createdAt: saved.createdAt ?? p.createdAt } : p)
          : [...prev, { ...saved, createdAt: saved.createdAt }],
      )
      closeModal()
    } finally {
      setSaving(false)
    }
  }, [modal, draft])

  async function deletePage(id: string) {
    if (!confirm("Delete this page? This cannot be undone.")) return
    setDeletingId(id)
    try {
      await fetch(`/api/custom-pages/${id}`, { method: "DELETE" })
      setPages(prev => prev.filter(p => p.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  async function duplicatePage(id: string) {
    const res = await fetch(`/api/custom-pages/${id}/duplicate`, { method: "POST" })
    if (!res.ok) return
    const copy = await res.json()
    setPages(prev => [...prev, { ...copy, createdAt: copy.createdAt }])
  }

  async function toggleSidebar(page: CustomPageRow) {
    const res = await fetch(`/api/custom-pages/${page.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(draftToPayload({
        name:         page.name,
        icon:         page.icon,
        description:  page.description ?? "",
        showInSidebar: !page.showInSidebar,
        sidebarOrder: page.sidebarOrder,
        widgets:      pageRowToWidgets(page),
      })),
    })
    if (!res.ok) return
    const updated = await res.json()
    setPages(prev => prev.map(p => p.id === page.id ? { ...p, showInSidebar: updated.showInSidebar } : p))
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (modal.view === "widget-pick") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={cancelWidget}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-gray-900">Choose widget type</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WIDGET_META.map(meta => (
            <button
              key={meta.type}
              type="button"
              onClick={() => selectWidgetType(meta.type)}
              className="text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <p className="text-sm font-medium text-gray-900">{meta.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (modal.view === "widget-config" && editingWidget) {
    const meta = WIDGET_META.find(m => m.type === editingWidget.type)
    const isNew = (modal as { widgetIndex: number | null }).widgetIndex === null
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={cancelWidget} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-gray-900">
            {isNew ? `Add: ${meta?.name}` : `Edit: ${meta?.name}`}
          </h2>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
          {/* Width */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">Width</p>
            <div className="flex gap-2">
              {WIDGET_WIDTHS.map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setEditingWidget(prev => prev ? { ...prev, width: w } : null)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    editingWidget.width === w
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 text-gray-600 hover:border-gray-300",
                  )}
                >
                  {w.charAt(0).toUpperCase() + w.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Type-specific config */}
          <WidgetConfigForm
            type={editingWidget.type}
            config={editingWidget.config}
            onChange={config => setEditingWidget(prev => prev ? { ...prev, config } : null)}
            customViews={customViews}
            locations={locations}
          />

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={confirmWidget}
              className="flex-1 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isNew ? "Add widget" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={cancelWidget}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (modal.view === "page-form") {
    const isEdit = modal.mode === "edit"
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-gray-900">{isEdit ? "Edit Page" : "New Page"}</h2>
        </div>

        <div className="space-y-4">
          {/* Page details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Page details</h3>

            <label className="block text-xs font-medium text-gray-700">
              Page name <span className="text-red-500">*</span>
              <input
                type="text"
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Plant Overview"
                maxLength={80}
                className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Icon</p>
              <IconPicker
                value={draft.icon}
                onChange={icon => setDraft(d => ({ ...d, icon }))}
              />
            </div>

            <label className="block text-xs font-medium text-gray-700">
              Description (optional)
              <textarea
                rows={2}
                value={draft.description}
                onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                placeholder="Shown below the page title"
                maxLength={300}
                className="mt-1 block w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </label>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.showInSidebar}
                  onChange={e => setDraft(d => ({ ...d, showInSidebar: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-xs font-medium text-gray-700">Show in sidebar</span>
              </label>
              {draft.showInSidebar && (
                <label className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Order</span>
                  <input
                    type="number"
                    min={0}
                    value={draft.sidebarOrder}
                    onChange={e => setDraft(d => ({ ...d, sidebarOrder: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="w-16 text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Widgets */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Widgets
                <span className="ml-2 text-gray-400 font-normal normal-case">
                  ({draft.widgets.length}/16)
                </span>
              </h3>
              {draft.widgets.length < 16 && (
                <button
                  type="button"
                  onClick={pickWidget}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add widget
                </button>
              )}
            </div>

            {draft.widgets.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-400">No widgets yet.</p>
                <button
                  type="button"
                  onClick={pickWidget}
                  className="mt-2 text-sm text-blue-600 hover:underline"
                >
                  Add your first widget
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {draft.widgets.map((widget, i) => {
                  const Icon = resolveViewIcon(null)
                  return (
                    <div key={widget.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveWidget(i, -1)}
                          disabled={i === 0}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-colors"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveWidget(i, 1)}
                          disabled={i === draft.widgets.length - 1}
                          className="text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <WidgetTypeLabel type={widget.type} />
                          <span className="text-xs text-gray-300">·</span>
                          <span className="text-xs text-gray-400">{widget.width}</span>
                        </div>
                        {typeof widget.config.title === "string" && widget.config.title && (
                          <p className="text-xs text-gray-600 truncate mt-0.5">
                            &ldquo;{widget.config.title}&rdquo;
                          </p>
                        )}
                        {widget.type === "kpi-count" && typeof widget.config.metric === "string" && (
                          <p className="text-xs text-gray-600 truncate mt-0.5">
                            {KPI_METRICS[widget.config.metric as keyof typeof KPI_METRICS] ?? widget.config.metric}
                          </p>
                        )}
                      </div>

                      {/* Width quick-set */}
                      <select
                        value={widget.width}
                        onChange={e => setWidgetWidth(i, e.target.value as WidgetWidth)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none"
                      >
                        {WIDGET_WIDTHS.map(w => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => editWidget(i)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Configure"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeWidget(i)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Error + save */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pb-4">
            <button
              type="button"
              onClick={savePage}
              disabled={saving || !draft.name.trim()}
              className="flex-1 bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create page"}
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500">
            Pages appear in the sidebar and can contain multiple widgets.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New page
        </button>
      </div>

      {pages.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-12 text-center">
          <LayoutDashboard className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-2">No custom pages yet.</p>
          <button
            type="button"
            onClick={openCreate}
            className="text-sm text-blue-600 hover:underline"
          >
            Create your first page
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map(page => {
            const PageIcon = resolveViewIcon(page.icon)
            return (
              <div
                key={page.id}
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <PageIcon className="w-4 h-4 text-gray-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{page.name}</p>
                  <p className="text-xs text-gray-400">
                    {page.widgets.length} widget{page.widgets.length !== 1 ? "s" : ""}
                    {page.showInSidebar && " · In sidebar"}
                  </p>
                </div>

                {/* Sidebar toggle */}
                <button
                  type="button"
                  onClick={() => toggleSidebar(page)}
                  title={page.showInSidebar ? "Remove from sidebar" : "Pin to sidebar"}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors text-xs",
                    page.showInSidebar
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-300 hover:text-gray-500",
                  )}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>

                <Link
                  href={`/workspace/${page.id}`}
                  title="Preview"
                  className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => duplicatePage(page.id)}
                  title="Duplicate"
                  className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => openEdit(page)}
                  title="Edit"
                  className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => deletePage(page.id)}
                  disabled={deletingId === page.id}
                  title="Delete"
                  className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
