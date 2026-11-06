"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  MonitorDot, CheckCircle2, Circle, Mail, Briefcase,
  Calendar, Bell, AlertCircle, Clock, ArrowRight,
  RefreshCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string; title: string; taskType: string; priority: string; dueAt: string | null
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
  unreadEmails:       Email[]
  stuckOpportunities: Opportunity[]
  upcomingDemos:      DemoCall[]
  followUpsDue:       Email[]
}

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkspacePage() {
  const [data, setData]       = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/sales/workspace")
      if (res.ok) setData(await res.json() as WorkspaceData)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function completeTask(id: string) {
    setCompleting(id)
    try {
      await fetch(`/api/sales/tasks/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      })
      setData(d => !d ? d : {
        ...d,
        overdueTasks:  d.overdueTasks.filter(t => t.id !== id),
        tasksDueToday: d.tasksDueToday.filter(t => t.id !== id),
      })
    } finally { setCompleting(null) }
  }

  const now = new Date()
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening"
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  const totalActions = data
    ? data.overdueTasks.length + data.tasksDueToday.length + data.unreadEmails.length + data.followUpsDue.length
    : 0

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
        <div className="text-center py-16 text-gray-600">Loading your workspace…</div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Overdue Tasks",    value: data.overdueTasks.length,       color: data.overdueTasks.length  > 0 ? "text-red-400"    : "text-gray-500", bg: data.overdueTasks.length  > 0 ? "border-red-800/40"    : "border-gray-800" },
              { label: "Due Today",        value: data.tasksDueToday.length,      color: data.tasksDueToday.length > 0 ? "text-yellow-400"  : "text-gray-500", bg: "border-gray-800" },
              { label: "Unread Emails",    value: data.unreadEmails.length,       color: data.unreadEmails.length  > 0 ? "text-blue-400"    : "text-gray-500", bg: "border-gray-800" },
              { label: "Follow-ups Due",   value: data.followUpsDue.length,       color: data.followUpsDue.length  > 0 ? "text-orange-400"  : "text-gray-500", bg: "border-gray-800" },
            ].map(s => (
              <div key={s.label} className={cn("bg-gray-900 border rounded-xl p-3", s.bg)}>
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {totalActions === 0 && data.upcomingDemos.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-white font-medium">All clear!</p>
              <p className="text-gray-500 text-sm mt-1">No overdue tasks, unread emails, or follow-ups. Good work.</p>
            </div>
          )}

          {/* Overdue tasks */}
          {data.overdueTasks.length > 0 && (
            <Section title="Overdue Tasks" icon={<AlertCircle className="w-4 h-4 text-red-400" />} count={data.overdueTasks.length} accent="border-red-800/30" tourId="workspace-task-list">
              {data.overdueTasks.map(t => (
                <TaskRow key={t.id} task={t} completing={completing} onComplete={completeTask} />
              ))}
            </Section>
          )}

          {/* Due today */}
          {data.tasksDueToday.length > 0 && (
            <Section title="Due Today" icon={<Clock className="w-4 h-4 text-yellow-400" />} count={data.tasksDueToday.length} tourId="workspace-task-list">
              {data.tasksDueToday.map(t => (
                <TaskRow key={t.id} task={t} completing={completing} onComplete={completeTask} />
              ))}
            </Section>
          )}

          {/* Unread emails */}
          {data.unreadEmails.length > 0 && (
            <Section title="Unread Emails" icon={<Mail className="w-4 h-4 text-blue-400" />} count={data.unreadEmails.length}>
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
            </Section>
          )}

          {/* Follow-ups due */}
          {data.followUpsDue.length > 0 && (
            <Section title="Follow-ups Due" icon={<Bell className="w-4 h-4 text-orange-400" />} count={data.followUpsDue.length}>
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
                  </div>
                )
              })}
            </Section>
          )}

          {/* Upcoming demos */}
          {data.upcomingDemos.length > 0 && (
            <Section title="Upcoming Demos" icon={<Calendar className="w-4 h-4 text-purple-400" />} count={data.upcomingDemos.length}>
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
            </Section>
          )}

          {/* Stuck opportunities */}
          {data.stuckOpportunities.length > 0 && (
            <Section title="Needs Attention" icon={<Briefcase className="w-4 h-4 text-gray-400" />} count={data.stuckOpportunities.length}>
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
            </Section>
          )}
        </div>
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

function TaskRow({ task, completing, onComplete }: { task: Task; completing: string | null; onComplete: (id: string) => void }) {
  const company = taskCompanyName(task)
  const href    = taskCompanyHref(task)
  const dueStr  = task.dueAt ? fmtDate(task.dueAt) : null
  const isOverdue = task.dueAt && new Date(task.dueAt) < new Date()

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
      <button onClick={() => onComplete(task.id)} disabled={completing === task.id} className="mt-0.5 shrink-0">
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
      </div>
    </div>
  )
}
