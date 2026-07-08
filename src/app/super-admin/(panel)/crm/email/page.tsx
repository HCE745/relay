"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  Mail, ArrowDownLeft, ArrowUpRight, Reply, Send, X, ChevronDown,
  Bold, Italic, List, Link2, RotateCcw, Loader2, RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrmEmail {
  id:            string
  direction:     "sent" | "received"
  fromAddress:   string
  toAddress:     string
  subject:       string
  bodyHtml:      string
  bodyText:      string
  messageId:     string | null
  inReplyTo:     string | null
  sentAt:        string
  source:        string
  isRead:        boolean
  demoCall:      { id: string; contactName: string; companyName: string } | null
  contactEmail:  string
}

interface Template {
  id:      string
  name:    string
  subject: string
  body:    string
}

type Tab = "inbox" | "sent" | "compose"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CrmEmailPage() {
  const [tab,          setTab]          = useState<Tab>("inbox")
  const [inbox,        setInbox]        = useState<CrmEmail[]>([])
  const [sent,         setSent]         = useState<CrmEmail[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<CrmEmail | null>(null)
  const [replyTarget,  setReplyTarget]  = useState<CrmEmail | null>(null)
  const [composing,    setComposing]    = useState(false)    // overlay compose from header button
  const [templates,    setTemplates]    = useState<Template[]>([])
  const [syncing,      setSyncing]      = useState(false)
  const [syncMsg,      setSyncMsg]      = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const [inRes, outRes] = await Promise.all([
      fetch("/api/super-admin/crm/emails?all=true&direction=received"),
      fetch("/api/super-admin/crm/emails?all=true&direction=sent"),
    ])
    const inData  = await inRes.json()  as { emails: CrmEmail[] }
    const outData = await outRes.json() as { emails: CrmEmail[] }
    setInbox(inData.emails  ?? [])
    setSent(outData.emails  ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    fetch("/api/super-admin/crm/email-templates")
      .then(r => r.json())
      .then(d => setTemplates((d as { templates: Template[] }).templates ?? []))
      .catch(() => null)
  }, [load])

  async function syncImap() {
    setSyncing(true); setSyncMsg("")
    const res  = await fetch("/api/super-admin/crm/imap-sync", { method: "POST" })
    const data = await res.json() as { result?: { synced: number }; error?: string }
    setSyncMsg(data.error ? data.error : `Synced ${data.result?.synced ?? 0} new emails.`)
    setSyncing(false)
    void load()
  }

  async function openEmail(email: CrmEmail) {
    setSelected(email)
    if (email.direction === "received" && !email.isRead) {
      await fetch(`/api/super-admin/crm/emails/${email.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "mark_read" }),
      })
      setInbox(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e))
    }
  }

  const unreadCount = inbox.filter(e => !e.isRead).length
  const emails      = tab === "inbox" ? inbox : sent

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-white">CRM Email</h1>
          <p className="text-xs text-gray-500 mt-0.5">Unified inbox for crm@getrelay.software</p>
        </div>
        <div className="flex items-center gap-2">
          {syncMsg && <span className="text-xs text-gray-500">{syncMsg}</span>}
          <button
            onClick={syncImap}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
            Sync IMAP
          </button>
          <button
            onClick={() => { setComposing(true); setTab("inbox") }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Mail className="w-4 h-4" />
            Compose Email
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-4 border-b border-gray-800 pb-0">
        {(["inbox", "sent", "compose"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelected(null); setReplyTarget(null) }}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
              tab === t
                ? "border-indigo-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300",
            )}
          >
            {t === "inbox" ? "Inbox" : t === "sent" ? "Sent" : "Compose"}
            {t === "inbox" && unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {tab === "compose" ? (
          <div className="flex-1 p-6 overflow-y-auto">
            <ComposePanel
              templates={templates}
              onSent={() => { void load(); setTab("sent") }}
            />
          </div>
        ) : (
          <>
            {/* Email list pane */}
            <div className={cn(
              "flex flex-col border-r border-gray-800 overflow-y-auto",
              selected ? "w-72 shrink-0" : "flex-1",
            )}>
              {loading ? (
                <div className="flex items-center justify-center flex-1 py-16">
                  <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                </div>
              ) : emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 py-16 text-center px-6">
                  <Mail className="w-10 h-10 text-gray-700 mb-3" />
                  <p className="text-gray-500 text-sm">
                    {tab === "inbox" ? "No emails received yet." : "No emails sent yet."}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-800/60">
                  {emails.map(email => (
                    <EmailRow
                      key={email.id}
                      email={email}
                      isSelected={selected?.id === email.id}
                      compact={!!selected}
                      onClick={() => openEmail(email)}
                    />
                  ))}
                </ul>
              )}
            </div>

            {/* Email detail pane */}
            {selected && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <EmailDetail
                  email={selected}
                  templates={templates}
                  replyTarget={replyTarget}
                  onReply={() => setReplyTarget(selected)}
                  onCancelReply={() => setReplyTarget(null)}
                  onReplySent={() => { setReplyTarget(null); void load() }}
                  onClose={() => { setSelected(null); setReplyTarget(null) }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating compose overlay (from header button) */}
      {composing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-white">New Email</h2>
              <button onClick={() => setComposing(false)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ComposePanel
                templates={templates}
                onSent={() => { setComposing(false); void load(); setTab("sent") }}
                embedded
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Email row ─────────────────────────────────────────────────────────────────

function EmailRow({
  email, isSelected, compact, onClick,
}: {
  email: CrmEmail
  isSelected: boolean
  compact: boolean
  onClick: () => void
}) {
  const isSent    = email.direction === "sent"
  const isUnread  = !isSent && !email.isRead
  const senderDisplay = isSent
    ? `To: ${email.toAddress}`
    : email.fromAddress.match(/^(.+?)\s*</)?.[1]?.trim() ?? email.fromAddress

  return (
    <li
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors",
        isSelected ? "bg-indigo-600/20 border-l-2 border-indigo-500" : "hover:bg-gray-800/50 border-l-2 border-transparent",
        isUnread && !isSelected && "bg-gray-900",
      )}
    >
      {/* Direction icon */}
      <div className={cn(
        "mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
        isSent ? "bg-indigo-900/60 text-indigo-400" : "bg-green-900/40 text-green-400",
      )}>
        {isSent
          ? <ArrowUpRight  className="w-3.5 h-3.5" />
          : <ArrowDownLeft className="w-3.5 h-3.5" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-xs truncate", isUnread ? "text-white font-semibold" : "text-gray-300 font-medium")}>
            {senderDisplay}
          </span>
          <span className="text-[10px] text-gray-600 whitespace-nowrap shrink-0">
            {new Date(email.sentAt).toLocaleDateString([], { month: "short", day: "numeric" })}
          </span>
        </div>
        <p className={cn("text-xs truncate mt-0.5", isUnread ? "text-gray-200" : "text-gray-400")}>
          {email.subject}
        </p>
        {!compact && (
          <>
            <p className="text-xs text-gray-600 truncate mt-0.5">
              {email.bodyText.slice(0, 100)}
            </p>
            {email.demoCall ? (
              <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-400">
                {email.demoCall.contactName}
              </span>
            ) : (
              <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-600">
                Unknown Contact
              </span>
            )}
          </>
        )}
      </div>
      {isUnread && !isSelected && (
        <div className="mt-2 shrink-0 w-2 h-2 rounded-full bg-indigo-500" />
      )}
    </li>
  )
}

// ─── Email detail ──────────────────────────────────────────────────────────────

function EmailDetail({
  email, templates, replyTarget, onReply, onCancelReply, onReplySent, onClose,
}: {
  email:         CrmEmail
  templates:     Template[]
  replyTarget:   CrmEmail | null
  onReply:       () => void
  onCancelReply: () => void
  onReplySent:   () => void
  onClose:       () => void
}) {
  const isSent = email.direction === "sent"

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Detail header */}
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-800">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white truncate">{email.subject}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isSent
              ? `To: ${email.toAddress}`
              : `From: ${email.fromAddress}`}
            <span className="mx-1.5">·</span>
            {new Date(email.sentAt).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
          {email.demoCall && (
            <Link
              href={`/super-admin/crm/demo-calls/${email.demoCall.id}`}
              className="text-xs text-indigo-400 hover:text-indigo-300 mt-0.5 inline-block"
            >
              {email.demoCall.contactName} — {email.demoCall.companyName} →
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!replyTarget && (
            <button
              onClick={onReply}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
            >
              <Reply className="w-3.5 h-3.5" />
              Reply
            </button>
          )}
          <button onClick={onClose} className="text-gray-600 hover:text-white p-1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div
          className="text-sm text-gray-300 leading-relaxed [&_a]:text-indigo-400 [&_ul]:list-disc [&_ul]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-600 [&_blockquote]:pl-3 [&_blockquote]:text-gray-500 [&_pre]:whitespace-pre-wrap [&_pre]:text-xs"
          dangerouslySetInnerHTML={{ __html: email.bodyHtml || `<pre>${email.bodyText}</pre>` }}
        />
      </div>

      {/* Inline reply composer */}
      {replyTarget && (
        <div className="border-t border-gray-800 bg-gray-950">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Replying to {email.fromAddress}
            </span>
            <button onClick={onCancelReply} className="text-gray-600 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-4 pb-4">
            <InlineCompose
              to={email.fromAddress.match(/<(.+)>/)?.[1] ?? email.fromAddress}
              initialSubject={`Re: ${email.subject}`}
              initialBody={`<br><br><blockquote style="border-left:2px solid #555;padding-left:12px;color:#888;margin:0">${email.bodyHtml}</blockquote>`}
              inReplyTo={email.messageId ?? undefined}
              demoCallId={email.demoCall?.id}
              templates={templates}
              onSent={onReplySent}
              onCancel={onCancelReply}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Compose panel (tab + modal) ──────────────────────────────────────────────

function ComposePanel({
  templates, onSent, embedded,
}: {
  templates: Template[]
  onSent:    () => void
  embedded?: boolean
}) {
  return (
    <InlineCompose
      templates={templates}
      onSent={onSent}
      fullPage={!embedded}
    />
  )
}

// ─── Shared compose form ──────────────────────────────────────────────────────

function InlineCompose({
  to: defaultTo = "",
  initialSubject = "",
  initialBody,
  inReplyTo,
  demoCallId,
  templates,
  onSent,
  onCancel,
  fullPage,
}: {
  to?:            string
  initialSubject?: string
  initialBody?:   string
  inReplyTo?:     string
  demoCallId?:    string
  templates:      Template[]
  onSent:         () => void
  onCancel?:      () => void
  fullPage?:      boolean
}) {
  const [to,       setTo]      = useState(defaultTo)
  const [cc,       setCc]      = useState("")
  const [subject,  setSubject] = useState(initialSubject)
  const [sending,  setSending] = useState(false)
  const [error,    setError]   = useState("")
  const [success,  setSuccess] = useState(false)
  const [showCc,   setShowCc]  = useState(false)
  const [showTpl,  setShowTpl] = useState(false)
  const editorRef              = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (initialBody && editorRef.current) {
      editorRef.current.innerHTML = initialBody
    }
  }, [initialBody])

  function applyTemplate(t: Template) {
    setSubject(t.subject)
    if (editorRef.current) editorRef.current.innerHTML = t.body.replace(/\n/g, "<br>")
    setShowTpl(false)
  }

  function execCmd(cmd: string, val?: string) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
  }

  function insertLink() {
    const url = prompt("Enter URL:", "https://")
    if (url) execCmd("createLink", url)
  }

  async function handleSend() {
    const bodyHtml = editorRef.current?.innerHTML?.trim() ?? ""
    if (!to || !subject || !bodyHtml) {
      setError("To, Subject, and Body are required.")
      return
    }
    setSending(true); setError("")
    try {
      const res = await fetch("/api/super-admin/crm/emails", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          to, cc: cc || undefined, subject, bodyHtml,
          inReplyTo, demoCallId,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error: string }
        setError(d.error ?? "Failed to send."); return
      }
      setSuccess(true)
      setTimeout(onSent, 1200)
    } catch {
      setError("Network error — please try again.")
    } finally {
      setSending(false)
    }
  }

  const wrapCls = fullPage
    ? "bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
    : ""

  return (
    <div className={wrapCls}>
      {/* Fields */}
      <div className={cn("border-gray-800 px-5 py-3 space-y-2", fullPage ? "border-b" : "border-b border-gray-800")}>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-8 shrink-0">To</span>
          <input
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder-gray-600"
          />
          {!showCc && (
            <button onClick={() => setShowCc(true)} className="text-xs text-gray-600 hover:text-gray-300">+ CC</button>
          )}
        </div>
        {showCc && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-8 shrink-0">CC</span>
            <input
              value={cc}
              onChange={e => setCc(e.target.value)}
              placeholder="cc@example.com"
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder-gray-600"
            />
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-8 shrink-0">Sub</span>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder-gray-600"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800">
        <ToolBtn title="Bold"        onClick={() => execCmd("bold")}>                    <Bold   className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="Italic"      onClick={() => execCmd("italic")}>                  <Italic className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="Bullet list" onClick={() => execCmd("insertUnorderedList")}>     <List   className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="Link"        onClick={insertLink}>                               <Link2  className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="Clear"       onClick={() => execCmd("removeFormat")}>            <RotateCcw className="w-3.5 h-3.5" /></ToolBtn>
        <div className="flex-1" />
        <div className="relative">
          <button
            onClick={() => setShowTpl(v => !v)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            Templates <ChevronDown className="w-3 h-3" />
          </button>
          {showTpl && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden">
              {templates.length === 0 ? (
                <p className="text-xs text-gray-500 px-4 py-3">No templates. Add them in CRM Settings.</p>
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
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          "px-5 py-4 text-sm text-gray-200 outline-none leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-indigo-400 [&_a]:underline",
          fullPage ? "min-h-[280px]" : "min-h-[140px]",
        )}
        style={{ wordBreak: "break-word" }}
      />

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-800 flex items-center gap-3">
        {error   && <p className="text-xs text-red-400 flex-1">{error}</p>}
        {success && <p className="text-xs text-green-400 flex-1">Email sent!</p>}
        {!error && !success && <span className="flex-1" />}
        {onCancel && (
          <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5">
            Cancel
          </button>
        )}
        <button
          onClick={handleSend}
          disabled={sending || success}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  )
}

function ToolBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
    >
      {children}
    </button>
  )
}
