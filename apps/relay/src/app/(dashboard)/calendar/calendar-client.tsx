"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Plus, Calendar, Wrench, X, Loader2, Copy, Check, ExternalLink } from "lucide-react"
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, parseISO, addMonths, subMonths,
  startOfWeek, endOfWeek,
} from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

interface IssueItem {
  id: string
  title: string
  dueDate: string
  priority: string
  status: string
  category: string
  assignedTo: { id: string; name: string } | null
}

interface ScheduleItem {
  id: string
  title: string
  description: string | null
  recurrence: string
  nextDueAt: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  location: { id: string; name: string } | null
  assignedTo: { id: string; name: string } | null
}

interface Props {
  issues: IssueItem[]
  schedules: ScheduleItem[]
  locations: Array<{ id: string; name: string }>
  users: Array<{ id: string; name: string }>
  isAdminLevel: boolean
  userId: string
  calendarToken: string | null
  appUrl: string
}

const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH:     "bg-orange-400",
  MEDIUM:   "bg-yellow-400",
  LOW:      "bg-green-400",
}

const RECURRENCE_OPTIONS = [
  { value: "once",      label: "Once" },
  { value: "weekly",    label: "Weekly" },
  { value: "monthly",   label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly",    label: "Yearly" },
]

// ─── Day cell ─────────────────────────────────────────────────────────────────

function DayCell({
  day, currentMonth, issues, schedules, today, onSelect,
}: {
  day: Date
  currentMonth: Date
  issues: IssueItem[]
  schedules: ScheduleItem[]
  today: Date
  onSelect: (day: Date) => void
}) {
  const isCurrentMonth = isSameMonth(day, currentMonth)
  const isToday = isSameDay(day, today)
  const hasItems = issues.length > 0 || schedules.length > 0

  return (
    <button
      onClick={() => hasItems && onSelect(day)}
      className={`min-h-[80px] p-1.5 text-left border-r border-b border-gray-100 transition-colors ${
        isCurrentMonth ? "bg-white" : "bg-gray-50"
      } ${hasItems ? "hover:bg-blue-50 cursor-pointer" : "cursor-default"}`}
    >
      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
        isToday ? "bg-blue-600 text-white" : isCurrentMonth ? "text-gray-900" : "text-gray-400"
      }`}>
        {format(day, "d")}
      </div>
      <div className="space-y-0.5">
        {issues.slice(0, 2).map(issue => (
          <div
            key={issue.id}
            className="flex items-center gap-1 text-xs truncate"
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[issue.priority] ?? "bg-gray-400"}`} />
            <span className="truncate text-gray-700">{issue.title}</span>
          </div>
        ))}
        {schedules.slice(0, issues.length < 2 ? 2 - issues.length : 0).map(s => (
          <div key={s.id} className="flex items-center gap-1 text-xs truncate">
            <Wrench className="w-2.5 h-2.5 text-purple-500 flex-shrink-0" />
            <span className="truncate text-purple-700">{s.title}</span>
          </div>
        ))}
        {(issues.length + schedules.length) > 2 && (
          <div className="text-xs text-gray-400">+{issues.length + schedules.length - 2} more</div>
        )}
      </div>
    </button>
  )
}

// ─── Day detail modal ─────────────────────────────────────────────────────────

function DayModal({
  day, issues, schedules, onClose, router,
}: {
  day: Date
  issues: IssueItem[]
  schedules: ScheduleItem[]
  onClose: () => void
  router: ReturnType<typeof useRouter>
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{format(day, "EEEE, MMMM d, yyyy")}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto space-y-3">
          {issues.map(issue => (
            <button
              key={issue.id}
              onClick={() => { onClose(); router.push(`/issues/${issue.id}`) }}
              className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[issue.priority] ?? "bg-gray-400"}`} />
                <span className="text-xs text-gray-500 font-medium">{issue.priority} · {issue.status}</span>
              </div>
              <p className="text-sm font-medium text-gray-900">{issue.title}</p>
              {issue.assignedTo && (
                <p className="text-xs text-gray-500 mt-1">Assigned to {issue.assignedTo.name}</p>
              )}
            </button>
          ))}
          {schedules.map(s => (
            <div key={s.id} className="p-3 rounded-xl border border-purple-200 bg-purple-50">
              <div className="flex items-center gap-2 mb-1">
                <Wrench className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-xs text-purple-600 font-medium">Maintenance · {s.recurrence}</span>
              </div>
              <p className="text-sm font-medium text-purple-900">{s.title}</p>
              {s.description && <p className="text-xs text-purple-700 mt-1">{s.description}</p>}
              {s.location && <p className="text-xs text-purple-500 mt-1">{s.location.name}</p>}
              {s.assignedTo && <p className="text-xs text-purple-500">{s.assignedTo.name}</p>}
            </div>
          ))}
          {issues.length === 0 && schedules.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Nothing scheduled</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Maintenance Modal ────────────────────────────────────────────────────

function AddMaintenanceModal({
  locations, users, defaultDate, onClose, onAdded,
}: {
  locations: Array<{ id: string; name: string }>
  users: Array<{ id: string; name: string }>
  defaultDate: Date
  onClose: () => void
  onAdded: (schedule: ScheduleItem) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [recurrence, setRecurrence] = useState("once")
  const [nextDueAt, setNextDueAt] = useState(format(defaultDate, "yyyy-MM-dd"))
  const [locationId, setLocationId] = useState("")
  const [assignedToId, setAssignedToId] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function save() {
    if (!title.trim()) { setError("Title is required"); return }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          recurrence,
          nextDueAt: new Date(nextDueAt + "T00:00:00").toISOString(),
          locationId: locationId || null,
          assignedToId: assignedToId || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string }
        setError(j.error ?? "Failed to save")
        return
      }
      const data = await res.json() as ScheduleItem
      onAdded(data)
      onClose()
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const selectCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Schedule Maintenance</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. HVAC filter replacement" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea className={inputCls} value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Optional details" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Due date</label>
              <input type="date" className={inputCls} value={nextDueAt} onChange={e => setNextDueAt(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Recurrence</label>
              <select className={selectCls} value={recurrence} onChange={e => setRecurrence(e.target.value)}>
                {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {locations.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
              <select className={selectCls} value={locationId} onChange={e => setLocationId(e.target.value)}>
                <option value="">Any location</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}

          {users.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assign to</label>
              <select className={selectCls} value={assignedToId} onChange={e => setAssignedToId(e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Feed URL panel ───────────────────────────────────────────────────────────

function FeedPanel({ calendarToken, appUrl, onTokenChange }: {
  calendarToken: string | null
  appUrl: string
  onTokenChange: (token: string | null) => void
}) {
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const feedUrl = calendarToken
    ? `${appUrl}/api/calendar/feed?token=${calendarToken}`
    : null
  const webcalUrl = feedUrl?.replace(/^https?:\/\//, "webcal://")

  async function generateToken() {
    setLoading(true)
    try {
      const res = await fetch("/api/calendar/token", { method: "POST" })
      if (res.ok) {
        const data = await res.json() as { token: string }
        onTokenChange(data.token)
      }
    } finally { setLoading(false) }
  }

  async function revokeToken() {
    setLoading(true)
    try {
      await fetch("/api/calendar/token", { method: "DELETE" })
      onTokenChange(null)
    } finally { setLoading(false) }
  }

  function copy() {
    if (feedUrl) {
      navigator.clipboard.writeText(feedUrl).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
      <h3 className="font-medium text-gray-900 mb-1">Subscribe to your calendar</h3>
      <p className="text-xs text-gray-500 mb-3">Add your assigned issues and maintenance tasks to Google Calendar, Apple Calendar, or Outlook.</p>
      {feedUrl ? (
        <>
          <div className="flex items-center gap-2 mb-3">
            <input readOnly value={feedUrl} className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 truncate" />
            <button onClick={copy} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {webcalUrl && (
              <a
                href={webcalUrl}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Subscribe (webcal)
              </a>
            )}
            <button
              onClick={revokeToken}
              disabled={loading}
              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
            >
              Revoke link
            </button>
          </div>
        </>
      ) : (
        <button
          onClick={generateToken}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Generate feed URL
        </button>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CalendarClient({
  issues, schedules: initialSchedules, locations, users,
  isAdminLevel, calendarToken: initialToken, appUrl,
}: Props) {
  const router = useRouter()
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(today))
  const [schedules, setSchedules] = useState(initialSchedules)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [token, setToken] = useState(initialToken)
  const [addDefaultDate, setAddDefaultDate] = useState(today)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const issuesByDay = useCallback((day: Date) =>
    issues.filter(i => isSameDay(parseISO(i.dueDate), day)),
    [issues])

  const schedulesByDay = useCallback((day: Date) =>
    schedules.filter(s => isSameDay(parseISO(s.nextDueAt), day)),
    [schedules])

  const selectedIssues = selectedDay ? issuesByDay(selectedDay) : []
  const selectedSchedules = selectedDay ? schedulesByDay(selectedDay) : []

  function handleAddMaintenance(defaultDay?: Date) {
    setAddDefaultDate(defaultDay ?? today)
    setShowAddModal(true)
  }

  function handleAdded(schedule: ScheduleItem) {
    setSchedules(prev => [...prev, schedule])
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 min-w-[160px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <button
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(startOfMonth(today))}
            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isAdminLevel && (
            <button
              onClick={() => handleAddMaintenance()}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Schedule maintenance
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Critical issue</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400" /> High issue</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Medium issue</div>
        <div className="flex items-center gap-1.5"><Wrench className="w-3 h-3 text-purple-500" /> Maintenance</div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="text-xs font-medium text-gray-500 text-center py-2 border-r border-gray-100 last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => (
            <DayCell
              key={idx}
              day={day}
              currentMonth={currentMonth}
              issues={issuesByDay(day)}
              schedules={schedulesByDay(day)}
              today={today}
              onSelect={setSelectedDay}
            />
          ))}
        </div>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-gray-500">Issues due this month</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {issues.filter(i => isSameMonth(parseISO(i.dueDate), currentMonth)).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-medium text-gray-500">Maintenance this month</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {schedules.filter(s => isSameMonth(parseISO(s.nextDueAt), currentMonth)).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:col-span-1 col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Total active schedules</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{schedules.length}</p>
        </div>
      </div>

      {/* Calendar feed subscription */}
      <FeedPanel calendarToken={token} appUrl={appUrl} onTokenChange={setToken} />

      {/* Day detail modal */}
      {selectedDay && (
        <DayModal
          day={selectedDay}
          issues={selectedIssues}
          schedules={selectedSchedules}
          onClose={() => setSelectedDay(null)}
          router={router}
        />
      )}

      {/* Add maintenance modal */}
      {showAddModal && (
        <AddMaintenanceModal
          locations={locations}
          users={users}
          defaultDate={addDefaultDate}
          onClose={() => setShowAddModal(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}
