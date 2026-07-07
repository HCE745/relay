"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  CheckCircle, XCircle, Inbox, MessageSquare,
  Forward, ClipboardList, X, ExternalLink, UserCheck, Sparkles, ChevronDown, ChevronUp,
} from "lucide-react"
import Link from "next/link"
import { ISSUE_PRIORITY } from "@/lib/constants"
import { SUGGESTION_CATEGORY_LABEL } from "@/lib/suggestion-constants"

interface Suggestion {
  id: string
  content: string
  status: string
  adminNote: string | null
  detectedCategory: string | null
  routedNote: string | null
  assigneeApproaches: string | null
  createdAt: string
  submittedBy: { id: string; name: string }
  routedToUser: { id: string; name: string } | null
  convertedToIssue: { id: string; title: string } | null
}

interface UserOption {
  id: string
  name: string
  role: string
}

interface Props {
  initialSuggestions: Suggestion[]
  users: UserOption[]
  sessionUserId: string
  isAdmin: boolean
  defaultApproachesExpanded: boolean
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  REVIEWED: "bg-green-100 text-green-800",
  DISMISSED: "bg-gray-100 text-gray-500",
  CONVERTED: "bg-blue-100 text-blue-800",
}

export function SuggestionInbox({ initialSuggestions, users, sessionUserId, isAdmin, defaultApproachesExpanded }: Props) {
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [filter, setFilter] = useState<string>("PENDING")
  const [expandedApproaches, setExpandedApproaches] = useState<Set<string>>(() => {
    if (!defaultApproachesExpanded) return new Set()
    return new Set(
      initialSuggestions
        .filter(s => s.assigneeApproaches && s.routedToUser?.id === sessionUserId && s.status !== "DISMISSED" && s.status !== "CONVERTED")
        .map(s => s.id)
    )
  })

  // Note dialog
  const [noteId, setNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState("")

  // Reassign dialog
  const [reassignId, setReassignId] = useState<string | null>(null)
  const [reassignUserId, setReassignUserId] = useState("")
  const [reassignNote, setReassignNote] = useState("")
  const [reassigning, setReassigning] = useState(false)

  // Convert dialog
  const [convertId, setConvertId] = useState<string | null>(null)
  const [convertTitle, setConvertTitle] = useState("")
  const [convertPriority, setConvertPriority] = useState("MEDIUM")
  const [convertAssigneeId, setConvertAssigneeId] = useState("")
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState("")

  const filterTabs = isAdmin
    ? ["PENDING", "REVIEWED", "DISMISSED", "CONVERTED", "ALL"] as const
    : ["PENDING", "REVIEWED", "ALL"] as const

  const visible = filter === "ALL" ? suggestions : suggestions.filter(s => s.status === filter)
  const counts: Record<string, number> = {}
  filterTabs.forEach(f => { if (f !== "ALL") counts[f] = suggestions.filter(s => s.status === f).length })

  function patchSuggestion(updated: Suggestion) {
    setSuggestions(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  function toggleApproaches(id: string) {
    setExpandedApproaches(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Parse ## sections from AI approach text
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

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/suggestions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) patchSuggestion(await res.json())
  }

  async function saveNote(id: string) {
    const res = await fetch(`/api/suggestions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNote: noteText }),
    })
    if (res.ok) { patchSuggestion(await res.json()); setNoteId(null) }
  }

  async function doReassign() {
    if (!reassignUserId || !reassignId) return
    setReassigning(true)
    const res = await fetch(`/api/suggestions/${reassignId}/reassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routedToUserId: reassignUserId, routedNote: reassignNote }),
    })
    setReassigning(false)
    if (res.ok) {
      patchSuggestion(await res.json())
      setReassignId(null); setReassignUserId(""); setReassignNote("")
    }
  }

  async function doConvert() {
    if (!convertTitle.trim() || !convertId) return
    setConverting(true)
    setConvertError("")
    const s = suggestions.find(s => s.id === convertId)
    const res = await fetch(`/api/suggestions/${convertId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: convertTitle,
        priority: convertPriority,
        assignedToId: convertAssigneeId || s?.routedToUser?.id || null,
      }),
    })
    setConverting(false)
    if (res.ok) {
      const data = await res.json()
      patchSuggestion(data.suggestion)
      setConvertId(null); setConvertTitle(""); setConvertPriority("MEDIUM"); setConvertAssigneeId("")
    } else {
      const d = await res.json()
      setConvertError(d.error ?? "Failed to convert")
    }
  }

  function openConvert(s: Suggestion) {
    setConvertId(s.id)
    setConvertTitle(s.content.split("\n")[0].slice(0, 80))
    setConvertAssigneeId(s.routedToUser?.id ?? "")
    setConvertError("")
  }

  const canReassign = (s: Suggestion) =>
    isAdmin || s.routedToUser?.id === sessionUserId

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {filterTabs.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            {f !== "ALL" && counts[f] !== undefined && (
              <span className="ml-1.5 text-xs opacity-75">({counts[f]})</span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No suggestions in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(s => (
            <div key={s.id} className={`bg-white rounded-xl border border-gray-200 p-4 ${s.status === "DISMISSED" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-gray-900">{s.submittedBy.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_STYLE[s.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                    </span>
                    {s.detectedCategory && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {SUGGESTION_CATEGORY_LABEL[s.detectedCategory as keyof typeof SUGGESTION_CATEGORY_LABEL] ?? s.detectedCategory}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Content */}
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{s.content}</p>

                  {/* Routing info */}
                  {s.routedToUser && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                      <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                      Routed to <span className="font-medium text-gray-700">{s.routedToUser.name}</span>
                      {s.routedNote && <span className="italic text-gray-400">· &ldquo;{s.routedNote}&rdquo;</span>}
                    </div>
                  )}

                  {/* Converted link */}
                  {s.convertedToIssue && (
                    <Link
                      href={`/issues/${s.convertedToIssue.id}`}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Work order: {s.convertedToIssue.title}
                    </Link>
                  )}

                  {/* Admin note */}
                  {s.adminNote && (
                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2 border-l-2 border-blue-300">
                      <span className="font-medium text-gray-600">Note: </span>{s.adminNote}
                    </div>
                  )}

                  {/* AI implementation approaches — shown to recipient only */}
                  {s.assigneeApproaches && s.routedToUser?.id === sessionUserId && s.status !== "DISMISSED" && s.status !== "CONVERTED" && (
                    <div className="mt-3">
                      <button
                        onClick={() => toggleApproaches(s.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-purple-700 hover:text-purple-900"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Implementation Approaches
                        {expandedApproaches.has(s.id)
                          ? <ChevronUp className="w-3 h-3" />
                          : <ChevronDown className="w-3 h-3" />
                        }
                      </button>
                      {expandedApproaches.has(s.id) && (
                        <div className="mt-2 space-y-2">
                          {parseApproachSections(s.assigneeApproaches).map((sec, i) => (
                            <div key={i} className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5">
                              <div className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1.5">{sec.heading}</div>
                              <div className="space-y-1">
                                {sec.body.split("\n").filter(l => l.trim()).map((line, j) => {
                                  const boldMatch = line.match(/^\*\*(.+?):\*\*\s*(.+)$/)
                                  if (boldMatch) {
                                    const effortColor = boldMatch[1] === "Effort"
                                      ? boldMatch[2] === "Low" ? "text-green-700"
                                        : boldMatch[2] === "High" ? "text-red-700"
                                        : "text-amber-700"
                                      : "text-purple-900"
                                    return (
                                      <div key={j} className={`text-xs leading-relaxed ${effortColor}`}>
                                        <span className="font-semibold text-purple-800">{boldMatch[1]}:</span>{" "}
                                        {boldMatch[2]}
                                      </div>
                                    )
                                  }
                                  return <p key={j} className="text-xs text-purple-900 leading-relaxed">{line}</p>
                                })}
                              </div>
                            </div>
                          ))}
                          <p className="text-[10px] text-purple-400 pl-0.5">AI suggestions are a beta feature.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {isAdmin && s.status !== "REVIEWED" && s.status !== "CONVERTED" && (
                    <button onClick={() => updateStatus(s.id, "REVIEWED")} title="Mark Reviewed"
                      className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && s.status !== "DISMISSED" && s.status !== "CONVERTED" && (
                    <button onClick={() => updateStatus(s.id, "DISMISSED")} title="Dismiss"
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => { setNoteId(s.id); setNoteText(s.adminNote ?? "") }} title="Add Note"
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600">
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                  {canReassign(s) && s.status !== "CONVERTED" && (
                    <button onClick={() => { setReassignId(s.id); setReassignUserId(s.routedToUser?.id ?? ""); setReassignNote("") }}
                      title="Reassign / Forward"
                      className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-600">
                      <Forward className="w-4 h-4" />
                    </button>
                  )}
                  {canReassign(s) && s.status !== "CONVERTED" && !s.convertedToIssue && (
                    <button onClick={() => openConvert(s)} title="Convert to Work Order"
                      className="p-1.5 rounded-lg hover:bg-purple-50 text-gray-400 hover:text-purple-600">
                      <ClipboardList className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Inline note editor */}
              {noteId === s.id && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                    placeholder="Add an internal note…" rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setNoteId(null)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={() => saveNote(s.id)} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Note</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reassign modal */}
      {reassignId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Reassign / Forward</h3>
              <button onClick={() => setReassignId(null)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
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
              <button onClick={() => setReassignId(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={doReassign} disabled={!reassignUserId || reassigning}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                <Forward className="w-3.5 h-3.5" />
                {reassigning ? "Forwarding…" : "Forward"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Work Order modal */}
      {convertId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Convert to Work Order</h3>
              <button onClick={() => setConvertId(null)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {convertError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{convertError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Work Order Title *</label>
                <input value={convertTitle} onChange={e => setConvertTitle(e.target.value)}
                  placeholder="Short description of the task"
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
              <p className="text-xs text-gray-400">The suggestion&apos;s full text becomes the work order description. It will appear in the assignee&apos;s issue queue.</p>
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-gray-100 justify-end">
              <button onClick={() => setConvertId(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={doConvert} disabled={!convertTitle.trim() || converting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60">
                <ClipboardList className="w-3.5 h-3.5" />
                {converting ? "Creating…" : "Create Work Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
