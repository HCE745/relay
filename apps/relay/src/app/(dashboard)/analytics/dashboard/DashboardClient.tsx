"use client"

import { useState, useCallback, useEffect } from "react"
import { Widget } from "@/components/analytics/Widget"
import { METRICS_CATALOG, DASHBOARD_TEMPLATES } from "@/lib/analytics/types"
import type { WidgetConfig } from "@/lib/analytics/types"
import {
  Plus, Edit2, Save, X, LayoutGrid, CheckCircle, ChevronDown,
  Crown, Share2, Trash2, Copy, Printer, Bell, Mail, ToggleLeft, ToggleRight,
  AlertTriangle, Clock,
} from "lucide-react"

function uid() { return Math.random().toString(36).slice(2, 10) }

interface SavedLayout {
  id: string
  name: string
  layoutType: string
  isOrgDefault: boolean
  createdById: string
  widgets: WidgetConfig[]
}

interface InitialLayout {
  id?: string
  name: string
  layoutType: string
  isOrgDefault: boolean
  createdById: string
  widgets: WidgetConfig[]
}

interface TeamMember { id: string; name: string; email: string; role: string }

interface Report {
  id: string
  name: string
  frequency: string
  sendTime: string
  dayOfWeek?: number | null
  dayOfMonth?: number | null
  isActive: boolean
  lastSentAt?: string | null
  recipients: string[]
  dashboardLayout?: { id: string; name: string }
}

interface Alert {
  id: string
  name: string
  metricKey: string
  condition: string
  threshold: number
  dateRange: string
  isActive: boolean
  lastTriggeredAt?: string | null
  notifyUserIds: string[]
}

interface Props {
  initialLayout: InitialLayout
  templates: typeof DASHBOARD_TEMPLATES
  role: string
  userId: string
  teamMembers: TeamMember[]
}

function defaultDateRange() {
  const end   = new Date()
  const start = new Date(end.getTime() - 30 * 86400_000)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

const SECTIONS = [
  ...Array.from(new Set(METRICS_CATALOG.map(m => m.section ?? ""))).filter(Boolean),
  "",
]

export function DashboardClient({ initialLayout, templates, role, userId, teamMembers }: Props) {
  const [layout, setLayout]               = useState<InitialLayout>(initialLayout)
  const [editMode, setEditMode]           = useState(!initialLayout.id)
  const [dateRange, setDateRange]         = useState(defaultDateRange)
  const [saving, setSaving]               = useState(false)
  const [saveOk, setSaveOk]              = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [showAdd, setShowAdd]             = useState(false)
  const [showTemplates, setShowTemplates] = useState(!initialLayout.id)
  const [showDashboards, setShowDashboards] = useState(false)
  const [orgLayouts, setOrgLayouts]       = useState<SavedLayout[]>([])
  const [showReports, setShowReports]     = useState(false)
  const [showAlerts, setShowAlerts]       = useState(false)
  const [reports, setReports]             = useState<Report[]>([])
  const [alerts, setAlerts]               = useState<Alert[]>([])
  const [loadingExtra, setLoadingExtra]   = useState(false)

  const isAdmin = role === "ADMIN"

  // Load org layouts whenever the panel opens
  useEffect(() => {
    if (!showDashboards) return
    fetch("/api/analytics/dashboards")
      .then(r => r.json())
      .then((data: SavedLayout[]) => setOrgLayouts(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [showDashboards])

  // Load reports/alerts when panels open
  useEffect(() => {
    if (!showReports || !isAdmin) return
    setLoadingExtra(true)
    fetch("/api/analytics/reports")
      .then(r => r.json())
      .then((data: Report[]) => setReports(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingExtra(false))
  }, [showReports, isAdmin])

  useEffect(() => {
    if (!showAlerts || !isAdmin) return
    setLoadingExtra(true)
    fetch("/api/analytics/alerts")
      .then(r => r.json())
      .then((data: Alert[]) => setAlerts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingExtra(false))
  }, [showAlerts, isAdmin])

  function loadTemplate(template: typeof DASHBOARD_TEMPLATES[number]) {
    setLayout(l => ({
      ...l,
      id:      undefined,
      name:    template.name,
      widgets: template.widgets.map(w => ({ ...w, id: uid() })),
    }))
    setShowTemplates(false)
    setEditMode(false)
  }

  function switchLayout(saved: SavedLayout) {
    setLayout({
      id:          saved.id,
      name:        saved.name,
      layoutType:  saved.layoutType,
      isOrgDefault: saved.isOrgDefault,
      createdById: saved.createdById,
      widgets:     saved.widgets,
    })
    setShowDashboards(false)
    setEditMode(false)
    setShowTemplates(false)
    setShowAdd(false)
  }

  async function savePersonalCopy() {
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/analytics/dashboards", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: `${layout.name} (copy)`, widgets: layout.widgets, isDefault: true }),
      })
      if (!res.ok) { const b = await res.json(); setError(b.error ?? "Failed"); return }
      const saved = await res.json() as SavedLayout
      setLayout(l => ({ ...l, id: saved.id, layoutType: "PERSONAL", isOrgDefault: false, createdById: saved.createdById }))
      setSaveOk(true); setTimeout(() => setSaveOk(false), 2500)
      setEditMode(false)
    } finally { setSaving(false) }
  }

  const removeWidget = useCallback((id: string) => {
    setLayout(l => ({ ...l, widgets: l.widgets.filter(w => w.id !== id) }))
  }, [])

  function addWidget(metricKey: string, visualType: WidgetConfig["visualType"], width: 1 | 2 | 3 = 1) {
    const metric = METRICS_CATALOG.find(m => m.key === metricKey)
    const newWidget: WidgetConfig = {
      id:       uid(),
      metricKey,
      visualType,
      title:    metric?.label ?? metricKey,
      width,
      position: layout.widgets.length,
    }
    setLayout(l => ({ ...l, widgets: [...l.widgets, newWidget] }))
    setShowAdd(false)
  }

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

  async function save() {
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/analytics/dashboards", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: layout.id, name: layout.name, widgets: layout.widgets, isDefault: true }),
      })
      if (!res.ok) { const b = await res.json(); setError(b.error ?? "Failed to save"); return }
      const saved = await res.json() as SavedLayout
      setLayout(l => ({ ...l, id: saved.id, createdById: saved.createdById }))
      setSaveOk(true); setTimeout(() => setSaveOk(false), 2500)
      setEditMode(false)
    } finally { setSaving(false) }
  }

  async function setAsOrgDefault() {
    if (!layout.id || !isAdmin) return
    const res = await fetch(`/api/analytics/dashboards/${layout.id}/set-default`, { method: "PATCH" })
    if (res.ok) setLayout(l => ({ ...l, isOrgDefault: true }))
  }

  async function deleteLayout() {
    if (!layout.id) return
    const res = await fetch(`/api/analytics/dashboards/${layout.id}`, { method: "DELETE" })
    if (res.ok) {
      setLayout({ name: "My Dashboard", layoutType: "PERSONAL", isOrgDefault: false, createdById: userId, widgets: [] })
      setEditMode(true)
    }
  }

  function handlePrint() {
    window.print()
  }

  async function toggleReport(id: string, isActive: boolean) {
    const res = await fetch(`/api/analytics/reports/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isActive }),
    })
    if (res.ok) {
      setReports(rs => rs.map(r => r.id === id ? { ...r, isActive } : r))
    }
  }

  async function deleteReport(id: string) {
    const res = await fetch(`/api/analytics/reports/${id}`, { method: "DELETE" })
    if (res.ok) setReports(rs => rs.filter(r => r.id !== id))
  }

  async function toggleAlert(id: string, isActive: boolean) {
    const res = await fetch(`/api/analytics/alerts/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isActive }),
    })
    if (res.ok) {
      setAlerts(as => as.map(a => a.id === id ? { ...a, isActive } : a))
    }
  }

  async function deleteAlert(id: string) {
    const res = await fetch(`/api/analytics/alerts/${id}`, { method: "DELETE" })
    if (res.ok) setAlerts(as => as.filter(a => a.id !== id))
  }

  const widgets = [...layout.widgets].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const isOwnLayout = !layout.id || layout.createdById === userId
  const isOrgLevel  = layout.layoutType === "ORG_SHARED" || layout.layoutType === "ORG_DEFAULT"
  const canEdit     = isOwnLayout || (isOrgLevel && isAdmin)

  const metricsBySection = METRICS_CATALOG.reduce<Record<string, typeof METRICS_CATALOG>>((acc, m) => {
    const section = m.section ?? "Metrics"
    ;(acc[section] ??= []).push(m)
    return acc
  }, {})

  const personalLayouts = orgLayouts.filter(l => l.layoutType === "PERSONAL" && l.createdById === userId)
  const sharedLayouts   = orgLayouts.filter(l => l.layoutType !== "PERSONAL" || l.createdById !== userId)

  return (
    <>
      {/* Print stylesheet */}
      <style>{`
        @media print {
          nav, header, [data-no-print] { display: none !important; }
          body { background: #fff !important; }
          .dashboard-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>

      <div className="p-6 space-y-6 max-w-7xl">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3" data-no-print>
          {/* Date range */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <input type="date" value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} className="border-0 outline-none text-gray-700 bg-transparent text-sm" />
            <span className="text-gray-400">–</span>
            <input type="date" value={dateRange.end}   onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))}   className="border-0 outline-none text-gray-700 bg-transparent text-sm" />
          </div>

          {/* Dashboard switcher */}
          <div className="relative">
            <button
              onClick={() => setShowDashboards(v => !v)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {layout.isOrgDefault && <Crown className="w-3.5 h-3.5 text-amber-500" />}
              <span className="max-w-[140px] truncate">{layout.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {showDashboards && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                {personalLayouts.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">My Dashboards</div>
                    {personalLayouts.map(l => (
                      <button key={l.id} onClick={() => switchLayout(l)} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center gap-2 text-sm text-gray-700">
                        <LayoutGrid className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{l.name}</span>
                        {l.id === layout.id && <span className="ml-auto text-blue-600 text-xs">current</span>}
                      </button>
                    ))}
                  </>
                )}
                {sharedLayouts.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">Shared with Org</div>
                    {sharedLayouts.map(l => (
                      <button key={l.id} onClick={() => switchLayout(l)} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center gap-2 text-sm text-gray-700">
                        {l.isOrgDefault ? <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> : <Share2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                        <span className="truncate">{l.name}</span>
                        {l.id === layout.id && <span className="ml-auto text-blue-600 text-xs">current</span>}
                      </button>
                    ))}
                  </>
                )}
                <div className="border-t border-gray-100 px-3 py-2">
                  <button
                    onClick={() => { setLayout({ name: "New Dashboard", layoutType: "PERSONAL", isOrgDefault: false, createdById: userId, widgets: [] }); setShowDashboards(false); setEditMode(true); setShowTemplates(true) }}
                    className="w-full text-left text-sm text-blue-600 hover:text-blue-700 py-1 flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" /> New dashboard
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Edit mode controls */}
          {editMode && (
            <input
              value={layout.name}
              onChange={e => setLayout(l => ({ ...l, name: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
          )}

          {/* Action buttons */}
          <button onClick={handlePrint} title="Export to PDF" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {isAdmin && (
            <>
              <button onClick={() => { setShowReports(v => !v); setShowAlerts(false) }} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">Reports</span>
              </button>
              <button onClick={() => { setShowAlerts(v => !v); setShowReports(false) }} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Alerts</span>
              </button>
            </>
          )}

          {editMode ? (
            <>
              <button onClick={() => setShowTemplates(t => !t)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <LayoutGrid className="w-4 h-4" /> Templates
              </button>
              <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-2 px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors">
                <Plus className="w-4 h-4" /> Add Widget
              </button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors">
                {saveOk ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saveOk ? "Saved" : saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => { setEditMode(false); setShowAdd(false) }} className="p-2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {canEdit && (
                <button onClick={() => setEditMode(true)} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
              )}
              {/* Non-owner can save a personal copy */}
              {layout.id && !isOwnLayout && (
                <button onClick={savePersonalCopy} disabled={saving} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  <Copy className="w-4 h-4" /> Save Copy
                </button>
              )}
              {/* Admin: set as org default, delete */}
              {isAdmin && layout.id && !layout.isOrgDefault && (
                <button onClick={setAsOrgDefault} className="flex items-center gap-2 px-3 py-2 border border-amber-200 rounded-lg text-sm text-amber-700 hover:bg-amber-50 transition-colors">
                  <Crown className="w-4 h-4" /> Set as Org Default
                </button>
              )}
              {layout.id && isOwnLayout && (
                <button onClick={deleteLayout} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Delete dashboard">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>

        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm" data-no-print>{error}</div>}

        {/* Template picker */}
        {showTemplates && editMode && (
          <div className="bg-white border border-gray-200 rounded-xl p-5" data-no-print>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Choose a template</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map(t => (
                <button key={t.key} onClick={() => loadTemplate(t)} className="text-left p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <p className="font-medium text-gray-800 text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">{t.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{t.widgets.length} widgets</p>
                </button>
              ))}
              <button onClick={() => { setLayout(l => ({ ...l, widgets: [] })); setShowTemplates(false) }} className="text-left p-4 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 transition-colors">
                <p className="font-medium text-sm">Blank dashboard</p>
                <p className="text-xs mt-1">Start from scratch</p>
              </button>
            </div>
          </div>
        )}

        {/* Add widget panel */}
        {showAdd && editMode && (
          <div className="bg-white border border-gray-200 rounded-xl p-5" data-no-print>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Add a widget</h3>
            {Object.entries(metricsBySection).map(([section, metrics]) => (
              <div key={section} className="mb-4">
                {section && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{section}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {metrics.map(metric =>
                    metric.supportedVisualTypes.map(vt => (
                      <button
                        key={`${metric.key}-${vt}`}
                        onClick={() => addWidget(metric.key, vt)}
                        className="text-left p-3 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-800">{metric.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{vt.replace(/_/g, " ")}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reports panel (admin) */}
        {showReports && isAdmin && (
          <ReportsPanel
            reports={reports}
            loading={loadingExtra}
            layouts={orgLayouts}
            teamMembers={teamMembers}
            onToggle={toggleReport}
            onDelete={deleteReport}
            onCreated={(r) => setReports(rs => [r, ...rs])}
          />
        )}

        {/* Alerts panel (admin) */}
        {showAlerts && isAdmin && (
          <AlertsPanel
            alerts={alerts}
            loading={loadingExtra}
            teamMembers={teamMembers}
            onToggle={toggleAlert}
            onDelete={deleteAlert}
            onCreated={(a) => setAlerts(as => [a, ...as])}
          />
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
          <div className="grid grid-cols-3 gap-4 dashboard-grid">
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
    </>
  )
}

// ─── Widget wrapper ────────────────────────────────────────────────────────────

function WidgetWrapper({ config, dateRange, editMode, onRemove, onMoveLeft, onMoveRight }: {
  config: WidgetConfig; dateRange: { start: string; end: string }
  editMode?: boolean; onRemove?: (id: string) => void
  onMoveLeft?: () => void; onMoveRight?: () => void
}) {
  const colSpan = config.width === 3 ? "col-span-3" : config.width === 2 ? "col-span-2" : "col-span-1"
  return (
    <div className={colSpan}>
      <Widget config={config} dateRange={dateRange} editMode={editMode} onRemove={onRemove} />
      {editMode && (
        <div className="flex justify-end gap-1 mt-1">
          {onMoveLeft  && <button onClick={onMoveLeft}  className="text-xs text-gray-400 hover:text-gray-600 px-1">← move</button>}
          {onMoveRight && <button onClick={onMoveRight} className="text-xs text-gray-400 hover:text-gray-600 px-1">move →</button>}
        </div>
      )}
    </div>
  )
}

// ─── Reports panel ────────────────────────────────────────────────────────────

const FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY"]
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function ReportsPanel({ reports, loading, layouts, teamMembers, onToggle, onDelete, onCreated }: {
  reports: Report[]; loading: boolean; layouts: { id: string; name: string }[]
  teamMembers: TeamMember[]; onToggle: (id: string, v: boolean) => void
  onDelete: (id: string) => void; onCreated: (r: Report) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", dashboardLayoutId: "", frequency: "WEEKLY", dayOfWeek: 1, dayOfMonth: 1, sendTime: "06:00", recipients: [] as string[] })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)

  async function submit() {
    setSubmitting(true); setFormError(null)
    try {
      const res = await fetch("/api/analytics/reports", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      })
      if (!res.ok) { const b = await res.json(); setFormError(b.error ?? "Failed"); return }
      const created = await res.json() as Report
      onCreated(created)
      setShowForm(false)
      setForm({ name: "", dashboardLayoutId: "", frequency: "WEEKLY", dayOfWeek: 1, dayOfMonth: 1, sendTime: "06:00", recipients: [] })
    } finally { setSubmitting(false) }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5" data-no-print>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Scheduled Reports</h3>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 bg-blue-50 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Report
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 border border-gray-100 rounded-lg bg-gray-50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Report name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Weekly ops summary" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Dashboard</label>
              <select value={form.dashboardLayoutId} onChange={e => setForm(f => ({ ...f, dashboardLayoutId: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="">Select dashboard…</option>
                {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Frequency</label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {FREQUENCIES.map(f => <option key={f} value={f}>{f.charAt(0) + f.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            {form.frequency === "WEEKLY" && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Day of week</label>
                <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                  {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            {form.frequency === "MONTHLY" && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Day of month</label>
                <input type="number" min={1} max={31} value={form.dayOfMonth} onChange={e => setForm(f => ({ ...f, dayOfMonth: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Send time (UTC)</label>
              <input type="time" value={form.sendTime} onChange={e => setForm(f => ({ ...f, sendTime: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Recipients</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {teamMembers.map(m => (
                <label key={m.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.recipients.includes(m.id)} onChange={e => setForm(f => ({ ...f, recipients: e.target.checked ? [...f.recipients, m.id] : f.recipients.filter(id => id !== m.id) }))} className="rounded" />
                  {m.name}
                </label>
              ))}
            </div>
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {submitting ? "Creating…" : "Create Report"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {!loading && reports.length === 0 && !showForm && (
        <p className="text-sm text-gray-400">No scheduled reports yet. Create one to send dashboard snapshots by email.</p>
      )}
      <div className="space-y-2">
        {reports.map(r => (
          <div key={r.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
              <p className="text-xs text-gray-500">
                {r.frequency.charAt(0) + r.frequency.slice(1).toLowerCase()} · {r.sendTime} UTC
                {r.lastSentAt && ` · last sent ${new Date(r.lastSentAt).toLocaleDateString()}`}
              </p>
            </div>
            <button onClick={() => onToggle(r.id, !r.isActive)} className="text-gray-400 hover:text-gray-600">
              {r.isActive ? <ToggleRight className="w-5 h-5 text-blue-600" /> : <ToggleLeft className="w-5 h-5" />}
            </button>
            <button onClick={() => onDelete(r.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Alerts panel ─────────────────────────────────────────────────────────────

const CONDITIONS = [
  { value: "GREATER_THAN", label: "Greater than" },
  { value: "LESS_THAN",    label: "Less than" },
  { value: "EQUALS",       label: "Equals" },
]
const DATE_RANGES = ["7d", "14d", "30d", "60d", "90d"]
const SCALAR_METRICS = METRICS_CATALOG.filter(m => m.defaultVisualType === "KPI_CARD")

function AlertsPanel({ alerts, loading, teamMembers, onToggle, onDelete, onCreated }: {
  alerts: Alert[]; loading: boolean; teamMembers: TeamMember[]
  onToggle: (id: string, v: boolean) => void; onDelete: (id: string) => void
  onCreated: (a: Alert) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", metricKey: "issues.overdue", condition: "GREATER_THAN", threshold: 10, dateRange: "30d", notifyUserIds: [] as string[] })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)

  async function submit() {
    setSubmitting(true); setFormError(null)
    try {
      const res = await fetch("/api/analytics/alerts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      })
      if (!res.ok) { const b = await res.json(); setFormError(b.error ?? "Failed"); return }
      const created = await res.json() as Alert
      onCreated(created)
      setShowForm(false)
      setForm({ name: "", metricKey: "issues.overdue", condition: "GREATER_THAN", threshold: 10, dateRange: "30d", notifyUserIds: [] })
    } finally { setSubmitting(false) }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5" data-no-print>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Metric Alerts</h3>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 bg-blue-50 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Alert
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 border border-gray-100 rounded-lg bg-gray-50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Alert name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Overdue issues spike" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Metric</label>
              <select value={form.metricKey} onChange={e => setForm(f => ({ ...f, metricKey: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {SCALAR_METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Condition</label>
              <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Threshold</label>
              <input type="number" min={0} value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Date range</label>
              <select value={form.dateRange} onChange={e => setForm(f => ({ ...f, dateRange: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {DATE_RANGES.map(d => <option key={d} value={d}>Last {d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Notify</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {teamMembers.map(m => (
                <label key={m.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.notifyUserIds.includes(m.id)} onChange={e => setForm(f => ({ ...f, notifyUserIds: e.target.checked ? [...f.notifyUserIds, m.id] : f.notifyUserIds.filter(id => id !== m.id) }))} className="rounded" />
                  {m.name}
                </label>
              ))}
            </div>
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {submitting ? "Creating…" : "Create Alert"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {!loading && alerts.length === 0 && !showForm && (
        <p className="text-sm text-gray-400">No alerts configured. Alerts notify your team when a metric crosses a threshold.</p>
      )}
      <div className="space-y-2">
        {alerts.map(a => {
          const metric = SCALAR_METRICS.find(m => m.key === a.metricKey)
          const condLabel = CONDITIONS.find(c => c.value === a.condition)?.label ?? a.condition
          return (
            <div key={a.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${a.isActive ? "text-amber-500" : "text-gray-300"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                <p className="text-xs text-gray-500">
                  {metric?.label ?? a.metricKey} {condLabel} {a.threshold} · last {a.dateRange}
                  {a.lastTriggeredAt && (
                    <span className="ml-1 text-amber-600 flex items-center gap-0.5 inline-flex">
                      <Clock className="w-3 h-3" /> {new Date(a.lastTriggeredAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
              <button onClick={() => onToggle(a.id, !a.isActive)} className="text-gray-400 hover:text-gray-600">
                {a.isActive ? <ToggleRight className="w-5 h-5 text-blue-600" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => onDelete(a.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
