"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import Link from "next/link"
import {
  CheckCircle, XCircle, MessageSquare, Forward, ClipboardList,
  X, ExternalLink, UserCheck, Sparkles, ChevronDown, ChevronUp,
  Star, Award, Globe, Lock, ArrowLeft,
} from "lucide-react"
import { ISSUE_PRIORITY } from "@/lib/constants"
import { SUGGESTION_CATEGORY_LABEL, SUGGESTION_TYPE_LABEL } from "@/lib/suggestion-constants"

interface Suggestion {
  id:                 string
  type:               string
  content:            string
  status:             string
  adminNote:          string | null
  detectedCategory:   string | null
  routedNote:         string | null
  assigneeApproaches: string | null
  createdAt:          string
  submittedBy:        { id: string; name: string }
  routedToUser:       { id: string; name: string } | null
  convertedToIssue:   { id: string; title: string } | null
}

interface UserOption { id: string; name: string; role: string }

const STATUS_STYLE: Record<string, string> = {
  PENDING:     "bg-yellow-100 text-yellow-800",
  REVIEWED:    "bg-green-100 text-green-800",
  DISMISSED:   "bg-gray-100 text-gray-500",
  CONVERTED:   "bg-blue-100 text-blue-800",
  IMPLEMENTED: "bg-emerald-100 text-emerald-800",
}

const TYPE_BADGE: Record<string, string> = {
  SUGGESTION: "bg-blue-50 text-blue-700 border-blue-100",
  FEEDBACK:   "bg-purple-50 text-purple-700 border-purple-100",
  CONCERN:    "bg-amber-50 text-amber-700 border-amber-100",
}

function parseApproachSections(text: string): Array<{ heading: string; body: string }> {
  const sections: Array<{ heading: string; body: string }> = []
  let current: { heading: string; lines: string[] } | null = null
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      if (current) sections.push({ heading: current.heading, body: current.lines.join("\n").trim() })
      current = { heading: line.slice(3).trim(), lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) sections.push({ heading: current.heading, body: current.lines.join("\n").trim() })
  return sections
}

export function SuggestionDetailClient({
  suggestion: initialSuggestion,
  users,
  sessionUserId,
  isAdmin,
  recognitionEnabled,
}: {
  suggestion:         Suggestion
  users:              UserOption[]
  sessionUserId:      string
  isAdmin:            boolean
  recognitionEnabled: boolean
}) {
  const router = useRouter()
  const [suggestion, setSuggestion]     = useState(initialSuggestion)
  const [approachesExpanded, setApproachesExpanded] = useState(false)

  const [noteText, setNoteText]         = useState(suggestion.adminNote ?? "")
  const [noteEditing, setNoteEditing]   = useState(false)

  const [reassigning, setReassigning]   = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignUserId, setReassignUserId] = useState(suggestion.routedToUser?.id ?? "")
  const [reassignNote, setReassignNote]     = useState("")

  const [convertOpen, setConvertOpen]   = useState(false)
  const [convertTitle, setConvertTitle] = useState(suggestion.content.split("\n")[0].slice(0, 80))
  const [convertPriority, setConvertPriority] = useState("MEDIUM")
  const [convertAssigneeId, setConvertAssigneeId] = useState(suggestion.routedToUser?.id ?? "")
  const [converting, setConverting]     = useState(false)
  const [convertError, setConvertError] = useState("")

  const [recognizeOpen, setRecognizeOpen]           = useState(false)
  const [recognizeMessage, setRecognizeMessage]     = useState("")
  const [recognizeVisibility, setRecognizeVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC")
  const [recognizing, setRecognizing]               = useState(false)
  const [recognizeError, setRecognizeError]         = useState("")

  const canAct =
    isAdmin || suggestion.routedToUser?.id === sessionUserId

  const isFinal = ["CONVERTED", "IMPLEMENTED", "DISMISSED"].includes(suggestion.status)

  async function updateStatus(status: string) {
    const res = await fetch(`/api/suggestions/${suggestion.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) setSuggestion(await res.json() as Suggestion)
  }

  async function saveNote() {
    const res = await fetch(`/api/suggestions/${suggestion.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adminNote: noteText }),
    })
    if (res.ok) { setSuggestion(await res.json() as Suggestion); setNoteEditing(false) }
  }

  async function doReassign() {
    if (!reassignUserId) return
    setReassigning(true)
    const res = await fetch(`/api/suggestions/${suggestion.id}/reassign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ routedToUserId: reassignUserId, routedNote: reassignNote }),
    })
    setReassigning(false)
    if (res.ok) {
      setSuggestion(await res.json() as Suggestion)
      setReassignOpen(false); setReassignNote("")
    }
  }

  async function doConvert() {
    if (!convertTitle.trim()) return
    setConverting(true); setConvertError("")
    const res = await fetch(`/api/suggestions/${suggestion.id}/convert`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: convertTitle, priority: convertPriority, assignedToId: convertAssigneeId || null }),
    })
    setConverting(false)
    if (res.ok) {
      const data = await res.json() as { suggestion: Suggestion }
      setSuggestion(data.suggestion)
      setConvertOpen(false)
    } else {
      const d = await res.json() as { error?: string }
      setConvertError(d.error ?? "Failed to convert")
    }
  }

  async function doMarkImplemented() {
    await updateStatus("IMPLEMENTED")
    setRecognizeOpen(false)
  }

  async function doMarkAndRecognize() {
    if (!recognizeMessage.trim()) { await doMarkImplemented(); return }
    setRecognizing(true); setRecognizeError("")
    await updateStatus("IMPLEMENTED")
    const res = await fetch("/api/recognition", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipientId: suggestion.submittedBy.id,
        message: recognizeMessage.trim(),
        visibility: recognizeVisibility,
        suggestionId: suggestion.id,
      }),
    })
    setRecognizing(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string }
      setRecognizeError(d.error ?? "Recognition could not be saved, but the suggestion was marked implemented.")
      return
    }
    setRecognizeOpen(false)
  }

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link href="/suggestions" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" />
        Back to Suggestions
      </Link>

      {/* Main card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {suggestion.type !== "SUGGESTION" && (
              <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${TYPE_BADGE[suggestion.type] ?? "bg-gray-50 text-gray-600 border-gray-100"}`}>
                {SUGGESTION_TYPE_LABEL[suggestion.type] ?? suggestion.type}
              </span>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLE[suggestion.status] ?? "bg-gray-100 text-gray-500"}`}>
              {suggestion.status === "IMPLEMENTED" ? "Implemented" : suggestion.status.charAt(0) + suggestion.status.slice(1).toLowerCase()}
            </span>
            {suggestion.detectedCategory && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                {SUGGESTION_CATEGORY_LABEL[suggestion.detectedCategory as keyof typeof SUGGESTION_CATEGORY_LABEL] ?? suggestion.detectedCategory}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">{format(new Date(suggestion.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
        </div>

        {/* Content */}
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{suggestion.content}</p>

        {/* Meta */}
        <div className="flex flex-col gap-1.5 text-xs text-gray-500 border-t border-gray-100 pt-3">
          <div>
            <span className="font-medium text-gray-600">Submitted by:</span>{" "}
            {suggestion.submittedBy.name}
          </div>
          {suggestion.routedToUser && (
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span>Routed to <span className="font-medium text-gray-700">{suggestion.routedToUser.name}</span></span>
              {suggestion.routedNote && <span className="italic text-gray-400">&ldquo;{suggestion.routedNote}&rdquo;</span>}
            </div>
          )}
          {suggestion.convertedToIssue && (
            <Link href={`/issues/${suggestion.convertedToIssue.id}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
              <ExternalLink className="w-3 h-3" />
              Work order: {suggestion.convertedToIssue.title}
            </Link>
          )}
        </div>
      </div>

      {/* Admin note */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Manager Note</h3>
          {isAdmin && !noteEditing && (
            <button
              onClick={() => { setNoteText(suggestion.adminNote ?? ""); setNoteEditing(true) }}
              className="text-xs text-blue-600 hover:underline"
            >
              {suggestion.adminNote ? "Edit" : "Add note"}
            </button>
          )}
        </div>
        {noteEditing ? (
          <div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add an internal note…"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setNoteEditing(false)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={saveNote} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Note</button>
            </div>
          </div>
        ) : suggestion.adminNote ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{suggestion.adminNote}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">No note yet.</p>
        )}
      </div>

      {/* AI approaches */}
      {suggestion.assigneeApproaches && suggestion.type !== "FEEDBACK" && suggestion.type !== "CONCERN" && (
        <div className="bg-white rounded-xl border border-purple-200 p-5">
          <button
            onClick={() => setApproachesExpanded(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-purple-700 w-full"
          >
            <Sparkles className="w-4 h-4" />
            AI Implementation Approaches
            {approachesExpanded ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
          </button>
          {approachesExpanded && (
            <div className="mt-4 space-y-3">
              {parseApproachSections(suggestion.assigneeApproaches).map((sec, i) => (
                <div key={i} className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5">
                  <div className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1.5">{sec.heading}</div>
                  <div className="space-y-1">
                    {sec.body.split("\n").filter(l => l.trim()).map((line, j) => {
                      const boldMatch = line.match(/^\*\*(.+?):\*\*\s*(.+)$/)
                      if (boldMatch) {
                        const effortColor = boldMatch[1] === "Effort"
                          ? boldMatch[2] === "Low" ? "text-green-700" : boldMatch[2] === "High" ? "text-red-700" : "text-amber-700"
                          : "text-purple-900"
                        return (
                          <div key={j} className={`text-xs leading-relaxed ${effortColor}`}>
                            <span className="font-semibold text-purple-800">{boldMatch[1]}:</span> {boldMatch[2]}
                          </div>
                        )
                      }
                      return <p key={j} className="text-xs text-purple-900 leading-relaxed">{line}</p>
                    })}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-purple-400">AI suggestions are a beta feature.</p>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {canAct && !isFinal && (
        <div className="flex flex-wrap gap-2">
          {isAdmin && suggestion.status !== "REVIEWED" && (
            <button
              onClick={() => updateStatus("REVIEWED")}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Mark Reviewed
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => {
                if (recognitionEnabled && suggestion.submittedBy.id !== sessionUserId) {
                  setRecognizeMessage(""); setRecognizeError(""); setRecognizeOpen(true)
                } else {
                  updateStatus("IMPLEMENTED")
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
            >
              <Star className="w-4 h-4" />
              Mark Implemented
            </button>
          )}
          {canAct && suggestion.type !== "FEEDBACK" && suggestion.type !== "CONCERN" && !suggestion.convertedToIssue && (
            <button
              onClick={() => { setConvertError(""); setConvertOpen(true) }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-purple-700 border border-purple-200 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <ClipboardList className="w-4 h-4" />
              Convert to Work Order
            </button>
          )}
          {canAct && (
            <button
              onClick={() => { setReassignUserId(suggestion.routedToUser?.id ?? ""); setReassignNote(""); setReassignOpen(true) }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-orange-700 border border-orange-200 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
            >
              <Forward className="w-4 h-4" />
              Reassign
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => updateStatus("DISMISSED")}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* ── Reassign modal ─────────────────────────────────────────── */}
      {reassignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Reassign / Forward</h3>
              <button onClick={() => setReassignOpen(false)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Forward to</label>
                <select value={reassignUserId} onChange={e => setReassignUserId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— select person —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Note (optional)</label>
                <textarea value={reassignNote} onChange={e => setReassignNote(e.target.value)}
                  placeholder="Reason for forwarding…" rows={2}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-gray-100 justify-end">
              <button onClick={() => setReassignOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={doReassign} disabled={!reassignUserId || reassigning}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                <Forward className="w-3.5 h-3.5" />
                {reassigning ? "Forwarding…" : "Forward"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Convert modal ──────────────────────────────────────────── */}
      {convertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Convert to Work Order</h3>
              <button onClick={() => setConvertOpen(false)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {convertError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{convertError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Work Order Title *</label>
                <input value={convertTitle} onChange={e => setConvertTitle(e.target.value)}
                  placeholder="Short description"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                <select value={convertPriority} onChange={e => setConvertPriority(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(ISSUE_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign To</label>
                <select value={convertAssigneeId} onChange={e => setConvertAssigneeId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— same as current recipient —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <p className="text-xs text-gray-400">The full suggestion text becomes the work order description.</p>
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-gray-100 justify-end">
              <button onClick={() => setConvertOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={doConvert} disabled={!convertTitle.trim() || converting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60">
                <ClipboardList className="w-3.5 h-3.5" />
                {converting ? "Creating…" : "Create Work Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Recognition modal ─────────────────────────────────────── */}
      {recognizeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-gray-900">Recognize {suggestion.submittedBy.name}</h3>
              </div>
              <button onClick={() => setRecognizeOpen(false)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {recognizeError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{recognizeError}</div>}
              <p className="text-sm text-gray-500">Optionally add a recognition message before marking this as implemented.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Recognition message (optional)</label>
                <textarea value={recognizeMessage} onChange={e => setRecognizeMessage(e.target.value)}
                  placeholder="Great initiative…" rows={3}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
              </div>
              {recognizeMessage.trim() && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
                  <div className="flex gap-2">
                    {(["PUBLIC", "PRIVATE"] as const).map(v => (
                      <button key={v} onClick={() => setRecognizeVisibility(v)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                          recognizeVisibility === v ? "bg-amber-50 border-amber-300 text-amber-800 font-medium" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}>
                        {v === "PUBLIC" ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        {v.charAt(0) + v.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-gray-100 justify-end">
              <button onClick={() => setRecognizeOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={doMarkImplemented} disabled={recognizing}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-60">
                Mark Only
              </button>
              <button onClick={doMarkAndRecognize} disabled={recognizing}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-60">
                <Award className="w-3.5 h-3.5" />
                {recognizing ? "Saving…" : recognizeMessage.trim() ? "Mark & Recognize" : "Mark Implemented"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
