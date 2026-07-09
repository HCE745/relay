"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Mail, Send, X, ChevronDown, Loader2, RefreshCw, ArrowLeft,
  ArrowUpRight, ArrowDownLeft, Search, User,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrmEmail {
  id:           string
  direction:    "sent" | "received"
  fromAddress:  string
  toAddress:    string
  subject:      string
  bodyHtml:     string
  bodyText:     string
  messageId:    string | null
  inReplyTo:    string | null
  threadId:     string | null
  sentAt:       string
  source:       string
  isRead:       boolean
  contactEmail: string
  demoCall:     { id: string; contactName: string; companyName: string } | null
}

interface Thread {
  key:          string
  subject:      string
  contactName:  string
  contactEmail: string
  demoCallId:   string | null
  demoCall:     CrmEmail["demoCall"]
  emails:       CrmEmail[]
  lastEmail:    CrmEmail
  hasUnread:    boolean
}

interface Template {
  id:      string
  name:    string
  subject: string
  body:    string
}

interface Contact {
  id:           string
  contactName:  string
  contactEmail: string
  companyName:  string
}

type Filter = "all" | "inbox" | "sent"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDisplayName(address: string): string {
  const m = address.match(/^"?(.+?)"?\s*</)
  return m?.[1]?.trim() ?? address.split("@")[0] ?? address
}

function stripRePrefix(subject: string) {
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
    const last     = group[group.length - 1]!
    const dc       = group.find(e => e.demoCall)?.demoCall ?? null
    const isSent   = last.direction === "sent"
    const rawAddr  = isSent ? last.toAddress : last.fromAddress
    const name     = dc?.contactName ?? parseDisplayName(rawAddr)
    const email    = isSent ? last.toAddress : (last.contactEmail || last.fromAddress)
    threads.push({
      key,
      subject:      stripRePrefix(group[0]!.subject),
      contactName:  name,
      contactEmail: email,
      demoCallId:   dc?.id ?? null,
      demoCall:     dc,
      emails:       group,
      lastEmail:    last,
      hasUnread:    group.some(e => e.direction === "received" && !e.isRead),
    })
  }
  threads.sort((a, b) => new Date(b.lastEmail.sentAt).getTime() - new Date(a.lastEmail.sentAt).getTime())
  return threads
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CrmEmailPage() {
  const [emails,      setEmails]      = useState<CrmEmail[]>([])
  const [templates,   setTemplates]   = useState<Template[]>([])
  const [contacts,    setContacts]    = useState<Contact[]>([])
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(false)
  const [syncMsg,     setSyncMsg]     = useState("")
  const [filter,      setFilter]      = useState<Filter>("all")
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [composing,   setComposing]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/super-admin/crm/emails?all=true")
      const data = await res.json() as { emails: CrmEmail[] }
      setEmails(data.emails ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    fetch("/api/super-admin/crm/email-templates")
      .then(r => r.json())
      .then(d => setTemplates((d as { templates: Template[] }).templates ?? []))
      .catch(() => null)
    fetch("/api/super-admin/crm/demo-calls")
      .then(r => r.json())
      .then(d => setContacts(
        ((d as { calls: { id: string; contactName: string; contactEmail: string; companyName: string }[] }).calls ?? [])
          .filter(c => c.contactEmail)
      ))
      .catch(() => null)
  }, [load])

  async function syncImap() {
    setSyncing(true); setSyncMsg("")
    try {
      const res  = await fetch("/api/super-admin/crm/imap-sync", { method: "POST" })
      const data = await res.json() as { result?: { synced: number }; error?: string }
      setSyncMsg(data.error ? `Error: ${data.error}` : `Synced ${data.result?.synced ?? 0} new emails`)
      void load()
    } finally {
      setSyncing(false)
    }
  }

  async function markThreadRead(thread: Thread) {
    const unread = thread.emails.filter(e => e.direction === "received" && !e.isRead)
    if (!unread.length) return
    await Promise.all(unread.map(e =>
      fetch(`/api/super-admin/crm/emails/${e.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "mark_read" }),
      })
    ))
    setEmails(prev => prev.map(e =>
      unread.some(u => u.id === e.id) ? { ...e, isRead: true } : e
    ))
  }

  const allThreads   = groupIntoThreads(emails)
  const threads      = filter === "inbox"
    ? allThreads.filter(t => t.emails.some(e => e.direction === "received"))
    : filter === "sent"
    ? allThreads.filter(t => t.emails.some(e => e.direction === "sent"))
    : allThreads
  const selected     = threads.find(t => t.key === selectedKey) ?? null

  function selectThread(t: Thread) {
    setSelectedKey(t.key)
    void markThreadRead(t)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Two-panel body ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left panel: thread list ── */}
        <div className={cn(
          "flex flex-col border-r border-gray-800 bg-gray-900",
          selected ? "hidden md:flex md:w-72 lg:w-80 shrink-0" : "flex-1 md:w-80 lg:w-96 shrink-0",
        )}>
          {/* Left header */}
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-base font-bold text-white">CRM Email</h1>
              <div className="flex items-center gap-1.5">
                {syncMsg && <span className="text-[10px] text-gray-500 max-w-[100px] truncate">{syncMsg}</span>}
                <button
                  onClick={syncImap}
                  disabled={syncing}
                  title="Sync IMAP"
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
                </button>
              </div>
            </div>
            <button
              onClick={() => setComposing(true)}
              className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Mail className="w-4 h-4" />
              Compose New Email
            </button>
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
                    ? "text-white border-b-2 border-indigo-500"
                    : "text-gray-500 hover:text-gray-300",
                )}
              >
                {f === "all" ? "All" : f === "inbox" ? "Inbox" : "Sent"}
              </button>
            ))}
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
              </div>
            ) : threads.length === 0 ? (
              <EmptyState onCompose={() => setComposing(true)} />
            ) : (
              <ul>
                {threads.map(t => (
                  <ThreadRow
                    key={t.key}
                    thread={t}
                    isSelected={selectedKey === t.key}
                    onClick={() => selectThread(t)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Right panel: thread detail ── */}
        <div className={cn(
          "flex-1 flex flex-col min-h-0",
          !selected && "hidden md:flex",
        )}>
          {selected ? (
            <ThreadDetail
              thread={selected}
              onBack={() => setSelectedKey(null)}
              onReplySuccess={load}
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

      {/* ── Compose modal ── */}
      {composing && (
        <ComposeModal
          templates={templates}
          contacts={contacts}
          onClose={() => setComposing(false)}
          onSent={() => { setComposing(false); void load() }}
        />
      )}
    </div>
  )
}

// ─── Thread row ───────────────────────────────────────────────────────────────

function ThreadRow({ thread, isSelected, onClick }: {
  thread:     Thread
  isSelected: boolean
  onClick:    () => void
}) {
  const preview = thread.lastEmail.bodyText.trim().slice(0, 80)
  const isSent  = thread.lastEmail.direction === "sent"

  return (
    <li
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-800/60 transition-colors",
        isSelected ? "bg-indigo-600/20 border-l-2 border-l-indigo-500" : "hover:bg-gray-800/50 border-l-2 border-l-transparent",
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold",
        isSent ? "bg-indigo-900/60 text-indigo-300" : "bg-green-900/40 text-green-300",
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
          </span>
          <span className="text-[10px] text-gray-600 shrink-0">{formatDate(thread.lastEmail.sentAt)}</span>
        </div>
        <p className={cn("text-xs truncate mb-0.5", thread.hasUnread ? "text-gray-200" : "text-gray-500")}>
          {thread.subject || "(no subject)"}
        </p>
        <p className="text-[11px] text-gray-600 truncate">{preview}</p>
      </div>

      {thread.hasUnread && (
        <div className="shrink-0 mt-2 w-2 h-2 rounded-full bg-indigo-500" />
      )}
    </li>
  )
}

// ─── Thread detail ────────────────────────────────────────────────────────────

function ThreadDetail({ thread, onBack, onReplySuccess }: {
  thread:          Thread
  onBack:          () => void
  onReplySuccess:  () => void
}) {
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({})
  const [replyText, setReplyText] = useState("")
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState("")
  const bottomRef                 = useRef<HTMLDivElement>(null)

  // Auto-expand last email
  useEffect(() => {
    const last = thread.emails[thread.emails.length - 1]
    if (last) setExpanded({ [last.id]: true })
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [thread.key])

  async function sendReply() {
    if (!replyText.trim()) return
    setSending(true); setError("")
    const last      = thread.emails[thread.emails.length - 1]!
    const replyTo   = last.direction === "received" ? last.fromAddress : last.toAddress
    const bodyHtml  = `<p>${replyText.replace(/\n/g, "<br>")}</p>`
    try {
      const res = await fetch("/api/super-admin/crm/emails", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          to:        replyTo,
          subject:   `Re: ${thread.subject}`,
          bodyHtml,
          inReplyTo: last.messageId,
          threadId:  thread.key,
          demoCallId: thread.demoCallId,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error: string }
        setError(d.error ?? "Failed to send"); return
      }
      setReplyText("")
      onReplySuccess()
    } catch {
      setError("Network error")
    } finally {
      setSending(false)
    }
  }

  const lastEmail = thread.emails[thread.emails.length - 1]!
  const replyAddr = lastEmail.direction === "received" ? lastEmail.fromAddress : lastEmail.toAddress

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Detail header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-800 shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white truncate">{thread.subject || "(no subject)"}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500 truncate">{thread.contactName}</span>
            {thread.demoCall && (
              <Link
                href={`/super-admin/crm/demo-calls/${thread.demoCall.id}`}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors shrink-0"
              >
                View contact →
              </Link>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-600 shrink-0">
          {thread.emails.length} email{thread.emails.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Scrollable email list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {thread.emails.map((email, i) => {
          const isOpen   = expanded[email.id] ?? false
          const isSent   = email.direction === "sent"
          const sender   = isSent ? "Will @ Relay" : (email.demoCall?.contactName ?? parseDisplayName(email.fromAddress))

          return (
            <div key={email.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {/* Email header row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-800/40 transition-colors"
                onClick={() => setExpanded(p => ({ ...p, [email.id]: !p[email.id] }))}
              >
                <div className={cn(
                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                  isSent ? "bg-indigo-900/60 text-indigo-300" : "bg-green-900/40 text-green-300",
                )}>
                  {sender.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">{sender}</span>
                    {isSent
                      ? <ArrowUpRight  className="w-3 h-3 text-indigo-400" />
                      : <ArrowDownLeft className="w-3 h-3 text-green-400" />}
                    {!isOpen && (
                      <span className="text-xs text-gray-600 truncate">{email.bodyText.slice(0, 60)}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600">
                    {isSent ? `To: ${email.toAddress}` : `From: ${email.fromAddress}`}
                    <span className="mx-1">·</span>
                    {new Date(email.sentAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              {/* Email body */}
              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-800">
                  {email.bodyHtml ? (
                    <div
                      className="text-sm text-gray-300 leading-relaxed [&_a]:text-indigo-400 [&_ul]:list-disc [&_ul]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-600 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600 [&_pre]:whitespace-pre-wrap [&_pre]:text-xs max-w-none"
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

      {/* Reply composer — always visible */}
      <div className="shrink-0 border-t border-gray-800 bg-gray-950 px-5 py-4">
        <p className="text-[10px] text-gray-600 mb-2">
          Reply to {replyAddr}
        </p>
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <div className="flex items-end gap-3">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && e.metaKey) void sendReply() }}
            rows={3}
            placeholder="Write a reply… (⌘Enter to send)"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={sendReply}
            disabled={sending || !replyText.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onCompose }: { onCompose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center mb-4">
        <Mail className="w-7 h-7 text-gray-600" />
      </div>
      <h3 className="text-white font-semibold text-base mb-1">No emails yet</h3>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">
        Send your first outreach email to get started. Inbound replies will appear here automatically.
      </p>
      <button
        onClick={onCompose}
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg transition-colors"
      >
        <Mail className="w-4 h-4" />
        Compose Email
      </button>
    </div>
  )
}

// ─── Compose modal ────────────────────────────────────────────────────────────

function ComposeModal({ templates, contacts, onClose, onSent }: {
  templates: Template[]
  contacts:  Contact[]
  onClose:   () => void
  onSent:    () => void
}) {
  const [to,          setTo]          = useState("")
  const [subject,     setSubject]     = useState("")
  const [body,        setBody]        = useState("")
  const [sending,     setSending]     = useState(false)
  const [error,       setError]       = useState("")
  const [showTpl,     setShowTpl]     = useState(false)
  const [showContacts, setShowContacts] = useState(false)

  // Search contacts against whatever is in the To field
  const filteredContacts = contacts.filter(c =>
    to.length >= 1 &&
    (c.contactName.toLowerCase().includes(to.toLowerCase()) ||
     c.contactEmail.toLowerCase().includes(to.toLowerCase()) ||
     c.companyName.toLowerCase().includes(to.toLowerCase()))
  ).slice(0, 6)

  function applyTemplate(t: Template) {
    setSubject(t.subject)
    setBody(t.body)
    setShowTpl(false)
  }

  function pickContact(c: Contact) {
    setTo(c.contactEmail)
    setShowContacts(false)
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError("To, Subject, and Body are required.")
      return
    }
    setSending(true); setError("")
    const bodyHtml = `<p>${body.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`
    try {
      const res = await fetch("/api/super-admin/crm/emails", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ to: to.trim(), subject: subject.trim(), bodyHtml }),
      })
      if (!res.ok) {
        const d = await res.json() as { error: string }
        setError(d.error ?? "Failed to send."); return
      }
      onSent()
    } catch {
      setError("Network error — please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">New Email</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-3 space-y-3 border-b border-gray-800">
          {/* To field with contact search */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-12 shrink-0">To</span>
              <input
                value={to}
                onChange={e => { setTo(e.target.value); setShowContacts(true) }}
                onFocus={() => setShowContacts(true)}
                onBlur={() => setTimeout(() => setShowContacts(false), 150)}
                placeholder="Email address or search contacts…"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder-gray-600"
              />
              {to && (
                <button
                  onClick={() => { setTo(""); setShowContacts(false) }}
                  className="text-gray-600 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <Search className="w-3.5 h-3.5 text-gray-700 shrink-0" />
            </div>
            {showContacts && filteredContacts.length > 0 && (
              <div className="absolute left-14 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden">
                {filteredContacts.map(c => (
                  <button
                    key={c.id}
                    onMouseDown={() => pickContact(c)}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-0"
                  >
                    <div className="w-7 h-7 rounded-full bg-indigo-900/60 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                      {c.contactName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{c.contactName}</p>
                      <p className="text-xs text-gray-500 truncate">{c.contactEmail} · {c.companyName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12 shrink-0">Subject</span>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject"
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder-gray-600"
            />
          </div>
        </div>

        {/* Templates bar */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-gray-800">
          <div className="relative">
            <button
              onClick={() => setShowTpl(v => !v)}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            >
              Templates
              <ChevronDown className="w-3 h-3" />
            </button>
            {showTpl && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden">
                {templates.length === 0 ? (
                  <p className="text-xs text-gray-500 px-4 py-3">
                    No templates yet.{" "}
                    <Link href="/super-admin/crm/settings" className="text-indigo-400 hover:underline">
                      Add one in CRM Settings.
                    </Link>
                  </p>
                ) : (
                  templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 border-b border-gray-700 last:border-0"
                    >
                      {t.name}
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{t.subject}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-600">Apply a saved template to fill subject and body</span>
        </div>

        {/* Body */}
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Write your email…"
          rows={8}
          className="flex-1 px-5 py-4 bg-transparent text-sm text-gray-200 placeholder-gray-600 resize-none outline-none leading-relaxed"
        />

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 flex items-center gap-3">
          {error ? (
            <p className="text-xs text-red-400 flex-1">{error}</p>
          ) : (
            <p className="text-xs text-gray-600 flex-1">Sent from will@getrelay.software via Resend</p>
          )}
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? "Sending…" : "Send Email"}
          </button>
        </div>
      </div>
    </div>
  )
}
