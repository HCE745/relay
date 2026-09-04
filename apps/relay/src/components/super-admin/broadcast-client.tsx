"use client"

import { useState } from "react"
import { Send, Loader2, AlertCircle, CheckCircle, Megaphone, Users, Building2, Calendar } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Org { id: string; name: string; plan: string }
interface Broadcast {
  id:             string
  title:          string
  body:           string
  targetType:     string
  targetPlan:     string | null
  targetOrgId:    string | null
  sentAt:         Date | string
  recipientCount: number
}

interface Props {
  broadcasts: Broadcast[]
  orgs:       Org[]
}

export function BroadcastClient({ broadcasts: initial, orgs }: Props) {
  const [broadcasts,  setBroadcasts]  = useState<Broadcast[]>(initial)
  const [title,       setTitle]       = useState("")
  const [body,        setBody]        = useState("")
  const [targetType,  setTargetType]  = useState<string>("all")
  const [targetPlan,  setTargetPlan]  = useState<string>("essentials")
  const [targetOrgId, setTargetOrgId] = useState<string>(orgs[0]?.id ?? "")
  const [sendEmail,   setSendEmail]   = useState(true)
  const [sending,     setSending]     = useState(false)
  const [success,     setSuccess]     = useState<string | null>(null)
  const [error,       setError]       = useState("")

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSending(true)
    setError("")
    setSuccess(null)
    try {
      const res = await fetch("/api/super-admin/broadcast", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title:      title.trim(),
          body:       body.trim(),
          targetType,
          targetPlan:  targetType === "plan" ? targetPlan  : undefined,
          targetOrgId: targetType === "org"  ? targetOrgId : undefined,
          sendEmail,
        }),
      })
      const j = await res.json() as { broadcast?: Broadcast; recipientCount?: number; error?: string }
      if (!res.ok) { setError(j.error ?? "Failed to send"); return }
      setBroadcasts(prev => [j.broadcast!, ...prev])
      setSuccess(`Sent to ${j.recipientCount} recipient(s)!`)
      setTitle("")
      setBody("")
    } catch {
      setError("Network error")
    } finally {
      setSending(false)
    }
  }

  const plans = Array.from(new Set(orgs.map(o => o.plan))).sort()

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Broadcast Messaging</h1>
        <p className="text-sm text-gray-500 mt-1">Send in-app notifications and emails to customers</p>
      </div>

      {/* Compose form */}
      <form onSubmit={handleSend} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-blue-600" />
          New Broadcast
        </h2>

        {success && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />{success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Subject / Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. New feature: Issue Templates"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={5}
            placeholder="Write your message here…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Audience */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Audience</label>
            <select
              value={targetType}
              onChange={e => setTargetType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="all">All customers</option>
              <option value="trial">Trial accounts only</option>
              <option value="plan">Specific plan</option>
              <option value="org">Specific organization</option>
            </select>
          </div>

          {targetType === "plan" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Plan</label>
              <select
                value={targetPlan}
                onChange={e => setTargetPlan(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white capitalize"
              >
                {plans.map(p => (
                  <option key={p} value={p} className="capitalize">{p}</option>
                ))}
              </select>
            </div>
          )}

          {targetType === "org" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Organization</label>
              <select
                value={targetOrgId}
                onChange={e => setTargetOrgId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Email toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={e => setSendEmail(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-sm text-gray-700">Also send as email (via Resend)</span>
        </label>

        <button
          type="submit"
          disabled={sending || !title.trim() || !body.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending…" : "Send Broadcast"}
        </button>
      </form>

      {/* Past broadcasts */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-4">Past Broadcasts</h2>
        {broadcasts.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 py-12 flex flex-col items-center text-center">
            <Megaphone className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No broadcasts sent yet</p>
          </div>
        )}
        <div className="space-y-3">
          {broadcasts.map(b => (
            <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{b.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{b.body}</p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Users className="w-3.5 h-3.5" />
                    {b.recipientCount} recipients
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDistanceToNow(new Date(b.sentAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                  {b.targetType === "org"  ? "Specific org"  :
                   b.targetType === "plan" ? `Plan: ${b.targetPlan ?? ""}` :
                   b.targetType === "trial" ? "Trial accounts" :
                   "All customers"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
