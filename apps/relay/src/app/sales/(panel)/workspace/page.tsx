"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  MonitorDot, CheckCircle2, Circle, Mail, Briefcase,
  Calendar, Bell, AlertCircle, Clock, ArrowRight,
  RefreshCcw, ChevronDown, ChevronUp, X, Loader2, Search, SlidersHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string; title: string; taskType: string; priority: string; dueAt: string | null; completedAt?: string | null
  notes:       string | null
  prospect:    { id: string; companyName: string } | null
  demoCall:    { id: string; companyName: string } | null
  opportunity: { id: string; title: string } | null
  contact:     { id: string; name: string } | null
}

interface Email {
  id: string; subject: string; fromAddress: string; sentAt: string
  contactEmail: string | null; followUpDate?: string | null
  demoCall:  { id: string; companyName: string } | null
  prospect:  { id: string; companyName: string } | null
}

interface Opportunity {
  id: string; title: string; stage: string; value: string | null; updatedAt: string
  prospect: { id: string; companyName: string } | null
  demoCall: { id: string; companyName: string } | null
}

interface DemoCall {
  id: string; companyName: string; scheduledAt: string | null; callStatus: string
}

interface WorkspaceData {
  overdueTasks:       Task[]
  tasksDueToday:      Task[]
  upcomingTasks:      Task[]
  undatedTasks:       Task[]
  recentlyCompleted:  Task[]
  unreadEmails:       Email[]
  stuckOpportunities: Opportunity[]
  upcomingDemos:      DemoCall[]
  followUpsDue:       Email[]
}

interface CompleteDialogState {
  taskId: string
  taskTitle: string
  prospectId: string | null
}

type CardFilter = "overdue" | "dueToday" | "upcoming" | "unscheduled" | "emailFollowUps" | "unreadEmails" | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—"
  const date = new Date(d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff  = Math.floor((date.getTime() - today.getTime()) / 86400_000)
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  if (diff === -1) return "yesterday"
  if (diff < 0) return `${-diff}d overdue`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function taskCompanyName(t: Task) {
  return t.prospect?.companyName ?? t.demoCall?.companyName ?? null
}
function taskCompanyHref(t: Task) {
  if (t.prospect) return `/sales/prospects/${t.prospect.id}`
  if (t.demoCall) return `/sales/leads/${t.demoCall.id}`
  return null
}
function emailCompanyName(e: Email) {
  return e.prospect?.companyName ?? e.demoCall?.companyName ?? null
}
function emailCompanyHref(e: Email) {
  if (e.prospect) return `/sales/prospects/${e.prospect.id}`
  if (e.demoCall) return `/sales/leads/${e.demoCall.id}`
  return null
}

// ─── Complete Dialog ───────────────────────────────────────────────────────────

const OUTCOME_OPTIONS = [
  { value: "", label: "— Select outcome (optional) —" },
  { value: "connected", label: "Connected / Spoke with contact" },
  { value: "left_voicemail", label: "Left voicemail" },
  { value: "no_answer", label: "No answer" },
  { value: "meeting_scheduled", label: "Meeting scheduled" },
  { value: "email_sent", label: "Sent email / follow-up" },
  { value: "not_interested", label: "Not interested" },
  { value: "completed", label: "Completed / Done" },
]

function CompleteDialog({
  state,
  onClose,
  onComplete,
}: {
  state: CompleteDialogState
  onClose: () => void
  onComplete: (taskId: string, outcome: string, notes: string) => void
}) {
  const [outcome, setOutcome] = useState("")
  const [notes, setNotes]     = useState("")
  const [saving, setSaving]   = useState(false)

  async function handleComplete(logActivity: boolean) {
    setSaving(true)
    await onComplete(state.taskId, logActivity ? outcome : "", logActivity ? notes : "")
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">Complete task</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-gray-400 truncate">{state.taskTitle}</p>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">What happened? (optional)</label>
            <select
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
            >
              {OUTCOME_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any details worth noting…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-4">
          <button
            onClick={() => handleComplete(false)}
            disabled={saving}
            className="flex-1 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Skip &amp; complete
          </button>
          <button
            onClick={() => handleComplete(!!(outcome || notes))}
            disabled={saving}
            className="flex-1 px-3 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            {outcome || notes ? "Complete + log" : "Mark complete"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkspacePage() {
  const [data, setData]       = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [reopening, setReopening]     = useState<string | null>(null)
  const [completing, setCompleting]   = useState<string | null>(null)
  const [completeDialog, setCompleteDialog] = useState<CompleteDialogState | null>(null)

  // Collapsible sections
  const [showCompleted, setShowCompleted] = useState(false)
  const [showOther, setShowOther]         = useState(true)

  // Filters (D + E)
  const [cardFilter, setCardFilter] = useState<CardFilter>(null)
  const [typeFilter, setTypeFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/sales/workspace")
      if (res.ok) setData(await res.json() as WorkspaceData)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openCompleteDialog(task: Task) {
    setCompleteDialog({
      taskId: task.id,
      taskTitle: task.title,
      prospectId: task.prospect?.id ?? null,
    })
  }

  async function completeTask(taskId: string, outcome: string, notes: string) {
    setCompleting(taskId)
    try {
      const res = await fetch(`/api/sales/tasks/${taskId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true, outcome: outcome || undefined, completionNotes: notes || undefined }),
      })
      if (res.ok) {
        const updated = await res.json() as Task
        setData(d => !d ? d : {
          ...d,
          overdueTasks:      d.overdueTasks.filter(t => t.id !== taskId),
          tasksDueToday:     d.tasksDueToday.filter(t => t.id !== taskId),
          upcomingTasks:     d.upcomingTasks.filter(t => t.id !== taskId),
          undatedTasks:      d.undatedTasks.filter(t => t.id !== taskId),
          recentlyCompleted: [updated, ...d.recentlyCompleted],
        })
      }
    } finally { setCompleting(null) }
  }

  async function reopenTask(id: string) {
    setReopening(id)
    try {
      const res = await fetch(`/api/sales/tasks/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: false }),
      })
      if (res.ok) {
        const updated = await res.json() as Task
        setData(d => !d ? d : {
          ...d,
          recentlyCompleted: d.recentlyCompleted.filter(t => t.id !== id),
          undatedTasks: updated.dueAt ? d.undatedTasks : [updated, ...d.undatedTasks],
          upcomingTasks: updated.dueAt && new Date(updated.dueAt) > new Date() ? [updated, ...d.upcomingTasks] : d.upcomingTasks,
        })
      }
    } finally { setReopening(null) }
  }

  const now = new Date()
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening"
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  function taskMatchesFilters(t: Task): boolean {
    if (typeFilter && t.taskType !== typeFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (
        !t.title.toLowerCase().includes(q) &&
        !(taskCompanyName(t) ?? "").toLowerCase().includes(q) &&
        !(t.contact?.name ?? "").toLowerCase().includes(q) &&
        !(t.notes ?? "").toLowerCase().includes(q)
      ) return false
    }
    return true
  }

  function emailMatchesSearch(e: Email): boolean {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      e.subject.toLowerCase().includes(q) ||
      (emailCompanyName(e) ?? "").toLowerCase().includes(q) ||
      (e.contactEmail ?? "").toLowerCase().includes(q)
    )
  }

  const fOverdue   = data?.overdueTasks.filter(taskMatchesFilters)   ?? []
  const fToday     = data?.tasksDueToday.filter(taskMatchesFilters)   ?? []
  const fUpcoming  = data?.upcomingTasks.filter(taskMatchesFilters)   ?? []
  const fUndated   = data?.undatedTasks.filter(taskMatchesFilters)    ?? []
  const fFollowUps = data?.followUpsDue.filter(emailMatchesSearch)    ?? []
  const fUnread    = data?.unreadEmails.filter(emailMatchesSearch)    ?? []

  const scheduledTasks = data
    ? [...data.overdueTasks, ...data.tasksDueToday, ...data.upcomingTasks]
    : []

  const totalActions = data
    ? scheduledTasks.length + data.undatedTasks.length + data.unreadEmails.length + data.followUpsDue.length
    : 0

  const hasFilters = !!(cardFilter || typeFilter || searchQuery)
  const anyFilterResult = fOverdue.length + fToday.length + fUpcoming.length + fUndated.length + fFollowUps.length + fUnread.length

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div data-tour="workspace-header" className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MonitorDot className="w-5 h-5 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white">{greeting}</h1>
          </div>
          <p className="text-gray-500 text-sm">{dateStr}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm text-gray-400 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCcw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {loading && !data && (
        <div className="text-center py-16 text-gray-600">Loading…</div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Summary row — clickable cards (Work Package D) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {([
              { key: "overdue"       as CardFilter, label: "Overdue",          value: data.overdueTasks.length,   color: data.overdueTasks.length  > 0 ? "text-red-400"    : "text-gray-500", border: data.overdueTasks.length  > 0 ? "border-red-800/40"    : "border-gray-800" },
              { key: "dueToday"      as CardFilter, label: "Due Today",        value: data.tasksDueToday.length,  color: data.tasksDueToday.length > 0 ? "text-yellow-400"  : "text-gray-500", border: "border-gray-800" },
              { key: "upcoming"      as CardFilter, label: "Upcoming",         value: data.upcomingTasks.length,  color: data.upcomingTasks.length > 0 ? "text-indigo-400"  : "text-gray-500", border: "border-gray-800" },
              { key: "unscheduled"   as CardFilter, label: "Unscheduled",      value: data.undatedTasks.length,   color: data.undatedTasks.length  > 0 ? "text-purple-400"  : "text-gray-500", border: "border-gray-800" },
              { key: "emailFollowUps"as CardFilter, label: "Email Follow-Ups", value: data.followUpsDue.length,   color: data.followUpsDue.length  > 0 ? "text-orange-400"  : "text-gray-500", border: "border-gray-800" },
              { key: "unreadEmails"  as CardFilter, label: "Unread Emails",    value: data.unreadEmails.length,   color: data.unreadEmails.length  > 0 ? "text-blue-400"    : "text-gray-500", border: "border-gray-800" },
            ] as const).map(s => {
              const isActive = cardFilter === s.key
              return (
                <button
                  key={s.label}
                  onClick={() => setCardFilter(prev => prev === s.key ? null : s.key)}
                  className={cn(
                    "bg-gray-900 border rounded-xl p-3 text-left transition-colors",
                    isActive ? "border-indigo-500 ring-1 ring-indigo-500/30" : cn(s.border, "hover:border-gray-600"),
                  )}
                >
                  <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </button>
              )
            })}
          </div>

          {/* Filter bar (Work Package E) */}
          <div className="flex items-center gap-2 flex-wrap">
            {cardFilter && (
              <button
                onClick={() => setCardFilter(null)}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-900/30 text-indigo-300 border border-indigo-700/40 hover:bg-indigo-900/50 transition-colors"
              >
                <X className="w-3 h-3" /> All
              </button>
            )}
            <div className="relative flex-shrink-0">
              <SlidersHorizontal className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
              >
                <option value="">All Types</option>
                <option value="call">Phone Call</option>
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
                <option value="meeting">Meeting</option>
                <option value="other">General Task</option>
              </select>
            </div>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tasks…"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            {(typeFilter || searchQuery) && (
              <button
                onClick={() => { setTypeFilter(""); setSearchQuery("") }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {totalActions === 0 && data.upcomingDemos.length === 0 && !hasFilters && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-white font-medium">All clear!</p>
              <p className="text-gray-500 text-sm mt-1">No overdue tasks, unread emails, or follow-ups. Good work.</p>
            </div>
          )}

          {/* ── Filtered view (card or search/type filter active) ─────────────── */}
          {hasFilters && (
            <>
              {anyFilterResult === 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
                  <p className="text-gray-500 text-sm">No items match the current filters.</p>
                </div>
              )}
              {(!cardFilter || cardFilter === "overdue") && fOverdue.length > 0 && (
                <Section title="Overdue" icon={<AlertCircle className="w-4 h-4 text-red-400" />} count={fOverdue.length} accent="border-red-800/40" tourId="workspace-task-list">
                  {fOverdue.map(t => <TaskRow key={t.id} task={t} completing={completing} onComplete={() => openCompleteDialog(t)} />)}
                </Section>
              )}
              {(!cardFilter || cardFilter === "dueToday") && fToday.length > 0 && (
                <Section title="Due Today" icon={<Clock className="w-4 h-4 text-yellow-400" />} count={fToday.length}>
                  {fToday.map(t => <TaskRow key={t.id} task={t} completing={completing} onComplete={() => openCompleteDialog(t)} />)}
                </Section>
              )}
              {(!cardFilter || cardFilter === "upcoming") && fUpcoming.length > 0 && (
                <Section title="Upcoming" icon={<Clock className="w-4 h-4 text-indigo-400" />} count={fUpcoming.length}>
                  {fUpcoming.map(t => <TaskRow key={t.id} task={t} completing={completing} onComplete={() => openCompleteDialog(t)} />)}
                </Section>
              )}
              {(!cardFilter || cardFilter === "unscheduled") && fUndated.length > 0 && (
                <Section title="Unscheduled" icon={<Clock className="w-4 h-4 text-purple-400" />} count={fUndated.length}>
                  {fUndated.map(t => <TaskRow key={t.id} task={t} completing={completing} onComplete={() => openCompleteDialog(t)} />)}
                </Section>
              )}
              {(!cardFilter || cardFilter === "emailFollowUps") && fFollowUps.length > 0 && (
                <Section title="Email Follow-Ups" icon={<Bell className="w-4 h-4 text-orange-400" />} count={fFollowUps.length}>
                  {fFollowUps.map(e => {
                    const company = emailCompanyName(e); const href = emailCompanyHref(e)
                    return (
                      <div key={e.id} className="flex items-start gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
                        <Bell className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{e.subject}</p>
                          <p className="text-xs text-gray-500">Due {fmtDate(e.followUpDate ?? null)}{company && href && <> · <Link href={href} className="text-indigo-400 hover:underline">{company}</Link></>}</p>
                        </div>
                        <Link href={href ?? "/sales/outreach/follow-ups"} className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5">View <ArrowRight className="w-3 h-3" /></Link>
                      </div>
                    )
                  })}
                </Section>
              )}
              {(!cardFilter || cardFilter === "unreadEmails") && fUnread.length > 0 && (
                <Section title="Unread Emails" icon={<Mail className="w-4 h-4 text-blue-400" />} count={fUnread.length}>
                  {fUnread.map(e => {
                    const company = emailCompanyName(e); const href = emailCompanyHref(e)
                    return (
                      <div key={e.id} className="flex items-start gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
                        <Mail className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{e.subject}</p>
                          <p className="text-xs text-gray-500 truncate">{e.fromAddress}{company && href && <> · <Link href={href} className="text-indigo-400 hover:underline">{company}</Link></>}</p>
                        </div>
                        <Link href="/sales/outreach/email" className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5">View <ArrowRight className="w-3 h-3" /></Link>
                      </div>
                    )
                  })}
                </Section>
              )}
            </>
          )}

          {/* ── Unfiltered sections ───────────────────────────────────────────── */}
          {!hasFilters && (<>

          {/* ── Scheduled Tasks ─────────────────────────────────────────────── */}
          {scheduledTasks.length > 0 && (
            <Section
              title="Scheduled Tasks"
              icon={<Clock className="w-4 h-4 text-indigo-400" />}
              count={scheduledTasks.length}
              tourId="workspace-task-list"
            >
              {data.overdueTasks.length > 0 && (
                <div className="pt-2 pb-1">
                  <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest px-0.5 mb-1">Overdue</p>
                  {data.overdueTasks.map(t => (
                    <TaskRow key={t.id} task={t} completing={completing} onComplete={() => openCompleteDialog(t)} />
                  ))}
                </div>
              )}
              {data.tasksDueToday.length > 0 && (
                <div className={cn("pb-1", data.overdueTasks.length > 0 && "pt-2 border-t border-gray-800/60 mt-1")}>
                  <p className="text-[10px] font-semibold text-yellow-400 uppercase tracking-widest px-0.5 mb-1">Due Today</p>
                  {data.tasksDueToday.map(t => (
                    <TaskRow key={t.id} task={t} completing={completing} onComplete={() => openCompleteDialog(t)} />
                  ))}
                </div>
              )}
              {data.upcomingTasks.length > 0 && (
                <div className={cn("pb-1", (data.overdueTasks.length > 0 || data.tasksDueToday.length > 0) && "pt-2 border-t border-gray-800/60 mt-1")}>
                  <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest px-0.5 mb-1">Upcoming</p>
                  {data.upcomingTasks.map(t => (
                    <TaskRow key={t.id} task={t} completing={completing} onComplete={() => openCompleteDialog(t)} />
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* ── Email Follow-Ups ─────────────────────────────────────────────── */}
          {data.followUpsDue.length > 0 && (
            <Section title="Email Follow-Ups" icon={<Bell className="w-4 h-4 text-orange-400" />} count={data.followUpsDue.length}>
              {data.followUpsDue.map(e => {
                const company = emailCompanyName(e)
                const href    = emailCompanyHref(e)
                return (
                  <div key={e.id} className="flex items-start gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
                    <Bell className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{e.subject}</p>
                      <p className="text-xs text-gray-500">
                        Due {fmtDate(e.followUpDate ?? null)}
                        {company && href && <> · <Link href={href} className="text-indigo-400 hover:underline">{company}</Link></>}
                      </p>
                    </div>
                    <Link href={href ?? "/sales/outreach/follow-ups"} className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5">
                      View <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )
              })}
            </Section>
          )}

          {/* ── Other ────────────────────────────────────────────────────────── */}
          {(data.undatedTasks.length > 0 || data.unreadEmails.length > 0 || data.upcomingDemos.length > 0 || data.stuckOpportunities.length > 0) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowOther(v => !v)}
                className="w-full flex items-center gap-2 px-4 py-3 border-b border-gray-800 hover:bg-gray-800/40 transition-colors"
              >
                <Briefcase className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-white text-sm flex-1 text-left">Other</h2>
                <span className="text-xs text-gray-500 mr-2">
                  {data.undatedTasks.length + data.unreadEmails.length + data.upcomingDemos.length + data.stuckOpportunities.length}
                </span>
                {showOther ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              {showOther && (
                <div className="px-4">
                  {/* Unscheduled tasks */}
                  {data.undatedTasks.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest px-0.5 mt-3 mb-1">Unscheduled Tasks</p>
                      {data.undatedTasks.map(t => (
                        <TaskRow key={t.id} task={t} completing={completing} onComplete={() => openCompleteDialog(t)} />
                      ))}
                    </>
                  )}

                  {/* Unread emails */}
                  {data.unreadEmails.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest px-0.5 mt-3 mb-1">Unread Emails</p>
                      {data.unreadEmails.map(e => {
                        const company = emailCompanyName(e)
                        const href    = emailCompanyHref(e)
                        return (
                          <div key={e.id} className="flex items-start gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
                            <Mail className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{e.subject}</p>
                              <p className="text-xs text-gray-500 truncate">
                                {e.fromAddress}
                                {company && href && <> · <Link href={href} className="text-indigo-400 hover:underline">{company}</Link></>}
                              </p>
                            </div>
                            <Link href="/sales/outreach/email" className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5">
                              View <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        )
                      })}
                    </>
                  )}

                  {/* Upcoming demos */}
                  {data.upcomingDemos.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest px-0.5 mt-3 mb-1">Upcoming Demos</p>
                      {data.upcomingDemos.map(d => (
                        <div key={d.id} className="flex items-center gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
                          <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">{d.companyName}</p>
                            <p className="text-xs text-gray-500">{d.scheduledAt ? fmtDate(d.scheduledAt) : "No time set"} · {d.callStatus}</p>
                          </div>
                          <Link href={`/sales/leads/${d.id}`} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5">
                            View <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Stuck opportunities */}
                  {data.stuckOpportunities.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-0.5 mt-3 mb-1">Needs Attention</p>
                      {data.stuckOpportunities.map(o => {
                        const company = o.prospect?.companyName ?? o.demoCall?.companyName ?? null
                        const href    = o.prospect ? `/sales/prospects/${o.prospect.id}` : o.demoCall ? `/sales/leads/${o.demoCall.id}` : null
                        const days    = Math.floor((now.getTime() - new Date(o.updatedAt).getTime()) / 86400_000)
                        return (
                          <div key={o.id} className="flex items-center gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
                            <Briefcase className="w-4 h-4 text-gray-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white">{o.title}</p>
                              <p className="text-xs text-gray-500">
                                {o.stage}
                                {o.value && ` · $${Number(o.value).toLocaleString()}`}
                                {company && href && <> · <Link href={href} className="text-indigo-400 hover:underline">{company}</Link></>}
                                {` · no activity ${days}d`}
                              </p>
                            </div>
                            <Link href={`/sales/opportunities/${o.id}`} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5">
                              View <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        )
                      })}
                    </>
                  )}

                  <div className="pb-2" />
                </div>
              )}
            </div>
          )}
          </>
          )}

          {/* ── Recently Completed ───────────────────────────────────────────── */}
          {data.recentlyCompleted.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowCompleted(v => !v)}
                className="w-full flex items-center gap-2 px-4 py-3 border-b border-gray-800 hover:bg-gray-800/40 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h2 className="font-semibold text-white text-sm flex-1 text-left">Recently Completed</h2>
                <span className="text-xs text-gray-500 mr-2">{data.recentlyCompleted.length}</span>
                {showCompleted ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              {showCompleted && (
                <div className="px-4">
                  {data.recentlyCompleted.map(t => {
                    const company = taskCompanyName(t)
                    const href    = taskCompanyHref(t)
                    return (
                      <div key={t.id} className="flex items-start gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-500 line-through truncate">{t.title}</p>
                          <p className="text-xs text-gray-600">
                            {t.taskType}
                            {company && href && <> · <Link href={href} className="text-indigo-400 hover:underline">{company}</Link></>}
                            {t.contact && <> · {t.contact.name}</>}
                          </p>
                        </div>
                        <button
                          onClick={() => reopenTask(t.id)}
                          disabled={reopening === t.id}
                          className="shrink-0 text-xs text-gray-500 hover:text-indigo-400 disabled:opacity-50 transition-colors"
                        >Reopen</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Complete dialog */}
      {completeDialog && (
        <CompleteDialog
          state={completeDialog}
          onClose={() => setCompleteDialog(null)}
          onComplete={async (taskId, outcome, notes) => {
            await completeTask(taskId, outcome, notes)
          }}
        />
      )}
    </div>
  )
}

function Section({ title, icon, count, accent, tourId, children }: {
  title: string; icon: React.ReactNode; count: number; accent?: string; tourId?: string; children: React.ReactNode
}) {
  return (
    <div data-tour={tourId} className={cn("bg-gray-900 border rounded-xl overflow-hidden", accent ?? "border-gray-800")}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        {icon}
        <h2 className="font-semibold text-white text-sm">{title}</h2>
        <span className="ml-auto text-xs text-gray-500">{count}</span>
      </div>
      <div className="px-4">{children}</div>
    </div>
  )
}

function TaskRow({ task, completing, onComplete }: { task: Task; completing: string | null; onComplete: () => void }) {
  const company = taskCompanyName(task)
  const href    = taskCompanyHref(task)
  const dueStr  = task.dueAt ? fmtDate(task.dueAt) : null
  const isOverdue = task.dueAt && new Date(task.dueAt) < new Date()

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
      <button onClick={onComplete} disabled={completing === task.id} className="mt-0.5 shrink-0">
        {completing === task.id
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-pulse" />
          : <Circle className={cn("w-4 h-4", isOverdue ? "text-red-500" : "text-gray-600 hover:text-indigo-400")} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{task.title}</p>
        <p className="text-xs text-gray-500">
          {task.taskType}{task.priority !== "normal" && ` · ${task.priority}`}
          {dueStr && <span className={cn("ml-1", isOverdue ? "text-red-400" : "text-gray-500")}> · {dueStr}</span>}
          {company && href && <> · <Link href={href} className="text-indigo-400 hover:underline">{company}</Link></>}
          {task.contact && <> · {task.contact.name}</>}
        </p>
        {task.notes && <p className="text-xs text-gray-600 mt-0.5 italic truncate">{task.notes}</p>}
      </div>
    </div>
  )
}
