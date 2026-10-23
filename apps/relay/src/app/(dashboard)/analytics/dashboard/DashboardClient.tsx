"use client"

import { useState, useCallback } from "react"
import { Widget } from "@/components/analytics/Widget"
import { METRICS_CATALOG, DASHBOARD_TEMPLATES } from "@/lib/analytics/types"
import type { WidgetConfig } from "@/lib/analytics/types"
import { Plus, Edit2, Save, X, LayoutGrid, CheckCircle } from "lucide-react"
function uid() { return Math.random().toString(36).slice(2, 10) }

interface DashboardLayout {
  id?: string
  name: string
  widgets: WidgetConfig[]
}

interface Props {
  initialLayout: DashboardLayout | null
  templates: typeof DASHBOARD_TEMPLATES
}

function defaultDateRange() {
  const end   = new Date()
  const start = new Date(end.getTime() - 30 * 86400_000)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

export function DashboardClient({ initialLayout, templates }: Props) {
  const [layout, setLayout] = useState<DashboardLayout>(
    initialLayout ?? { name: "My Dashboard", widgets: [] },
  )
  const [editMode,   setEditMode]   = useState(!initialLayout)
  const [dateRange,  setDateRange]  = useState(defaultDateRange)
  const [saving,     setSaving]     = useState(false)
  const [saveOk,     setSaveOk]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [showAdd,    setShowAdd]    = useState(false)
  const [showTemplates, setShowTemplates] = useState(!initialLayout)

  // Load a template
  function loadTemplate(template: typeof DASHBOARD_TEMPLATES[number]) {
    setLayout({
      id:      layout.id,
      name:    template.name,
      widgets: template.widgets.map(w => ({ ...w, id: uid() })),
    })
    setShowTemplates(false)
    setEditMode(false)
  }

  // Remove widget
  const removeWidget = useCallback((id: string) => {
    setLayout(l => ({ ...l, widgets: l.widgets.filter(w => w.id !== id) }))
  }, [])

  // Add widget from the picker
  function addWidget(metricKey: string, visualType: WidgetConfig["visualType"], width: 1 | 2 | 3 = 1) {
    const metric = METRICS_CATALOG.find(m => m.key === metricKey)
    const newWidget: WidgetConfig = {
      id:         uid(),
      metricKey,
      visualType,
      title:      metric?.label ?? metricKey,
      width,
      position:   layout.widgets.length,
    }
    setLayout(l => ({ ...l, widgets: [...l.widgets, newWidget] }))
    setShowAdd(false)
  }

  // Move widget left/right
  function moveWidget(id: string, dir: -1 | 1) {
    setLayout(l => {
      const idx = l.widgets.findIndex(w => w.id === id)
      if (idx < 0) return l
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= l.widgets.length) return l
      const next = [...l.widgets]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      return { ...l, widgets: next.map((w, i) => ({ ...w, position: i })) }
    })
  }

  // Save dashboard
  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/analytics/dashboards", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: layout.id, name: layout.name, widgets: layout.widgets, isDefault: true }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? "Failed to save")
        return
      }
      const saved = await res.json() as { id: string; name: string }
      setLayout(l => ({ ...l, id: saved.id }))
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 2500)
      setEditMode(false)
    } finally {
      setSaving(false)
    }
  }

  const widgets = [...layout.widgets].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <input
            type="date"
            value={dateRange.start}
            onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))}
            className="border-0 outline-none text-gray-700 bg-transparent text-sm"
          />
          <span className="text-gray-400">–</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))}
            className="border-0 outline-none text-gray-700 bg-transparent text-sm"
          />
        </div>

        <div className="flex-1" />

        {/* Dashboard name (edit mode) */}
        {editMode && (
          <input
            value={layout.name}
            onChange={e => setLayout(l => ({ ...l, name: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        )}

        {!editMode && (
          <span className="text-sm font-medium text-gray-700">{layout.name}</span>
        )}

        {editMode ? (
          <>
            <button
              onClick={() => setShowTemplates(t => !t)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LayoutGrid className="w-4 h-4" />
              Templates
            </button>
            <button
              onClick={() => setShowAdd(v => !v)}
              className="flex items-center gap-2 px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Widget
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saveOk ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saveOk ? "Saved" : saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditMode(false); setShowAdd(false) }}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Template picker */}
      {showTemplates && editMode && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Choose a template</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {templates.map(t => (
              <button
                key={t.name}
                onClick={() => loadTemplate(t)}
                className="text-left p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <p className="font-medium text-gray-800 text-sm">{t.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.widgets.length} widgets</p>
              </button>
            ))}
            <button
              onClick={() => { setLayout(l => ({ ...l, widgets: [] })); setShowTemplates(false) }}
              className="text-left p-4 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <p className="font-medium text-sm">Blank dashboard</p>
              <p className="text-xs mt-0.5">Start from scratch</p>
            </button>
          </div>
        </div>
      )}

      {/* Add widget panel */}
      {showAdd && editMode && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Add a widget</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {METRICS_CATALOG.map(metric => (
              metric.supportedVisualTypes.map(vt => (
                <button
                  key={`${metric.key}-${vt}`}
                  onClick={() => addWidget(metric.key, vt)}
                  className="text-left p-3 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-800">{metric.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{vt.replace("_", " ")}</p>
                </button>
              ))
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {widgets.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <LayoutGrid className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No widgets yet</p>
          <p className="text-gray-400 text-sm mt-1">
            {editMode ? "Click \"Add Widget\" or choose a template to get started." : "Click Edit to add widgets."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {widgets.map(w => (
            <WidgetWrapper
              key={w.id}
              config={w}
              dateRange={dateRange}
              editMode={editMode}
              onRemove={removeWidget}
              onMoveLeft={editMode ? () => moveWidget(w.id, -1) : undefined}
              onMoveRight={editMode ? () => moveWidget(w.id, 1) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function WidgetWrapper({
  config, dateRange, editMode, onRemove, onMoveLeft, onMoveRight,
}: {
  config: WidgetConfig
  dateRange: { start: string; end: string }
  editMode?: boolean
  onRemove?: (id: string) => void
  onMoveLeft?: () => void
  onMoveRight?: () => void
}) {
  const colSpan = config.width === 3 ? "col-span-3" : config.width === 2 ? "col-span-2" : "col-span-1"

  return (
    <div className={colSpan}>
      <Widget config={config} dateRange={dateRange} editMode={editMode} onRemove={onRemove} />
      {editMode && (
        <div className="flex justify-end gap-1 mt-1">
          {onMoveLeft && (
            <button onClick={onMoveLeft} className="text-xs text-gray-400 hover:text-gray-600 px-1">← move</button>
          )}
          {onMoveRight && (
            <button onClick={onMoveRight} className="text-xs text-gray-400 hover:text-gray-600 px-1">move →</button>
          )}
        </div>
      )}
    </div>
  )
}
