"use client"

import { useState } from "react"
import {
  ChevronDown, ChevronUp, Send, RefreshCw, Clock, Calendar,
  CheckCircle2, XCircle, Pause, Building2, Mail,
} from "lucide-react"

type OrgInfo = { id: string; name: string; lifecycleStatus: string } | null

type DemoCallInfo = {
  id: string
  contactName: string
  contactEmail: string
  companyName: string | null
  contactRole: string | null
  callStatus: string
  organization: OrgInfo
}

type EnrollmentInfo = {
  id: string
  currentStep: number
  status: string
  mode: string
  enrolledAt: string
  lastContactAt: string | null
  sequence: { id: string; name: string }
  demoCall: DemoCallInfo
}

export type FollowUpData = {
  id: string
  stepNumber: number
  status: string
  scheduledFor: string
  draftSubject: string | null
  draftBodyHtml: string | null
  draftBodyText: string | null
  aiGeneratedAt: string | null
  errorLog: string | null
  enrollment: EnrollmentInfo
}

export function FollowUpCard({
  followUp,
  defaultExpanded = false,
}: {
  followUp: FollowUpData
  defaultExpanded?: boolean
}) {
  const [expanded,     setExpanded]     = useState(defaultExpanded)
  const [editingHtml,  setEditingHtml]  = useState(false)
  const [subject,      setSubject]      = useState(followUp.draftSubject ?? "")
  const [bodyHtml,     setBodyHtml]     = useState(followUp.draftBodyHtml ?? "")
  const [sending,      setSending]      = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error,        setError]        = useState("")
  const [done,         setDone]         = useState(false)

  const { enrollment }  = followUp
  const { demoCall, sequence } = enrollment
  const company  = demoCall.companyName ?? demoCall.organization?.name ?? "Unknown"
  const scheduled = new Date(followUp.scheduledFor)
  const now      = new Date()
  const todayStr = now.toDateString()
  const isOverdue = scheduled < now && scheduled.toDateString() !== todayStr && followUp.status === "pending"
  const isDueToday = scheduled.toDateString() === todayStr

  async function send() {
    setSending(true); setError("")
    try {
      const r = await fetch(`/api/super-admin/crm/follow-ups/${followUp.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "approve_and_send", editedSubject: subject, editedBodyHtml: bodyHtml }),
      })
      const d = await r.json() as { error?: string }
      if (!r.ok) { setError(d.error ?? "Send failed"); setSending(false); return }
      setDone(true)
    } catch {
      setError("Network error"); setSending(false)
    }
  }

  async function regenerate() {
    setRegenerating(true); setError("")
    try {
      const r = await fetch(`/api/super-admin/crm/follow-ups/${followUp.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "regenerate_draft" }),
      })
      if (r.ok) window.location.reload()
      else setError("Regeneration failed")
    } finally {
      setRegenerating(false)
    }
  }

  async function doAction(act: string, extra: Record<string, unknown> = {}) {
    const r = await fetch(`/api/super-admin/crm/follow-ups/${followUp.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: act, ...extra }),
    })
    if (r.ok) window.location.reload()
    else {
      const d = await r.json() as { error?: string }
      setError(d.error ?? "Action failed")
    }
  }

  if (done) {
    return (
      <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
        <span className="text-green-300 text-sm font-medium">
          Follow-up #{followUp.stepNumber} sent to {demoCall.contactName}
        </span>
      </div>
    )
  }

  const borderColor = isOverdue ? "border-red-700/70" : isDueToday ? "border-yellow-700/70" : "border-gray-700"

  return (
    <div className={`bg-gray-800 border ${borderColor} rounded-lg overflow-hidden`}>
      {/* Card header */}
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{demoCall.contactName}</span>
            {demoCall.contactRole && (
              <span className="text-xs text-gray-400 truncate">· {demoCall.contactRole}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{company}</span>
            <span className="text-gray-600">·</span>
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate text-xs">{demoCall.contactEmail}</span>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs bg-indigo-900/40 text-indigo-300 border border-indigo-700/30 px-2 py-0.5 rounded">
              {sequence.name} · Step {followUp.stepNumber}
            </span>
            <span className={`text-xs flex items-center gap-1 ${
              isOverdue ? "text-red-400" : isDueToday ? "text-yellow-400" : "text-gray-500"
            }`}>
              <Clock className="w-3 h-3" />
              {isOverdue ? "Overdue · " : isDueToday ? "Due today · " : ""}
              {scheduled.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </span>
            {followUp.status === "draft_generated" && (
              <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700/30 px-2 py-0.5 rounded">
                Draft Ready
              </span>
            )}
          </div>
          {!expanded && followUp.draftSubject && (
            <p className="text-xs text-gray-500 mt-1.5 truncate">
              Re: {followUp.draftSubject}
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 text-gray-400 hover:text-white p-1 rounded transition-colors"
        >
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          {followUp.draftBodyHtml ? (
            <>
              {/* Subject field */}
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 block">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Body editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Body</label>
                  <button
                    onClick={() => setEditingHtml(v => !v)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {editingHtml ? "Preview" : "Edit HTML"}
                  </button>
                </div>
                {editingHtml ? (
                  <textarea
                    value={bodyHtml}
                    onChange={e => setBodyHtml(e.target.value)}
                    rows={10}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-gray-300 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                ) : (
                  <div
                    className="bg-gray-900 border border-gray-700 rounded p-4 text-sm text-gray-200 prose prose-invert prose-sm max-w-none leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                  />
                )}
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              {/* Primary action row */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={send}
                  disabled={sending}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {sending ? "Sending…" : "Send Now"}
                </button>
                <button
                  onClick={regenerate}
                  disabled={regenerating}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
                  Regenerate
                </button>
              </div>
            </>
          ) : (
            /* No draft yet */
            <div className="text-center py-6">
              <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm font-medium">Draft not yet generated</p>
              <p className="text-gray-500 text-xs mt-1">
                The 8am cron generates drafts automatically, or click below.
              </p>
              <button
                onClick={regenerate}
                disabled={regenerating}
                className="mt-3 inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
                Generate Draft Now
              </button>
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>
          )}

          {/* Secondary actions */}
          <div className="flex items-center gap-1 flex-wrap border-t border-gray-700 pt-3">
            <button
              onClick={() => void doAction("snooze", { snoozeHours: 24 })}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-gray-700 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" /> Snooze 24h
            </button>
            <button
              onClick={() => {
                const at = window.prompt("Reschedule to date/time (e.g. 2026-07-20 09:00):")
                if (at) void doAction("reschedule", { rescheduleAt: new Date(at).toISOString() })
              }}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-gray-700 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" /> Reschedule
            </button>
            <button
              onClick={() => void doAction("mark_replied")}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-gray-700 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Replied
            </button>
            <button
              onClick={() => void doAction("mark_not_interested")}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-gray-700 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Not Interested
            </button>
            <button
              onClick={() => void doAction("pause_sequence")}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-gray-700 transition-colors"
            >
              <Pause className="w-3.5 h-3.5" /> Pause Sequence
            </button>
            <button
              onClick={() => { if (confirm(`End sequence for ${demoCall.contactName}? This stops all future follow-ups.`)) void doAction("end_sequence") }}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-gray-700 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> End Sequence
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
