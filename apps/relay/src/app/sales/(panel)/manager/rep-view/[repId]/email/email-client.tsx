"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Mail, ArrowLeft, ArrowUpRight, ArrowDownLeft,
  Search, X, Eye, EyeOff, Loader2, Lock,
  CheckCircle2, Clock, Calendar,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrmEmail {
  id:             string
  direction:      "sent" | "received"
  fromAddress:    string
  toAddress:      string
  cc:             string | null
  subject:        string
  bodyHtml:       string | null
  bodyText:       string | null
  messageId:      string | null
  inReplyTo:      string | null
  threadId:       string | null
  sentAt:         string
  source:         string | null
  isRead:         boolean
  contactEmail:   string | null
  followUpDate:   string | null
  followUpDoneAt: string | null
  stageNumber:    number | null
  openedAt:       string | null
  openCount:      number
  lastOpenedAt:   string | null
  sentiment:      string | null
  prospectId:     string | null
  demoCall:       { id: string; contactName: string; companyName: string } | null
  prospect:       { id: string; companyName: string } | null
}

interface Thread {
  key:              string
  subject:          string
  contactName:      string
  contactEmail:     string
  companyName:      string | null
  demoCallId:       string | null
  demoCall:         CrmEmail["demoCall"]
  prospect:         CrmEmail["prospect"]
  emails:           CrmEmail[]
  lastEmail:        CrmEmail
  hasUnread:        boolean
  lastSentStage:    number | null
  lastSentOpenedAt: string | null
  lastSentOpenCount:number
}

type Filter = "all" | "inbox" | "sent"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDisplayName(address: string): string {
  const m = address.match(/^"?(.+?)"?\s*</)
  return m?.[1]?.trim() ?? address.split("@")[0] ?? address
}

function stripRe(subject: string) {
  return subject.replace(/^(re:\s*)+/i, "").trim()
}

function formatDate(iso: string): string {
  const d   = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  if (now.getTime() - d.getTime() < 7 * 86400000) {
    return d.toLocaleDateString([], { weekday: "short" })
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

function groupIntoThreads(emails: CrmEmail[]): Thread[] {
  const map = new Map<string, CrmEmail[]>()
  for (const e of emails) {
    const key = e.threadId ?? e.id
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  const threads: Thread[] = []
  for (const [key, group] of map.entries()) {
    group.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
    const last      = group[group.length - 1]!
    const dc        = group.find(e => e.demoCall)?.demoCall ?? null
    const prospect  = group.find(e => e.prospect)?.prospect ?? null
    const isSent    = last.direction === "sent"
    const raw       = isSent ? last.toAddress : last.fromAddress
    const name      = dc?.contactName ?? parseDisplayName(raw)
    const email     = isSent ? last.toAddress : (last.contactEmail ?? last.fromAddress)
    const compName  = prospect?.companyName ?? dc?.companyName ?? null
    const lastSent  = [...group].reverse().find(e => e.direction === "sent")
    threads.push({
      key,
      subject:          stripRe(group[0]!.subject),
      contactName:      name,
      contactEmail:     email,
      companyName:      compName,
      demoCallId:       dc?.id ?? null,
      demoCall:         dc,
      prospect,
      emails:           group,
      lastEmail:        last,
      hasUnread:        group.some(e => e.direction === "received" && !e.isRead),
      lastSentStage:    lastSent?.stageNumber ?? null,
      lastSentOpenedAt: lastSent?.openedAt ?? null,
      lastSentOpenCount:lastSent?.openCount ?? 0,
    })
  }
  threads.sort((a, b) => new Date(b.lastEmail.sentAt).getTime() - new Date(a.lastEmail.sentAt).getTime())
  return threads
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RepViewEmailClient({
  repId,
  repName,
  basePath,
}: {
  repId:    string
  repName:  string
  basePath: string
}) {
  const [emails,       setEmails]       = useState<CrmEmail[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState<Filter>("all")
  const [selectedKey,  setSelectedKey]  = useState<string | null>(null)
  const [searchQuery,  setSearchQuery]  = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/sales/manager/rep-view/${repId}/emails`)
      const data = await res.json() as { emails: CrmEmail[] }
      setEmails(data.emails ?? [])
    } finally {
      setLoading(false)
    }
  }, [repId])

  useEffect(() => { void load() }, [load])

  const allThreads      = groupIntoThreads(emails)
  const threads         = filter === "inbox"
    ? allThreads.filter(t => t.emails.some(e => e.direction === "received"))
    : filter === "sent"
    ? allThreads.filter(t => t.emails.some(e => e.direction === "sent"))
    : allThreads
  const filteredThreads = searchQuery.trim()
    ? threads.filter(t => {
        const q = searchQuery.toLowerCase()
        return (
          t.subject.toLowerCase().includes(q) ||
          t.contactName.toLowerCase().includes(q) ||
          t.contactEmail.toLowerCase().includes(q) ||
          t.companyName?.toLowerCase().includes(q) ||
          t.emails.some(e => (e.bodyText ?? "").toLowerCase().includes(q))
        )
      })
    : threads
  const selected = threads.find(t => t.key === selectedKey) ?? null

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Read-only banner */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-900/20 border-b border-amber-800/40">
        <Lock className="w-3 h-3 text-amber-400 shrink-0" />
        <p className="text-xs text-amber-300">
          Read-only view of <span className="font-semibold">{repName}</span>'s CRM correspondence.
          No sending, replying, or editing.
        </p>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ── Thread list panel ── */}
        <div className={cn(
          "flex flex-col border-r border-gray-800 bg-gray-900",
          selected ? "hidden md:flex md:w-72 lg:w-80 shrink-0" : "flex-1 md:w-80 lg:w-96 shrink-0",
        )}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-base font-bold text-white">Email</h1>
              <span className="text-[10px] text-gray-600">{allThreads.length} thread{allThreads.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex border-b border-gray-800">
            {(["all", "inbox", "sent"] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => { setFilter(f); setSelectedKey(null) }}
                className={cn(
                  "flex-1 py-2 text-xs font-medium capitalize transition-colors",
                  filter === f
                    ? "text-white border-b-2 border-amber-500"
                    : "text-gray-500 hover:text-gray-300",
                )}
              >
                {f === "all" ? "All" : f === "inbox" ? "Inbox" : "Sent"}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search emails…"
                className="w-full pl-8 pr-7 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-2 text-gray-500 hover:text-white transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery.trim() && (
              <p className="text-[11px] text-gray-500 mt-1.5 px-0.5">
                {filteredThreads.length} of {threads.length} match
              </p>
            )}
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <Mail className="w-10 h-10 text-gray-700 mb-3" />
                <p className="text-gray-500 text-sm">No emails found</p>
              </div>
            ) : (
              <ul>
                {filteredThreads.map(t => (
                  <ThreadRow
                    key={t.key}
                    thread={t}
                    isSelected={selectedKey === t.key}
                    onClick={() => setSelectedKey(t.key)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Thread detail panel ── */}
        <div className={cn("flex-1 flex flex-col min-h-0", !selected && "hidden md:flex")}>
          {selected ? (
            <ThreadDetail
              thread={selected}
              basePath={basePath}
              onBack={() => setSelectedKey(null)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                <Mail className="w-7 h-7 text-gray-600" />
              </div>
              <p className="text-gray-500 text-sm">Select a conversation to read it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Thread row ───────────────────────────────────────────────────────────────

function ThreadRow({ thread, isSelected, onClick }: {
  thread:     Thread
  isSelected: boolean
  onClick:    () => void
}) {
  const preview = (thread.lastEmail.bodyText ?? "").trim().slice(0, 80)
  const isSent  = thread.lastEmail.direction === "sent"

  return (
    <li
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 px-3 py-3 cursor-pointer border-b border-gray-800/60 transition-colors",
        isSelected
          ? "bg-amber-700/20 border-l-2 border-l-amber-500"
          : "hover:bg-gray-800/50 border-l-2 border-l-transparent",
      )}
    >
      <div className={cn(
        "shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold",
        isSent ? "bg-emerald-900/60 text-emerald-300" : "bg-blue-900/40 text-blue-300",
      )}>
        {thread.contactName.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={cn(
            "text-sm truncate",
            thread.hasUnread ? "text-white font-semibold" : "text-gray-300 font-medium",
          )}>
            {thread.contactName}
            {thread.companyName && (
              <span className="font-normal text-gray-500"> · {thread.companyName}</span>
            )}
          </span>
          <span className="text-[10px] text-gray-600 shrink-0">{formatDate(thread.lastEmail.sentAt)}</span>
        </div>
        <p className={cn("text-xs truncate mb-0.5", thread.hasUnread ? "text-gray-200" : "text-gray-500")}>
          {thread.subject || "(no subject)"}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-[11px] text-gray-600 truncate flex-1">{preview}</p>
          {thread.lastSentOpenedAt ? (
            <span className="text-[10px] flex items-center gap-0.5 text-emerald-500 shrink-0">
              <Eye className="w-3 h-3" />
              {thread.lastSentOpenCount > 1 ? thread.lastSentOpenCount : ""}
            </span>
          ) : thread.emails.some(e => e.direction === "sent") ? (
            <span><EyeOff className="w-3 h-3 text-gray-700 shrink-0" /></span>
          ) : null}
          {thread.lastSentStage != null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500 shrink-0">
              S{thread.lastSentStage}
            </span>
          )}
        </div>
      </div>

      {thread.hasUnread && (
        <div className="shrink-0 mt-2 w-2 h-2 rounded-full bg-amber-400" />
      )}
    </li>
  )
}

// ─── Thread detail ────────────────────────────────────────────────────────────

function ThreadDetail({ thread, basePath, onBack }: {
  thread:   Thread
  basePath: string
  onBack:   () => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const last = thread.emails[thread.emails.length - 1]
    if (last) setExpanded({ [last.id]: true })
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [thread.key])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-800 shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white truncate">{thread.subject || "(no subject)"}</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500 truncate">{thread.contactName}</span>
            {thread.prospect ? (
              <Link
                href={`${basePath}/prospects/${thread.prospect.id}`}
                className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors shrink-0"
              >
                View Prospect →
              </Link>
            ) : null}
          </div>
        </div>
        <span className="text-xs text-gray-600 shrink-0">
          {thread.emails.length} email{thread.emails.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {thread.emails.map(email => {
          const isOpen      = expanded[email.id] ?? false
          const isSent      = email.direction === "sent"
          const sender      = isSent ? "Rep" : (email.demoCall?.contactName ?? parseDisplayName(email.fromAddress))
          const hasReminder = email.followUpDate !== null
          const reminderDone = email.followUpDoneAt !== null

          return (
            <div key={email.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-800/40 transition-colors"
                onClick={() => setExpanded(p => ({ ...p, [email.id]: !p[email.id] }))}
              >
                <div className={cn(
                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                  isSent ? "bg-emerald-900/60 text-emerald-300" : "bg-blue-900/40 text-blue-300",
                )}>
                  {sender.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-200">{sender}</span>
                    {isSent
                      ? <ArrowUpRight  className="w-3 h-3 text-emerald-400" />
                      : <ArrowDownLeft className="w-3 h-3 text-blue-400" />}
                    {hasReminder && !reminderDone && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-yellow-900/30 text-yellow-400">
                        <Calendar className="w-2.5 h-2.5 inline mr-0.5" />
                        reminder {new Date(email.followUpDate!).toLocaleDateString()}
                      </span>
                    )}
                    {reminderDone && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-900/30 text-green-500">
                        <CheckCircle2 className="w-2.5 h-2.5 inline mr-0.5" />
                        reminder done
                      </span>
                    )}
                    {isSent && (
                      email.openedAt ? (
                        <span
                          className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium bg-emerald-900/40 text-emerald-400"
                          title={`Estimated open — pixel fired ${new Date(email.openedAt).toLocaleString()}. May include email preview tools.`}
                        >
                          <Eye className="w-2.5 h-2.5" />
                          {email.openCount > 1 ? `Est. Open ${email.openCount}×` : "Est. Open"}
                        </span>
                      ) : (
                        <span className="text-[10px] flex items-center gap-1 text-gray-600">
                          <EyeOff className="w-2.5 h-2.5" />
                          Not opened
                        </span>
                      )
                    )}
                    {!isOpen && (
                      <span className="text-xs text-gray-600 truncate max-w-48">
                        {(email.bodyText ?? "").slice(0, 60)}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600">
                    {isSent ? `To: ${email.toAddress}` : `From: ${email.fromAddress}`}
                    <span className="mx-1">·</span>
                    {new Date(email.sentAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-800">
                  <div className="text-xs text-gray-600 mb-3 space-y-0.5">
                    <p><span className="text-gray-500">From:</span> {email.fromAddress}</p>
                    <p><span className="text-gray-500">To:</span> {email.toAddress}</p>
                    {email.cc && <p><span className="text-gray-500">CC:</span> {email.cc}</p>}
                    <p><span className="text-gray-500">Date:</span> {new Date(email.sentAt).toLocaleString()}</p>
                    {email.sentiment && (
                      <p><span className="text-gray-500">Sentiment:</span>{" "}
                        <span className={
                          email.sentiment === "positive" ? "text-emerald-400" :
                          email.sentiment === "negative" ? "text-red-400" : "text-gray-300"
                        }>{email.sentiment}</span>
                      </p>
                    )}
                  </div>
                  {email.bodyHtml ? (
                    <div
                      className="text-sm text-gray-300 leading-relaxed [&_a]:text-amber-400 [&_ul]:list-disc [&_ul]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-600 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600 max-w-none"
                      dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
                    />
                  ) : (
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{email.bodyText}</pre>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Read-only footer */}
      <div className="shrink-0 border-t border-gray-800 bg-gray-950 px-5 py-3 flex items-center gap-2">
        <Lock className="w-3.5 h-3.5 text-gray-600" />
        <p className="text-xs text-gray-600">Read-only. Replies and other actions are unavailable in the manager view.</p>
        {thread.hasUnread && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-500">
            <Clock className="w-3 h-3" />
            Contains unread messages
          </span>
        )}
      </div>
    </div>
  )
}
