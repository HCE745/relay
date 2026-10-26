"use client"

import { useState, useEffect } from "react"
import { format, isToday, isYesterday } from "date-fns"
import {
  Mail, MailOpen, Phone, PhoneCall, Users, FileText, Eye, DollarSign,
  CheckSquare, ArrowRightLeft, Plus, Loader2, Send, MessageSquare,
  ExternalLink, Mic, Video,
} from "lucide-react"

interface Activity {
  id:             string
  activityType:   string
  subject:        string | null
  notes:          string | null
  outcome:        string | null
  durationMinutes: number | null
  occurredAt:     string
  salesUser:      { id: string; name: string } | null
}

const TYPE_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  EMAIL_SENT:        { icon: Send,          label: "Email Sent",         color: "text-blue-400" },
  EMAIL_RECEIVED:    { icon: MailOpen,      label: "Email Received",     color: "text-emerald-400" },
  LINKEDIN_VIEW:     { icon: ExternalLink,   label: "LinkedIn Viewed",    color: "text-blue-500" },
  LINKEDIN_MESSAGE:  { icon: MessageSquare, label: "LinkedIn Message",   color: "text-blue-500" },
  CALL_ATTEMPTED:    { icon: Phone,         label: "Call Attempted",     color: "text-gray-400" },
  CALL_CONNECTED:    { icon: PhoneCall,     label: "Call Connected",     color: "text-emerald-400" },
  MEETING_HELD:      { icon: Video,         label: "Meeting Held",       color: "text-purple-400" },
  NOTE_ADDED:        { icon: FileText,      label: "Note Added",         color: "text-amber-400" },
  TOUR_VIEWED:       { icon: Eye,           label: "Tour Viewed",        color: "text-indigo-400" },
  PRICING_VIEWED:    { icon: DollarSign,    label: "Pricing Viewed",     color: "text-amber-400" },
  DEMO_COMPLETED:    { icon: Users,         label: "Demo Completed",     color: "text-emerald-400" },
  TASK_COMPLETED:    { icon: CheckSquare,   label: "Task Completed",     color: "text-emerald-400" },
  STATUS_CHANGED:    { icon: ArrowRightLeft, label: "Status Changed",    color: "text-gray-400" },
}

function dayLabel(date: Date) {
  if (isToday(date))     return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "MMM d, yyyy")
}

function groupByDay(activities: Activity[]) {
  const groups: Record<string, Activity[]> = {}
  for (const a of activities) {
    const d = new Date(a.occurredAt)
    const key = format(d, "yyyy-MM-dd")
    if (!groups[key]) groups[key] = []
    groups[key].push(a)
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
}

const LOG_TYPES = [
  "EMAIL_SENT", "EMAIL_RECEIVED", "LINKEDIN_VIEW", "LINKEDIN_MESSAGE",
  "CALL_ATTEMPTED", "CALL_CONNECTED", "MEETING_HELD", "NOTE_ADDED",
  "TOUR_VIEWED", "PRICING_VIEWED",
]

interface Props {
  prospectId?:    string
  demoCallId?:    string
  opportunityId?: string
}

export function ActivityTimeline({ prospectId, demoCallId, opportunityId }: Props) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading]       = useState(true)
  const [showLog, setShowLog]       = useState(false)
  const [logType, setLogType]       = useState("NOTE_ADDED")
  const [logSubject, setLogSubject] = useState("")
  const [logNotes, setLogNotes]     = useState("")
  const [logOutcome, setLogOutcome] = useState("")
  const [logDuration, setLogDuration] = useState("")
  const [saving, setSaving]         = useState(false)

  async function load() {
    const params = new URLSearchParams()
    if (prospectId)    params.set("prospectId",    prospectId)
    if (demoCallId)    params.set("demoCallId",    demoCallId)
    if (opportunityId) params.set("opportunityId", opportunityId)
    setLoading(true)
    const res = await fetch(`/api/sales/activities?${params}`)
    if (res.ok) {
      const data = await res.json() as { activities: Activity[] }
      setActivities(data.activities)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [prospectId, demoCallId, opportunityId])

  async function logActivity() {
    setSaving(true)
    const res = await fetch("/api/sales/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId,
        demoCallId,
        opportunityId,
        activityType:    logType,
        subject:         logSubject  || undefined,
        notes:           logNotes    || undefined,
        outcome:         logOutcome  || undefined,
        durationMinutes: logDuration ? parseInt(logDuration) : undefined,
      }),
    })
    if (res.ok) {
      setShowLog(false)
      setLogSubject(""); setLogNotes(""); setLogOutcome(""); setLogDuration("")
      await load()
    }
    setSaving(false)
  }

  const grouped = groupByDay(activities)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Activity Timeline</h3>
        <button
          onClick={() => setShowLog(v => !v)}
          className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Log Activity
        </button>
      </div>

      {showLog && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Type</label>
              <select
                value={logType}
                onChange={e => setLogType(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none"
              >
                {LOG_TYPES.map(t => (
                  <option key={t} value={t}>{TYPE_META[t]?.label ?? t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Duration (min)</label>
              <input
                type="number"
                value={logDuration}
                onChange={e => setLogDuration(e.target.value)}
                placeholder="Optional"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Subject</label>
            <input
              value={logSubject}
              onChange={e => setLogSubject(e.target.value)}
              placeholder="Brief subject..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Notes</label>
            <textarea
              value={logNotes}
              onChange={e => setLogNotes(e.target.value)}
              rows={3}
              placeholder="What happened?"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 resize-none focus:outline-none"
            />
          </div>
          {(logType === "CALL_ATTEMPTED" || logType === "CALL_CONNECTED") && (
            <div>
              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Outcome</label>
              <select
                value={logOutcome}
                onChange={e => setLogOutcome(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none"
              >
                <option value="">Select outcome...</option>
                {["NO_ANSWER","LEFT_VOICEMAIL","GATEKEEPER","WRONG_CONTACT","INTERESTED","NOT_INTERESTED","CALLBACK_REQUESTED","MEETING_BOOKED","ALREADY_A_CUSTOMER","DO_NOT_CALL"].map(o => (
                  <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowLog(false)} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5">Cancel</button>
            <button
              onClick={logActivity}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-xs py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading activities...
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-gray-600 py-4">No activity recorded yet.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([dateKey, acts]) => (
            <div key={dateKey}>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {dayLabel(new Date(dateKey + "T12:00:00"))}
              </p>
              <div className="space-y-2 pl-3 border-l border-gray-800">
                {acts.map(a => {
                  const meta = TYPE_META[a.activityType] ?? { icon: FileText, label: a.activityType, color: "text-gray-400" }
                  const Icon = meta.icon
                  return (
                    <div key={a.id} className="flex items-start gap-3 py-1.5">
                      <div className={`w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 -ml-3.5 mt-0.5 ${meta.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                          <span className="text-[10px] text-gray-600">
                            {format(new Date(a.occurredAt), "h:mm a")}
                          </span>
                          {a.salesUser && (
                            <span className="text-[10px] text-gray-600">by {a.salesUser.name}</span>
                          )}
                        </div>
                        {a.subject && <p className="text-xs text-gray-300 mt-0.5">{a.subject}</p>}
                        {a.notes && <p className="text-xs text-gray-500 mt-0.5">{a.notes}</p>}
                        {a.outcome && (
                          <span className="text-[10px] mt-0.5 inline-block bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                            {a.outcome.replace(/_/g, " ")}
                          </span>
                        )}
                        {a.durationMinutes && (
                          <span className="text-[10px] text-gray-600 ml-2">{a.durationMinutes}m</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
