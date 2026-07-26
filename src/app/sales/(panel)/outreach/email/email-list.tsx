"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Mail, Inbox, Send, Search, X } from "lucide-react"

interface EmailEntry {
  id:           string
  subject:      string
  sentAt:       string
  contactEmail: string
  fromAddress?: string
  followUpDate?: string | null
  followUpDoneAt?: string | null
  demoCall?: { id: string; companyName: string; contactName: string } | null
}

export function EmailList({
  sent,
  received,
}: {
  sent:     EmailEntry[]
  received: EmailEntry[]
}) {
  const [query, setQuery] = useState("")

  const q = query.toLowerCase().trim()

  function matchSent(e: EmailEntry): boolean {
    if (!q) return true
    return (
      e.subject.toLowerCase().includes(q) ||
      e.contactEmail.toLowerCase().includes(q) ||
      (e.demoCall?.companyName ?? "").toLowerCase().includes(q) ||
      (e.demoCall?.contactName ?? "").toLowerCase().includes(q)
    )
  }

  function matchReceived(e: EmailEntry): boolean {
    if (!q) return true
    return (
      e.subject.toLowerCase().includes(q) ||
      (e.fromAddress ?? "").toLowerCase().includes(q) ||
      (e.demoCall?.companyName ?? "").toLowerCase().includes(q) ||
      (e.demoCall?.contactName ?? "").toLowerCase().includes(q)
    )
  }

  const filteredSent     = useMemo(() => sent.filter(matchSent),     [sent, q])
  const filteredReceived = useMemo(() => received.filter(matchReceived), [received, q])

  const now = new Date()

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by subject, sender, company, or contact…"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-600 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {q && (
        <p className="text-xs text-gray-500 mb-4">
          {filteredSent.length + filteredReceived.length} result{(filteredSent.length + filteredReceived.length) !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
        </p>
      )}

      {/* Unread section */}
      {(!q || filteredReceived.length > 0) && filteredReceived.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Unread ({filteredReceived.length})
          </h2>
          <div className="space-y-2">
            {filteredReceived.map(email => (
              <Link
                key={email.id}
                href={email.demoCall ? `/super-admin/crm/demo-calls/${email.demoCall.id}` : "/super-admin/crm"}
                className="block bg-gray-900 border border-blue-900/40 rounded-xl p-4 hover:bg-gray-800/70 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <p className="text-sm font-semibold text-white truncate">{email.subject}</p>
                    </div>
                    <p className="text-xs text-gray-400 ml-4">{email.fromAddress}</p>
                    {email.demoCall && (
                      <p className="text-xs text-gray-600 ml-4 mt-0.5">{email.demoCall.companyName} · {email.demoCall.contactName}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">
                    {formatDistanceToNow(new Date(email.sentAt), { addSuffix: true })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sent section */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <Send className="w-4 h-4" />
          Sent ({filteredSent.length})
          {q && sent.length !== filteredSent.length && (
            <span className="text-gray-600 font-normal">of {sent.length}</span>
          )}
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800/60">
            {filteredSent.map(email => {
              const followUpDue = email.followUpDate && !email.followUpDoneAt && new Date(email.followUpDate) < now
              return (
                <Link
                  key={email.id}
                  href={email.demoCall ? `/super-admin/crm/demo-calls/${email.demoCall.id}` : "/super-admin/crm"}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-800/40 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{email.subject}</p>
                    {email.demoCall && (
                      <p className="text-xs text-gray-500 truncate">
                        {email.demoCall.companyName} · {email.contactEmail}
                      </p>
                    )}
                  </div>
                  {followUpDue && (
                    <span className="text-xs text-orange-400 font-medium shrink-0">Reminder due</span>
                  )}
                  <span className="text-xs text-gray-600 shrink-0">
                    {formatDistanceToNow(new Date(email.sentAt), { addSuffix: true })}
                  </span>
                </Link>
              )
            })}
          </div>
          {filteredSent.length === 0 && (
            <div className="text-center py-12 text-gray-600 text-sm">
              {q ? `No sent emails matching "${query}"` : "No sent emails"}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
