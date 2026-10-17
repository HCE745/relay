"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Download, ChevronDown, ChevronRight, Clock, Activity, Users, Monitor } from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

interface DayRow {
  salesUserId: string
  date: Date
  emailsSent: number
  followUpsWorked: number
  prospectsContacted: number
  prospectsAdded: number
  opportunitiesUpdated: number
  tasksCompleted: number
  timeInAppMinutes: number
  firstActivityAt: Date | null
  lastActivityAt: Date | null
}

interface SessionRow {
  id: string
  salesUserId: string
  loginAt: Date
  logoutAt: Date | null
  durationMinutes: number | null
  lastActivityAt: Date
  pagesVisited: unknown
}

interface RepSummary {
  user: { id: string; name: string; email: string; role: string }
  dailyActivity: DayRow[]
  sessions: SessionRow[]
  totals: {
    emailsSent: number
    followUpsWorked: number
    prospectsContacted: number
    prospectsAdded: number
    opportunitiesUpdated: number
    tasksCompleted: number
    timeInAppMinutes: number
  }
  insights: {
    daysActive: number
    avgStartHour: number | null
    avgEndHour: number | null
    longestSession: number
    bestDay: { date: Date; score: number } | null
    avgDailyHours: number
  }
}

interface Props {
  repSummaries: RepSummary[]
  period: string
  dateFrom: string
  dateTo: string
  customFrom?: string
  customTo?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtMins(m: number): string {
  if (m <= 0) return "—"
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}m`
  return min === 0 ? `${h}h` : `${h}h ${min}m`
}

function fmtHour(h: number | null): string {
  if (h === null) return "—"
  const hr = Math.floor(h)
  const min = Math.round((h - hr) * 60)
  const ampm = hr >= 12 ? "PM" : "AM"
  const disp = hr % 12 || 12
  return `${disp}:${min.toString().padStart(2, "0")} ${ampm}`
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function fmtTime(d: Date): string {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

const PERIOD_OPTIONS = [
  { label: "Today",         value: "today" },
  { label: "This Week",     value: "week" },
  { label: "This Month",    value: "month" },
  { label: "Last 30 Days",  value: "30days" },
  { label: "Custom Range",  value: "custom" },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function ActivityTable({ repSummaries, period, dateFrom, dateTo, customFrom, customTo }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<"overview" | "daily" | "sessions" | "comparison">("overview")
  const [expandedRep, setExpandedRep] = useState<string | null>(null)
  const [customFromVal, setCustomFromVal] = useState(customFrom ?? "")
  const [customToVal, setCustomToVal] = useState(customTo ?? "")

  function setPeriod(p: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("period", p)
    if (p !== "custom") {
      params.delete("from")
      params.delete("to")
    }
    startTransition(() => router.push(`/sales/manager/activity?${params.toString()}`))
  }

  function applyCustom() {
    if (!customFromVal || !customToVal) return
    const params = new URLSearchParams()
    params.set("period", "custom")
    params.set("from", customFromVal)
    params.set("to", customToVal)
    startTransition(() => router.push(`/sales/manager/activity?${params.toString()}`))
  }

  function exportCSV() {
    const rows: string[] = [
      "Name,Date,Emails Sent,Follow-Ups Worked,Prospects Contacted,Prospects Added,Opportunities Updated,Tasks Completed,Time In App (min),First Activity,Last Activity",
    ]
    for (const rep of repSummaries) {
      for (const day of rep.dailyActivity) {
        rows.push([
          rep.user.name,
          new Date(day.date).toLocaleDateString(),
          day.emailsSent,
          day.followUpsWorked,
          day.prospectsContacted,
          day.prospectsAdded,
          day.opportunitiesUpdated,
          day.tasksCompleted,
          day.timeInAppMinutes,
          day.firstActivityAt ? fmtTime(new Date(day.firstActivityAt)) : "",
          day.lastActivityAt ? fmtTime(new Date(day.lastActivityAt)) : "",
        ].join(","))
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `activity-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasAnyData = repSummaries.some(r => r.dailyActivity.length > 0 || r.sessions.length > 0)

  return (
    <div className="space-y-5">
      {/* Period selector + export */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                period === opt.value
                  ? "bg-emerald-600/20 text-emerald-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFromVal}
              onChange={e => setCustomFromVal(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
            />
            <span className="text-gray-500 text-xs">to</span>
            <input
              type="date"
              value={customToVal}
              onChange={e => setCustomToVal(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
            />
            <button
              onClick={applyCustom}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>
        )}
        <div className="flex-1" />
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800">
        {([
          { key: "overview",    label: "Summary",     icon: Users },
          { key: "daily",       label: "Daily Detail", icon: Activity },
          { key: "sessions",    label: "Session Log",  icon: Monitor },
          { key: "comparison",  label: "Comparison",   icon: Clock },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {!hasAnyData && (
        <div className="py-12 text-center text-gray-600 text-sm">
          No activity data for the selected period.
        </div>
      )}

      {/* ── Overview / Summary ── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {repSummaries.map(rep => {
            const t = rep.totals
            const ins = rep.insights
            const totalActions = t.emailsSent + t.followUpsWorked + t.prospectsContacted +
                                 t.prospectsAdded + t.opportunitiesUpdated + t.tasksCompleted
            return (
              <div key={rep.user.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedRep(expandedRep === rep.user.id ? null : rep.user.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-800/40 transition-colors"
                >
                  <div className="flex-1 text-left">
                    <p className="font-medium text-white text-sm">{rep.user.name}</p>
                    <p className="text-xs text-gray-500">{rep.user.role} · {ins.daysActive} active {ins.daysActive === 1 ? "day" : "days"}</p>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-sm font-semibold text-white">{fmtMins(t.timeInAppMinutes)}</p>
                      <p className="text-[10px] text-gray-500">in app</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{totalActions}</p>
                      <p className="text-[10px] text-gray-500">actions</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{fmtHour(ins.avgStartHour)}</p>
                      <p className="text-[10px] text-gray-500">avg start</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">{fmtHour(ins.avgEndHour)}</p>
                      <p className="text-[10px] text-gray-500">avg end</p>
                    </div>
                    {expandedRep === rep.user.id
                      ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                    }
                  </div>
                </button>

                {expandedRep === rep.user.id && (
                  <div className="border-t border-gray-800 px-5 py-4 space-y-4">
                    {/* Activity breakdown */}
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      {[
                        { label: "Emails Sent",      val: t.emailsSent },
                        { label: "Follow-Ups",        val: t.followUpsWorked },
                        { label: "Prospects Reached", val: t.prospectsContacted },
                        { label: "Prospects Added",   val: t.prospectsAdded },
                        { label: "Opps Updated",      val: t.opportunitiesUpdated },
                        { label: "Tasks Done",        val: t.tasksCompleted },
                      ].map(({ label, val }) => (
                        <div key={label} className="bg-gray-800/60 rounded-lg px-3 py-2.5">
                          <p className="text-lg font-bold text-white">{val}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                    {/* Working hours inference */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="bg-gray-800/40 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 mb-0.5">Avg daily hours in app</p>
                        <p className="font-semibold text-white">{ins.avgDailyHours.toFixed(1)}h</p>
                      </div>
                      <div className="bg-gray-800/40 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 mb-0.5">Longest session</p>
                        <p className="font-semibold text-white">{fmtMins(ins.longestSession)}</p>
                      </div>
                      <div className="bg-gray-800/40 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 mb-0.5">Most productive day</p>
                        <p className="font-semibold text-white text-xs">
                          {ins.bestDay ? fmtDate(ins.bestDay.date) : "—"}
                        </p>
                      </div>
                      <div className="bg-gray-800/40 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 mb-0.5">Sessions this period</p>
                        <p className="font-semibold text-white">{rep.sessions.length}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Daily Detail ── */}
      {activeTab === "daily" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500">
                  <th className="text-left px-4 py-3 font-medium">Rep</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-right px-4 py-3 font-medium">In App</th>
                  <th className="text-right px-4 py-3 font-medium">Emails</th>
                  <th className="text-right px-4 py-3 font-medium">Follow-Ups</th>
                  <th className="text-right px-4 py-3 font-medium">Prospects</th>
                  <th className="text-right px-4 py-3 font-medium">Opps</th>
                  <th className="text-right px-4 py-3 font-medium">Tasks</th>
                  <th className="text-right px-4 py-3 font-medium">First</th>
                  <th className="text-right px-4 py-3 font-medium">Last</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {repSummaries.flatMap(rep =>
                  rep.dailyActivity.map(day => (
                    <tr key={`${rep.user.id}-${String(day.date)}`} className="hover:bg-gray-800/30">
                      <td className="px-4 py-2.5 text-white font-medium">{rep.user.name}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{fmtDate(new Date(day.date))}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300 font-mono text-xs">{fmtMins(day.timeInAppMinutes)}</td>
                      <td className="px-4 py-2.5 text-right">{day.emailsSent > 0 ? <span className="text-blue-400">{day.emailsSent}</span> : <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-2.5 text-right">{day.followUpsWorked > 0 ? <span className="text-purple-400">{day.followUpsWorked}</span> : <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-2.5 text-right">{day.prospectsAdded + day.prospectsContacted > 0 ? <span className="text-emerald-400">{day.prospectsAdded + day.prospectsContacted}</span> : <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-2.5 text-right">{day.opportunitiesUpdated > 0 ? <span className="text-yellow-400">{day.opportunitiesUpdated}</span> : <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-2.5 text-right">{day.tasksCompleted > 0 ? <span className="text-orange-400">{day.tasksCompleted}</span> : <span className="text-gray-700">—</span>}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{day.firstActivityAt ? fmtTime(new Date(day.firstActivityAt)) : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{day.lastActivityAt ? fmtTime(new Date(day.lastActivityAt)) : "—"}</td>
                    </tr>
                  ))
                )}
                {repSummaries.every(r => r.dailyActivity.length === 0) && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-600">No daily activity records for this period</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Session Log ── */}
      {activeTab === "sessions" && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500">
                  <th className="text-left px-4 py-3 font-medium">Rep</th>
                  <th className="text-left px-4 py-3 font-medium">Login</th>
                  <th className="text-left px-4 py-3 font-medium">Logout</th>
                  <th className="text-right px-4 py-3 font-medium">Duration</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {repSummaries.flatMap(rep =>
                  rep.sessions.map(s => {
                    const isOpen = !s.logoutAt
                    const dur = s.durationMinutes
                      ?? (s.logoutAt
                        ? Math.round((new Date(s.logoutAt).getTime() - new Date(s.loginAt).getTime()) / 60000)
                        : Math.round((Date.now() - new Date(s.loginAt).getTime()) / 60000))
                    return (
                      <tr key={s.id} className="hover:bg-gray-800/30">
                        <td className="px-4 py-2.5 text-white font-medium">{rep.user.name}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">
                          <span className="text-gray-300">{fmtDate(new Date(s.loginAt))}</span>
                          {" "}{fmtTime(new Date(s.loginAt))}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">
                          {s.logoutAt ? (
                            <>{fmtDate(new Date(s.logoutAt))} {fmtTime(new Date(s.logoutAt))}</>
                          ) : (
                            <span className="text-emerald-400">Active now</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-300">{fmtMins(dur)}</td>
                        <td className="px-4 py-2.5">
                          {isOpen ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-900/30 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                              <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-600">Closed</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
                {repSummaries.every(r => r.sessions.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-600">No session records for this period</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Comparison ── */}
      {activeTab === "comparison" && (
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_repeat(7,_auto)] gap-0 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-800 text-xs font-medium text-gray-500">Rep</div>
            {["Time in App", "Emails", "Follow-Ups", "Prospects", "Opps", "Tasks", "Days Active"].map(h => (
              <div key={h} className="px-3 py-3 border-b border-gray-800 text-xs font-medium text-gray-500 text-right">{h}</div>
            ))}
            {/* Rows */}
            {repSummaries.map((rep, i) => {
              const t = rep.totals
              const ins = rep.insights
              return (
                <div key={rep.user.id} className={`contents ${i % 2 === 1 ? "bg-gray-800/20" : ""}`}>
                  <div className="px-4 py-3 border-b border-gray-800/60">
                    <p className="text-sm font-medium text-white">{rep.user.name}</p>
                    <p className="text-[10px] text-gray-600">{rep.user.role}</p>
                  </div>
                  <div className="px-3 py-3 border-b border-gray-800/60 text-right font-mono text-xs text-gray-300">{fmtMins(t.timeInAppMinutes)}</div>
                  <div className="px-3 py-3 border-b border-gray-800/60 text-right text-sm text-blue-400">{t.emailsSent || "—"}</div>
                  <div className="px-3 py-3 border-b border-gray-800/60 text-right text-sm text-purple-400">{t.followUpsWorked || "—"}</div>
                  <div className="px-3 py-3 border-b border-gray-800/60 text-right text-sm text-emerald-400">{t.prospectsContacted + t.prospectsAdded || "—"}</div>
                  <div className="px-3 py-3 border-b border-gray-800/60 text-right text-sm text-yellow-400">{t.opportunitiesUpdated || "—"}</div>
                  <div className="px-3 py-3 border-b border-gray-800/60 text-right text-sm text-orange-400">{t.tasksCompleted || "—"}</div>
                  <div className="px-3 py-3 border-b border-gray-800/60 text-right text-sm text-white">{ins.daysActive}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
