"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  AlertCircle, Clock, Mail, CheckCircle, Building2,
  ArrowLeft, ArrowUpRight, ArrowDownLeft, Send, Loader2, X, Calendar, Eye, EyeOff,
} from "lucide-react"
import { EmailActionMenu } from "@/components/crm/email-action-menu"

// ─── Types ────────────────────────────────────────────────────────────────────

interface FollowUp {
  id:              string
  contactEmail:    string
  subject:         string
  sentAt:          string
  followUpDate:    string
  stageNumber:     number
  stageName:       string
  dueStageNumber:  number
  dueStageName:    string
  sequenceComplete:boolean
  demoCallId:      string | null
  demoCall:        { id: string; contactName: string; companyName: string; contactEmail: string } | null
  openedAt:        string | null
  openCount:       number
  lastOpenedAt:    string | null
  hasReply:        boolean
}

interface CrmEmail {
  id:             string
  direction:      "sent" | "received"
  fromAddress:    string
  toAddress:      string
  subject:        string
  bodyHtml:       string
  bodyText:       string
  messageId:      string | null
  sentAt:         string
  isArchived:     boolean
  followUpDate:   string | null
  followUpDoneAt: string | null
  openedAt:       string | null
  openCount:      number
  lastOpenedAt:   string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000)
}

function urgency(followUpDate: string): "overdue" | "today" | "upcoming" {
  const d = new Date(followUpDate)
  const n = new Date()
  if (d < n && d.toDateString() !== n.toDateString()) return "overdue"
  if (d.toDateString() === n.toDateString()) return "today"
  return "upcoming"
}

function dueLabel(followUpDate: string): string {
  const d   = new Date(followUpDate)
  const now = new Date()
  if (d < now && d.toDateString() !== now.toDateString()) {
    const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
    return `Overdue by ${days}d`
  }
  if (d.toDateString() === now.toDateString()) return "Due today"
  const days = Math.ceil((d.getTime() - now.getTime()) / 86_400_000)
  return `Due in ${days}d`
}

const URGENCY_STYLES = {
  overdue:  { row: "border-l-red-500",    badge: "bg-red-900/50 text-red-300",    icon: "text-red-400" },
  today:    { row: "border-l-orange-500", badge: "bg-orange-900/50 text-orange-300", icon: "text-orange-400" },
  upcoming: { row: "border-l-transparent",badge: "bg-gray-800 text-gray-400",     icon: "text-gray-500" },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FollowUpsPage() {
  const [followUps,   setFollowUps]   = useState<FollowUp[]>([])
  const [loading,     setLoading]     = useState(true)
  const [selectedId,  setSelectedId]  = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/sales/follow-ups")
      const data = await res.json() as { emails: FollowUp[] }
      setFollowUps(data.emails ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const selected = followUps.find(f => f.id === selectedId) ?? null

  const overdue  = followUps.filter(f => urgency(f.followUpDate) === "overdue")
  const today    = followUps.filter(f => urgency(f.followUpDate) === "today")
  const upcoming = followUps.filter(f => urgency(f.followUpDate) === "upcoming")

  function selectItem(id: string) {
    setSelectedId(prev => prev === id ? null : id)
  }

  async function ignoreReminder(emailId: string) {
    await fetch(`/api/super-admin/crm/emails/${emailId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "mark_followup_done" }),
    })
    setFollowUps(prev => prev.filter(f => f.id !== emailId))
    if (selectedId === emailId) setSelectedId(null)
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: follow-up list ── */}
      <div className={cn(
        "flex flex-col border-r border-gray-800 bg-gray-900 overflow-y-auto",
        selected ? "hidden md:flex md:w-80 lg:w-96 shrink-0" : "flex-1",
      )}>
        <div className="px-5 py-4 border-b border-gray-800 shrink-0">
          <h1 className="text-base font-bold text-white">Follow-Ups</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {loading ? "Loading…" :
             followUps.length === 0 ? "All caught up" :
             `${followUps.length} pending`}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
          </div>
        ) : followUps.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20 text-center px-6">
            <CheckCircle className="w-12 h-12 text-emerald-600 mb-3" />
            <p className="text-gray-400 font-medium">All caught up!</p>
            <p className="text-gray-600 text-sm mt-1">No follow-up reminders pending.</p>
          </div>
        ) : (
          <div className="flex-1">
            {overdue.length > 0 && (
              <Section label="Overdue" count={overdue.length} icon={AlertCircle} color="text-red-400">
                {overdue.map(f => (
                  <FollowUpRow
                    key={f.id}
                    item={f}
                    isSelected={selectedId === f.id}
                    onSelect={() => selectItem(f.id)}
                    onIgnore={() => void ignoreReminder(f.id)}
                  />
                ))}
              </Section>
            )}
            {today.length > 0 && (
              <Section label="Due Today" count={today.length} icon={Clock} color="text-orange-400">
                {today.map(f => (
                  <FollowUpRow
                    key={f.id}
                    item={f}
                    isSelected={selectedId === f.id}
                    onSelect={() => selectItem(f.id)}
                    onIgnore={() => void ignoreReminder(f.id)}
                  />
                ))}
              </Section>
            )}
            {upcoming.length > 0 && (
              <Section label="Upcoming" count={upcoming.length} icon={Clock} color="text-gray-400">
                {upcoming.map(f => (
                  <FollowUpRow
                    key={f.id}
                    item={f}
                    isSelected={selectedId === f.id}
                    onSelect={() => selectItem(f.id)}
                    onIgnore={() => void ignoreReminder(f.id)}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>

      {/* ── Right: thread detail ── */}
      <div className={cn("flex-1 flex flex-col min-h-0", !selected && "hidden md:flex")}>
        {selected ? (
          <ThreadDetail
            followUp={selected}
            onBack={() => setSelectedId(null)}
            onIgnore={() => void ignoreReminder(selected.id)}
            onSent={load}
          />
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
            <Mail className="w-12 h-12 text-gray-700 mb-3" />
            <p className="text-gray-500 text-sm">Select a follow-up to view the conversation</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ label, count, icon: Icon, color, children }: {
  label: string; count: number; icon: React.ElementType; color: string; children: React.ReactNode
}) {
  return (
    <div>
      <div className={`flex items-center gap-2 px-5 py-2.5 border-b border-gray-800 bg-gray-900/80 sticky top-0 z-10`}>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className={`text-xs font-semibold ${color}`}>{label}</span>
        <span className="text-xs text-gray-600">({count})</span>
      </div>
      {children}
    </div>
  )
}

// ─── Follow-up row ────────────────────────────────────────────────────────────

function FollowUpRow({ item, isSelected, onSelect, onIgnore }: {
  item:       FollowUp
  isSelected: boolean
  onSelect:   () => void
  onIgnore:   () => void
}) {
  const u        = urgency(item.followUpDate)
  const styles   = URGENCY_STYLES[u]
  const ds       = daysSince(item.sentAt)
  const isWarm   = !!item.openedAt && !item.hasReply

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 px-5 py-3.5 cursor-pointer border-b border-gray-800/60 border-l-2 transition-colors",
        isWarm ? "border-l-amber-500" : styles.row,
        isSelected ? "bg-emerald-600/10" : "hover:bg-gray-800/40",
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "shrink-0 w-9 h-9 rounded-full text-sm font-bold flex items-center justify-center",
        isWarm ? "bg-amber-900/40 text-amber-300" : "bg-emerald-900/50 text-emerald-300",
      )}>
        {(item.demoCall?.contactName ?? item.contactEmail).charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-sm font-semibold text-white truncate">
            {item.demoCall?.contactName ?? item.contactEmail}
          </span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${styles.badge}`}>
            {dueLabel(item.followUpDate)}
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate mb-0.5">{item.subject}</p>
        {!item.sequenceComplete && (
          <p className="text-[11px] text-emerald-500/70 mb-0.5 truncate">
            → {item.dueStageName}
          </p>
        )}
        {item.sequenceComplete && (
          <p className="text-[11px] text-gray-600 mb-0.5">Sequence complete</p>
        )}
        <div className="flex items-center gap-3 text-[11px] text-gray-600 flex-wrap">
          {item.demoCall && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {item.demoCall.companyName}
            </span>
          )}
          <span>{ds === 0 ? "Sent today" : `${ds}d since sent`}</span>
          {isWarm && (
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <Eye className="w-3 h-3" />
              Warm — opened{item.openCount > 1 ? ` ${item.openCount}×` : ""}, no reply
            </span>
          )}
          {item.openedAt && item.hasReply && (
            <span className="flex items-center gap-1 text-emerald-500">
              <Eye className="w-3 h-3" />
              Opened · replied
            </span>
          )}
          {!item.openedAt && (
            <span className="flex items-center gap-1">
              <EyeOff className="w-3 h-3" />
              Not opened
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Thread detail ────────────────────────────────────────────────────────────

function ThreadDetail({ followUp, onBack, onIgnore, onSent }: {
  followUp: FollowUp
  onBack:   () => void
  onIgnore: () => void
  onSent:   () => void
}) {
  const [threadEmails, setThreadEmails] = useState<CrmEmail[]>([])
  const [loadingThread,setLoadingThread]= useState(true)
  const [expanded,     setExpanded]     = useState<Record<string, boolean>>({})
  const [replyText,    setReplyText]    = useState("")
  const [sending,      setSending]      = useState(false)
  const [error,        setError]        = useState("")
  const [ignoring,     setIgnoring]     = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadThread = useCallback(async () => {
    setLoadingThread(true)
    try {
      const param = followUp.demoCallId
        ? `demoCallId=${followUp.demoCallId}`
        : `contactEmail=${encodeURIComponent(followUp.contactEmail)}`
      const res  = await fetch(`/api/super-admin/crm/emails?${param}`)
      const data = await res.json() as { emails: CrmEmail[] }
      const emails = data.emails ?? []
      setThreadEmails(emails)
      // Auto-expand the trigger email + last email
      const last = emails[emails.length - 1]
      const trigger = emails.find(e => e.id === followUp.id)
      const toExpand: Record<string, boolean> = {}
      if (trigger) toExpand[trigger.id] = true
      if (last && last.id !== trigger?.id) toExpand[last.id] = true
      setExpanded(toExpand)
    } finally {
      setLoadingThread(false)
    }
  }, [followUp.id, followUp.demoCallId])

  useEffect(() => {
    void loadThread()
    setReplyText("")
    setError("")
  }, [loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [threadEmails])

  async function sendReply() {
    if (!replyText.trim()) return
    setSending(true); setError("")
    const last     = threadEmails[threadEmails.length - 1]
    const replyTo  = followUp.demoCall?.contactEmail ?? followUp.contactEmail
    const bodyHtml = `<p>${replyText.replace(/\n/g, "<br>")}</p>`
    try {
      const res = await fetch("/api/super-admin/crm/emails", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          to:         replyTo,
          subject:    `Re: ${followUp.subject}`,
          bodyHtml,
          inReplyTo:  last?.messageId ?? null,
          threadId:   last?.id ?? null,
          demoCallId: followUp.demoCallId,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setError(d.error ?? `Error ${res.status}`); return
      }
      // Mark the reminder done after sending
      await fetch(`/api/super-admin/crm/emails/${followUp.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "mark_followup_done" }),
      })
      setReplyText("")
      onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSending(false)
    }
  }

  async function handleIgnore() {
    setIgnoring(true)
    await onIgnore()
    setIgnoring(false)
  }

  const contactName    = followUp.demoCall?.contactName ?? followUp.contactEmail
  const contactCompany = followUp.demoCall?.companyName ?? ""
  const ds             = daysSince(followUp.sentAt)

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
          <h2 className="text-sm font-semibold text-white truncate">{followUp.subject}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {contactName}
            {contactCompany && ` · ${contactCompany}`}
            <span className="mx-1.5">·</span>
            {ds === 0 ? "sent today" : `${ds}d since last contact`}
          </p>
        </div>

        {/* Ignore button — dismisses the reminder without sending */}
        <button
          onClick={handleIgnore}
          disabled={ignoring}
          className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          {ignoring ? "Ignoring…" : "Ignore"}
        </button>
      </div>

      {/* Email thread */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loadingThread ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
          </div>
        ) : threadEmails.length === 0 ? (
          <div className="text-center py-16 text-gray-600 text-sm">No email history found.</div>
        ) : (
          threadEmails.map(email => {
            const isOpen   = expanded[email.id] ?? false
            const isSent   = email.direction === "sent"
            const isTarget = email.id === followUp.id
            const sender   = isSent ? "You" : (followUp.demoCall?.contactName ?? email.fromAddress)

            return (
              <div
                key={email.id}
                className={cn(
                  "bg-gray-900 border rounded-xl overflow-hidden",
                  isTarget ? "border-emerald-800/60" : "border-gray-800",
                )}
              >
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
                      {isTarget && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 font-medium">
                          reminder on this
                        </span>
                      )}
                      {isSent && (
                        email.openedAt ? (
                          <span
                            className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium bg-emerald-900/40 text-emerald-400"
                            title={`First opened ${new Date(email.openedAt).toLocaleString()}`}
                          >
                            <Eye className="w-2.5 h-2.5" />
                            {email.openCount > 1 ? `Opened ${email.openCount}×` : "Opened"}
                          </span>
                        ) : (
                          <span className="text-[10px] flex items-center gap-1 text-gray-600">
                            <EyeOff className="w-2.5 h-2.5" />
                            Not opened
                          </span>
                        )
                      )}
                      {!isOpen && (
                        <span className="text-xs text-gray-600 truncate max-w-48">{email.bodyText.slice(0, 60)}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-600">
                      {isSent ? `To: ${email.toAddress}` : `From: ${email.fromAddress}`}
                      <span className="mx-1">·</span>
                      {new Date(email.sentAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <EmailActionMenu
                    emailId={email.id}
                    subject={email.subject}
                    isArchived={email.isArchived ?? false}
                    onSuccess={loadThread}
                  />
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-800">
                    {email.bodyHtml ? (
                      <div
                        className="text-sm text-gray-300 leading-relaxed [&_a]:text-emerald-400 [&_ul]:list-disc [&_ul]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-600 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600 max-w-none"
                        dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
                      />
                    ) : (
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{email.bodyText}</pre>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply composer */}
      <div className="shrink-0 border-t border-gray-800 bg-gray-950 px-5 py-4">
        <p className="text-[10px] text-gray-600 mb-2">
          Send follow-up to {followUp.demoCall?.contactEmail ?? followUp.contactEmail}
          <span className="ml-2 text-gray-700">— reminder will clear on send</span>
        </p>
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <div className="flex items-end gap-3">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && e.metaKey) void sendReply() }}
            rows={3}
            placeholder="Write your follow-up… (⌘Enter to send)"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={sendReply}
              disabled={sending || !replyText.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
            <button
              onClick={handleIgnore}
              disabled={ignoring}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-400 hover:text-white text-sm rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
              Ignore
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
