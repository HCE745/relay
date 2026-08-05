"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Mail, ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, Reply,
  Calendar, CheckCircle2, Clock, X, Archive, Eye, EyeOff,
} from "lucide-react"
import { CrmEmailCompose } from "@/components/super-admin/crm-email-compose"
import { EmailActionMenu } from "@/components/crm/email-action-menu"

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
  source:         string
  isArchived:     boolean
  followUpDate:   string | null
  followUpDoneAt: string | null
  openedAt:       string | null
  openCount:      number
  lastOpenedAt:   string | null
}

interface DemoCallCtx {
  id:           string
  contactName:  string
  contactEmail: string
  companyName:  string
  scheduledAt?: string | null
}

export function CrmEmailThread({ demoCall }: { demoCall: DemoCallCtx }) {
  const [emails,     setEmails]     = useState<CrmEmail[]>([])
  const [loading,    setLoading]    = useState(true)
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({})
  const [composing,  setComposing]  = useState(false)
  const [replyTo,    setReplyTo]    = useState<CrmEmail | null>(null)
  const [followupId,      setFollowupId]      = useState<string | null>(null)
  const [customDays,      setCustomDays]      = useState("")
  const [savingFp,        setSavingFp]        = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [syncingImap, setSyncingImap] = useState(false)
  const [syncMsg,    setSyncMsg]    = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/super-admin/crm/emails?demoCallId=${demoCall.id}`)
    const data = await res.json() as { emails: CrmEmail[] }
    setEmails(data.emails ?? [])
    setLoading(false)
  }, [demoCall.id])

  useEffect(() => { void load() }, [load])

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function openReply(email: CrmEmail) {
    setReplyTo(email)
    setComposing(true)
  }

  async function setFollowupInDays(emailId: string, days: number) {
    setSavingFp(true)
    const due = new Date()
    due.setDate(due.getDate() + days)
    const dateStr = due.toISOString().split("T")[0]
    await fetch(`/api/super-admin/crm/emails/${emailId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "set_followup", followUpDate: dateStr }),
    })
    setSavingFp(false)
    setFollowupId(null)
    setCustomDays("")
    setShowCustomInput(false)
    void load()
  }

  async function markFollowupDone(emailId: string) {
    await fetch(`/api/super-admin/crm/emails/${emailId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "mark_followup_done" }),
    })
    void load()
  }

  async function syncImap() {
    setSyncingImap(true)
    setSyncMsg("")
    const res  = await fetch("/api/super-admin/crm/imap-sync", { method: "POST" })
    const data = await res.json() as { result?: { synced: number; skipped: number; errors: string[] }; error?: string }
    if (data.error) {
      setSyncMsg(data.error)
    } else if (data.result) {
      setSyncMsg(`Synced ${data.result.synced} new email${data.result.synced !== 1 ? "s" : ""}.`)
      void load()
    }
    setSyncingImap(false)
  }

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Mail className="w-4 h-4 text-indigo-400" />
          Email Thread
          {emails.length > 0 && (
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{emails.length}</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {syncMsg && <span className="text-xs text-gray-500">{syncMsg}</span>}
          <button
            onClick={syncImap}
            disabled={syncingImap}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
          >
            {syncingImap ? "Syncing…" : "Sync IMAP"}
          </button>
          <button
            onClick={() => { setReplyTo(null); setComposing(true) }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Compose Email
          </button>
        </div>
      </div>

      {/* Email list */}
      <div className="space-y-2">
        {loading ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-8 text-center">
            <p className="text-sm text-gray-500">Loading emails…</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-8 text-center">
            <Mail className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No emails yet with {demoCall.contactName}.</p>
            <p className="text-xs text-gray-600 mt-1">Compose an email or sync IMAP to see history.</p>
          </div>
        ) : (
          emails.map(email => {
            const isExpanded    = expanded[email.id]
            const isSent        = email.direction === "sent"
            const hasFollowup   = email.followUpDate !== null
            const followupDone  = email.followUpDoneAt !== null
            const followupOverdue = hasFollowup && !followupDone && new Date(email.followUpDate!) < new Date()

            return (
              <div
                key={email.id}
                className={`bg-gray-900 border rounded-xl overflow-hidden ${
                  email.isArchived ? "border-gray-700/50 opacity-70" : "border-gray-800"
                }`}
              >
                {/* Email row */}
                <div
                  className="flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-800/40 transition-colors"
                  onClick={() => toggleExpand(email.id)}
                >
                  {/* Direction indicator */}
                  <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                    isSent ? "bg-indigo-900/60 text-indigo-400" : "bg-green-900/40 text-green-400"
                  }`}>
                    {isSent
                      ? <ArrowUpRight  className="w-3.5 h-3.5" />
                      : <ArrowDownLeft className="w-3.5 h-3.5" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">
                        {email.subject}
                      </span>
                      {email.isArchived && (
                        <span className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium bg-gray-700 text-gray-400">
                          <Archive className="w-2.5 h-2.5" />
                          Archived
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
                      {hasFollowup && !followupDone && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          followupOverdue ? "bg-red-900/40 text-red-400" : "bg-yellow-900/30 text-yellow-400"
                        }`}>
                          follow-up {followupOverdue ? "overdue" : new Date(email.followUpDate!).toLocaleDateString()}
                        </span>
                      )}
                      {followupDone && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-900/30 text-green-500">
                          follow-up done
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isSent ? `To: ${email.toAddress}` : `From: ${email.fromAddress}`}
                      <span className="mx-1.5">·</span>
                      {new Date(email.sentAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      <span className="mx-1.5">·</span>
                      <span className="text-gray-600">{email.source === "imap_sync" ? "IMAP" : email.source === "inbound_webhook" ? "Inbound" : "Sent via CRM"}</span>
                    </p>
                    {!isExpanded && (
                      <p className="text-xs text-gray-600 mt-1 truncate">
                        {email.bodyText.slice(0, 100)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Three-dot action menu */}
                    <EmailActionMenu
                      emailId={email.id}
                      subject={email.subject}
                      isArchived={email.isArchived}
                      onSuccess={load}
                    />
                    <span className="text-gray-600">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </div>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="border-t border-gray-800 px-4 pb-4 pt-3">
                    <div
                      className="text-sm text-gray-300 leading-relaxed prose-sm max-w-none [&_a]:text-indigo-400 [&_ul]:list-disc [&_ul]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-600 [&_blockquote]:pl-3 [&_blockquote]:text-gray-500"
                      dangerouslySetInnerHTML={{ __html: email.bodyHtml || `<pre class="whitespace-pre-wrap">${email.bodyText}</pre>` }}
                    />

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      <button
                        onClick={() => openReply(email)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        Reply
                      </button>

                      {/* Follow-up reminder */}
                      {!hasFollowup ? (
                        followupId === email.id ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-gray-500 mr-1">Remind me in:</span>
                            {[3, 5, 7, 14, 30].map(d => (
                              <button
                                key={d}
                                onClick={() => setFollowupInDays(email.id, d)}
                                disabled={savingFp}
                                className="text-xs px-2.5 py-1.5 bg-yellow-900/40 hover:bg-yellow-800/60 border border-yellow-800/50 text-yellow-300 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {d}d
                              </button>
                            ))}
                            {showCustomInput ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  max="365"
                                  value={customDays}
                                  onChange={e => setCustomDays(e.target.value)}
                                  placeholder="days"
                                  className="w-16 text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white"
                                />
                                <button
                                  onClick={() => { const d = parseInt(customDays); if (d > 0) setFollowupInDays(email.id, d) }}
                                  disabled={savingFp || !customDays}
                                  className="text-xs px-2 py-1.5 bg-yellow-700/60 hover:bg-yellow-700 text-yellow-200 rounded-lg disabled:opacity-50"
                                >
                                  {savingFp ? "…" : "Set"}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowCustomInput(true)}
                                className="text-xs px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors"
                              >
                                Custom
                              </button>
                            )}
                            <button onClick={() => { setFollowupId(null); setShowCustomInput(false) }} className="text-gray-500 hover:text-white ml-1">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setFollowupId(email.id) }}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Set Reminder
                          </button>
                        )
                      ) : !followupDone ? (
                        <button
                          onClick={() => markFollowupDone(email.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-900/40 hover:bg-green-900/70 text-green-400 hover:text-green-300 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Done
                        </button>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-green-600 px-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Reminder done
                        </span>
                      )}

                      {hasFollowup && !followupDone && (
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          <Clock className="w-3 h-3" />
                          Due {new Date(email.followUpDate!).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Compose modal */}
      {composing && (
        <CrmEmailCompose
          demoCallId={demoCall.id}
          toEmail={demoCall.contactEmail}
          demoCtx={{ contactName: demoCall.contactName, companyName: demoCall.companyName, scheduledAt: demoCall.scheduledAt }}
          inReplyTo={replyTo?.messageId ?? undefined}
          threadId={replyTo?.id ?? undefined}
          initialSubject={replyTo ? `Re: ${replyTo.subject}` : undefined}
          initialBody={replyTo
            ? `<br><br><blockquote style="border-left:2px solid #555;padding-left:12px;color:#888;margin:0">${replyTo.bodyHtml}</blockquote>`
            : undefined
          }
          onClose={() => { setComposing(false); setReplyTo(null) }}
          onSent={load}
        />
      )}
    </div>
  )
}
