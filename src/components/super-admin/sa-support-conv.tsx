"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Send, Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id:          string
  senderType:  string
  body:        string
  createdAt:   string | Date
  senderUser?: { id: string; name: string } | null
  senderAdmin?: { id: string; name: string } | null
}

interface Conversation {
  id:            string
  status:        string
  internalNotes: string | null
  organization:  { id: string; name: string; users: { id: string; name: string; role: string }[] }
  messages:      Message[]
}

export function SASupportConvClient({ conversation }: { conversation: Conversation }) {
  const router = useRouter()
  const [messages,  setMessages]  = useState<Message[]>(conversation.messages)
  const [reply,     setReply]     = useState("")
  const [sending,   setSending]   = useState(false)
  const [status,    setStatus]    = useState(conversation.status)
  const [notes,     setNotes]     = useState(conversation.internalNotes ?? "")
  const [savingNotes, setSavingNotes] = useState(false)
  const [error,     setError]     = useState("")

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!reply.trim() || sending) return
    setSending(true)
    setError("")
    try {
      const res = await fetch(`/api/super-admin/support/${conversation.id}`, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      })
      if (!res.ok) { const j = await res.json() as { error?: string }; setError(j.error ?? "Failed"); return }
      const now = new Date().toISOString()
      setMessages(prev => [...prev, {
        id:          now,
        senderType:  "admin",
        body:        reply.trim(),
        createdAt:   now,
        senderAdmin: { id: "sa", name: "Support" },
      }])
      setReply("")
    } catch {
      setError("Network error")
    } finally {
      setSending(false)
    }
  }

  async function changeStatus(newStatus: string) {
    await fetch(`/api/super-admin/support/${conversation.id}`, {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    setStatus(newStatus)
  }

  async function saveNotes() {
    setSavingNotes(true)
    await fetch(`/api/super-admin/support/${conversation.id}`, {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ internalNotes: notes }),
    })
    setSavingNotes(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/super-admin/support" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{conversation.organization.name}</h1>
          <p className="text-sm text-gray-500">{conversation.organization.users.length} team member(s)</p>
        </div>
        {/* Status controls */}
        <div className="flex items-center gap-2">
          {["open", "pending", "resolved"].map(s => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize",
                status === s
                  ? s === "open"     ? "bg-blue-600 text-white border-blue-600"
                  : s === "pending"  ? "bg-amber-500 text-white border-amber-500"
                  :                    "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto px-5 py-5 space-y-4">
          {messages.map(msg => {
            const isAdmin = msg.senderType === "admin"
            const isSystem = msg.senderType === "system"
            const senderName = isAdmin
              ? (msg.senderAdmin?.name ?? "Support")
              : isSystem
              ? "System"
              : (msg.senderUser?.name ?? "Customer")

            return (
              <div key={msg.id} className={cn("flex gap-3", isAdmin && "flex-row-reverse")}>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  isAdmin  ? "bg-green-600 text-white" :
                  isSystem ? "bg-gray-300 text-gray-600" :
                             "bg-blue-100 text-blue-700"
                )}>
                  {senderName.charAt(0).toUpperCase()}
                </div>
                <div className={cn("max-w-[75%]", isAdmin && "items-end flex flex-col")}>
                  <p className="text-[11px] text-gray-400 px-1 mb-0.5">
                    {senderName} · {new Date(msg.createdAt).toLocaleString()}
                  </p>
                  <div className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm",
                    isAdmin  ? "bg-green-600 text-white rounded-br-sm" :
                    isSystem ? "bg-gray-100 text-gray-600 italic rounded-bl-sm" :
                               "bg-gray-100 text-gray-900 rounded-bl-sm"
                  )}>
                    {msg.body}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Reply box */}
        <div className="border-t border-gray-200 px-5 py-4">
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs mb-3">
              <AlertCircle className="w-3.5 h-3.5" />{error}
            </div>
          )}
          <form onSubmit={handleReply} className="flex gap-3 items-end">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleReply(e as unknown as React.FormEvent) } }}
              rows={3}
              placeholder="Type your reply… (Enter to send)"
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={status === "resolved"}
            />
            <button
              type="submit"
              disabled={!reply.trim() || sending || status === "resolved"}
              className="w-10 h-10 flex items-center justify-center bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
          {status === "resolved" && (
            <p className="text-xs text-gray-400 mt-2">This conversation is resolved. Change status to reply.</p>
          )}
        </div>
      </div>

      {/* Internal notes */}
      <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
        <h3 className="text-sm font-medium text-yellow-800 mb-2">Internal Notes <span className="text-xs font-normal text-yellow-600">(visible to support team only)</span></h3>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Add private notes about this conversation…"
          className="w-full px-3 py-2 border border-yellow-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={saveNotes}
            disabled={savingNotes}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 text-white text-xs rounded-lg hover:bg-yellow-700 disabled:opacity-60"
          >
            {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            Save Notes
          </button>
        </div>
      </div>

      {/* Org members */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Team Members</h3>
        <div className="space-y-2">
          {conversation.organization.users.map(u => (
            <div key={u.id} className="flex items-center gap-2 text-sm">
              <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-bold">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-gray-900">{u.name}</span>
              <span className="text-xs text-gray-400 capitalize">{u.role.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
