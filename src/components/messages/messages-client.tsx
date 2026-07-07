"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  MessageSquare, Plus, Send, Search, Paperclip, Users, Hash,
  CheckCheck, X, Loader2, ChevronLeft, Smile, Reply, Trash2,
  Copy, MoreHorizontal, User, AtSign,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgUser { id: string; name: string; role: string; email: string }

interface ReactionGroup { emoji: string; count: number; userIds: string[]; names: string[] }

interface ReplyContext {
  id: string; body: string; isDeleted: boolean
  sender: { id: string; name: string }
}

interface Message {
  id:             string
  senderId:       string
  body:           string
  createdAt:      string
  attachmentUrl:  string | null
  attachmentName: string | null
  attachmentType: string | null
  isDeleted:      boolean
  replyToId:      string | null
  replyTo:        ReplyContext | null
  reactions:      ReactionGroup[]
  sender:         { id: string; name: string; role: string }
}

interface ConvMember { id: string; name: string; role: string; isAdmin?: boolean }

interface Conversation {
  id:         string
  type:       string
  name:       string
  members:    ConvMember[]
  lastMessage: { body: string; sender: string; at: string } | null
  unread:     number
  updatedAt:  string
  issueId?:   string | null
}

interface Props {
  currentUserId:   string
  currentUserName: string
  organizationId:  string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMON_EMOJIS = [
  "👍","👎","❤️","🔥","🎉","✅","😂","😢","😮","🤔",
  "👀","💯","🙌","🤝","💪","🙏","⭐","🚀","💡","⚡",
  "😊","😍","🥳","🤩","😎","🥲","😅","😭","🤣","😡",
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7)  return d.toLocaleDateString([], { weekday: "short" })
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

function formatFull(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function avatarInitial(name: string) {
  return name ? name.charAt(0).toUpperCase() : "?"
}

function convIcon(type: string) {
  if (type === "channel") return <Hash className="w-4 h-4" />
  if (type === "group")   return <Users className="w-4 h-4" />
  return null
}

function convColors(type: string) {
  if (type === "channel") return "bg-purple-100 text-purple-700"
  if (type === "group")   return "bg-green-100 text-green-700"
  return "bg-blue-100 text-blue-700"
}

// ─── Emoji Picker ─────────────────────────────────────────────────────────────

function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-full mb-2 left-0 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 w-64">
      <div className="grid grid-cols-10 gap-0.5">
        {COMMON_EMOJIS.map(e => (
          <button
            key={e}
            type="button"
            onClick={() => { onPick(e); onClose() }}
            className="w-6 h-6 flex items-center justify-center rounded text-base hover:bg-gray-100 transition-colors"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── New Conversation Modal ───────────────────────────────────────────────────

function NewConvModal({
  orgUsers,
  onClose,
  onCreated,
}: {
  orgUsers:  OrgUser[]
  onClose:   () => void
  onCreated: (id: string) => void
}) {
  const [type,     setType]     = useState<"direct" | "group" | "channel">("direct")
  const [name,     setName]     = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [query,    setQuery]    = useState("")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  const filtered = orgUsers.filter(u =>
    !selected.includes(u.id) &&
    (u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()))
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!selected.length) { setError("Select at least one person"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/conversations", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, name: name.trim() || null, memberIds: selected }),
      })
      const j = await res.json() as { conversation?: { id: string }; error?: string }
      if (!res.ok) { setError(j.error ?? "Failed"); return }
      onCreated(j.conversation!.id)
    } catch { setError("Network error") }
    finally   { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">New Conversation</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="px-5 py-4 space-y-3">
          <div className="flex gap-2">
            {(["direct", "group", "channel"] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setType(t); setSelected([]) }}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  type === t
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                )}
              >
                {t === "direct" ? "DM" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {type !== "direct" && (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={type === "group" ? "Group name…" : "Channel name…"}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map(uid => {
                const u = orgUsers.find(x => x.id === uid)
                return (
                  <span key={uid} className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    {u?.name ?? uid}
                    <button type="button" onClick={() => setSelected(s => s.filter(x => x !== uid))} className="hover:text-blue-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {/* People picker */}
          {(type === "direct" ? selected.length < 1 : true) && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search people…"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <p className="py-3 text-center text-xs text-gray-400">No people found</p>
                )}
                {filtered.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      if (type === "direct") setSelected([u.id])
                      else setSelected(s => [...s, u.id])
                      setQuery("")
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-700 shrink-0">
                      {avatarInitial(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selected.length}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isOwn,
  currentUserId,
  convId,
  onReply,
  onDelete,
  onReactionToggle,
}: {
  msg:               Message
  isOwn:             boolean
  currentUserId:     string
  convId:            string
  onReply:           (m: Message) => void
  onDelete:          (id: string) => void
  onReactionToggle:  (msgId: string, emoji: string) => void
}) {
  const [showActions,  setShowActions]  = useState(false)
  const [showEmojiPick, setShowEmojiPick] = useState(false)
  const [showTooltip,   setShowTooltip]   = useState<string | null>(null)
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showActions && !showEmojiPick) return
    function handle(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false)
        setShowEmojiPick(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [showActions, showEmojiPick])

  async function copyText() {
    try { await navigator.clipboard.writeText(msg.body) } catch { /* ignore */ }
    setShowActions(false)
  }

  if (msg.isDeleted) {
    return (
      <div className={cn("flex gap-2.5 group", isOwn && "flex-row-reverse")}>
        <div className="w-8 h-8 rounded-full shrink-0" />
        <div className="italic text-xs text-gray-400 px-3.5 py-2.5 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          Message deleted
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn("flex gap-2.5 group relative", isOwn && "flex-row-reverse")}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { if (!showEmojiPick) setShowActions(false) }}
    >
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1",
        isOwn ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
      )}>
        {avatarInitial(msg.sender.name)}
      </div>

      <div className={cn("max-w-[72%] flex flex-col", isOwn && "items-end")}>
        {/* Name + time */}
        <p className="text-[11px] text-gray-400 mb-0.5 px-1">
          {isOwn ? "You" : msg.sender.name}
          {" · "}
          <span title={formatFull(msg.createdAt)}>{formatTime(msg.createdAt)}</span>
        </p>

        {/* Reply quote */}
        {msg.replyTo && (
          <div className={cn(
            "mb-1 px-3 py-1.5 rounded-xl border-l-4 text-xs max-w-full",
            isOwn ? "border-blue-300 bg-blue-50" : "border-gray-300 bg-gray-50"
          )}>
            <p className="font-medium text-gray-500 mb-0.5">{msg.replyTo.sender.name}</p>
            <p className="text-gray-600 line-clamp-2">
              {msg.replyTo.isDeleted ? "Message deleted" : msg.replyTo.body}
            </p>
          </div>
        )}

        {/* Message body */}
        {msg.body && (
          <div className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
            isOwn
              ? "bg-blue-600 text-white rounded-br-sm"
              : "bg-gray-100 text-gray-900 rounded-bl-sm"
          )}>
            {msg.body}
          </div>
        )}

        {/* Attachment */}
        {msg.attachmentUrl && (
          <a
            href={msg.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "mt-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm border",
              isOwn
                ? "border-blue-400 text-blue-100 bg-blue-700"
                : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            )}
          >
            <Paperclip className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[180px]">{msg.attachmentName ?? "Attachment"}</span>
          </a>
        )}

        {/* Reactions */}
        {msg.reactions.length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1", isOwn && "justify-end")}>
            {msg.reactions.map(r => {
              const iMine = r.userIds.includes(currentUserId)
              return (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => onReactionToggle(msg.id, r.emoji)}
                  onMouseEnter={() => setShowTooltip(`${r.emoji}-${msg.id}`)}
                  onMouseLeave={() => setShowTooltip(null)}
                  title={r.names.join(", ")}
                  className={cn(
                    "relative flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                    iMine
                      ? "border-blue-400 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <span>{r.emoji}</span>
                  <span className="font-medium">{r.count}</span>
                  {showTooltip === `${r.emoji}-${msg.id}` && (
                    <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none z-10">
                      {r.names.join(", ")}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Hover action buttons */}
      {showActions && (
        <div
          ref={actionsRef}
          className={cn(
            "absolute top-0 z-20 flex items-center gap-0.5 bg-white border border-gray-200 rounded-xl shadow-md px-1 py-0.5",
            isOwn ? "right-12" : "left-12"
          )}
        >
          <button
            type="button"
            title="Reply"
            onClick={() => { onReply(msg); setShowActions(false) }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
          <div className="relative">
            <button
              type="button"
              title="React"
              onClick={() => setShowEmojiPick(v => !v)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {showEmojiPick && (
              <EmojiPicker
                onPick={e => { onReactionToggle(msg.id, e); setShowEmojiPick(false); setShowActions(false) }}
                onClose={() => { setShowEmojiPick(false); setShowActions(false) }}
              />
            )}
          </div>
          <button
            type="button"
            title="Copy"
            onClick={copyText}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {isOwn && (
            <button
              type="button"
              title="Delete"
              onClick={() => { onDelete(msg.id); setShowActions(false) }}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Message Composer ─────────────────────────────────────────────────────────

function Composer({
  convId,
  members,
  currentUserId,
  replyTo,
  onClearReply,
  onMessageSent,
}: {
  convId:        string
  members:       ConvMember[]
  currentUserId: string
  replyTo:       Message | null
  onClearReply:  () => void
  onMessageSent: (m: Message) => void
}) {
  const [input,        setInput]        = useState("")
  const [sending,      setSending]      = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [showEmoji,    setShowEmoji]    = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIds,   setMentionIds]   = useState<string[]>([])
  const inputRef    = useRef<HTMLTextAreaElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)
  const caretRef    = useRef<number>(0)

  // @mention: detect when user types @
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setInput(val)

    const pos = e.target.selectionStart ?? val.length
    const before = val.slice(0, pos)
    const match = before.match(/@(\w*)$/)
    setMentionQuery(match ? match[1] : null)
    caretRef.current = pos
  }

  const mentionFiltered = mentionQuery !== null
    ? members.filter(m =>
        m.id !== currentUserId &&
        m.name.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : []

  function insertMention(member: ConvMember) {
    const pos = caretRef.current
    const before = input.slice(0, pos)
    const after  = input.slice(pos)
    const prefix = before.replace(/@\w*$/, "")
    const newVal = `${prefix}@${member.name} ${after}`
    setInput(newVal)
    setMentionIds(prev => [...prev, member.id])
    setMentionQuery(null)
    setTimeout(() => {
      inputRef.current?.focus()
      const newPos = prefix.length + member.name.length + 2
      inputRef.current?.setSelectionRange(newPos, newPos)
    }, 0)
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setInput("")
    setSending(true)
    setMentionQuery(null)
    const replyToId = replyTo?.id ?? null
    onClearReply()
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text, replyToId, mentionIds }),
      })
      const j = await res.json() as { message?: Message }
      if (j.message) { onMessageSent(j.message); setMentionIds([]) }
    } catch { /* ignore */ }
    finally { setSending(false); inputRef.current?.focus() }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const up = await fetch("/api/conversations/upload", { method: "POST", body: form })
      const uj = await up.json() as { url?: string; name?: string; type?: string }
      if (!up.ok || !uj.url) return
      const res = await fetch(`/api/conversations/${convId}/messages`, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "", attachmentUrl: uj.url, attachmentName: uj.name, attachmentType: uj.type }),
      })
      const j = await res.json() as { message?: Message }
      if (j.message) onMessageSent(j.message)
    } catch { /* ignore */ }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = "" }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && mentionFiltered.length > 0 && e.key === "Enter") {
      e.preventDefault()
      insertMention(mentionFiltered[0])
      return
    }
    if (e.key === "Escape" && mentionQuery !== null) { setMentionQuery(null); return }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend() }
  }

  function sendTyping() {
    fetch(`/api/conversations/${convId}/typing`, { method: "POST" }).catch(console.error)
  }

  return (
    <div className="px-4 py-3 border-t border-gray-200 bg-white" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-start gap-2 mb-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
          <Reply className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-500">{replyTo.sender.name}</p>
            <p className="text-xs text-gray-400 truncate">{replyTo.body}</p>
          </div>
          <button onClick={onClearReply} className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* @mention dropdown */}
      {mentionQuery !== null && mentionFiltered.length > 0 && (
        <div className="mb-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
          {mentionFiltered.map(m => (
            <button
              key={m.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); insertMention(m) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left"
            >
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold shrink-0">
                {avatarInitial(m.name)}
              </div>
              <span className="text-sm text-gray-900">{m.name}</span>
              <span className="text-xs text-gray-400 capitalize">{m.role?.toLowerCase()}</span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSend} className="flex items-end gap-2">
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </button>

        <div className="relative flex-1">
          {showEmoji && (
            <EmojiPicker
              onPick={e => { setInput(p => p + e); setShowEmoji(false); inputRef.current?.focus() }}
              onClose={() => setShowEmoji(false)}
            />
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { handleInputChange(e); sendTyping() }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Type a message… (Enter to send)"
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ maxHeight: "120px", overflowY: "auto" }}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowEmoji(v => !v)}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0"
        >
          <Smile className="w-4 h-4" />
        </button>

        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="w-9 h-9 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </form>
    </div>
  )
}

// ─── Thread View ──────────────────────────────────────────────────────────────

function ThreadView({
  conv,
  currentUserId,
  currentUserName,
  onBack,
}: {
  conv:            Conversation
  currentUserId:   string
  currentUserName: string
  onBack:          () => void
}) {
  const [messages,    setMessages]    = useState<Message[]>([])
  const [typingNames, setTypingNames] = useState<string[]>([])
  const [seenBy,      setSeenBy]      = useState<{ id: string; name: string }[]>([])
  const [replyTo,     setReplyTo]     = useState<Message | null>(null)
  const [searchQ,     setSearchQ]     = useState("")
  const [showSearch,  setShowSearch]  = useState(false)
  const lastMsgTime = useRef<string | null>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async (initial = false) => {
    const since = initial ? undefined : lastMsgTime.current
    const url   = `/api/conversations/${conv.id}/messages${since ? `?since=${since}` : ""}`
    const res   = await fetch(url)
    const j     = await res.json() as { messages: Message[]; typingNames: string[]; seenBy: { id: string; name: string }[] }
    if (j.messages?.length) {
      setMessages(prev => initial ? j.messages : [...prev, ...j.messages.filter(m => !prev.some(p => p.id === m.id))])
      lastMsgTime.current = j.messages.at(-1)!.createdAt
    }
    setTypingNames(j.typingNames ?? [])
    setSeenBy(j.seenBy ?? [])
  }, [conv.id])

  useEffect(() => {
    setMessages([]); lastMsgTime.current = null
    fetchMessages(true).catch(console.error)
    // Mark read
    fetch(`/api/conversations/${conv.id}/read`, { method: "POST" }).catch(console.error)
    const iv = setInterval(() => fetchMessages(), 3_000)
    return () => clearInterval(iv)
  }, [conv.id, fetchMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typingNames])

  function handleMessageSent(m: Message) {
    setMessages(prev => [...prev, m])
    lastMsgTime.current = m.createdAt
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
  }

  async function handleDelete(msgId: string) {
    await fetch(`/api/conversations/${conv.id}/messages/${msgId}`, { method: "DELETE" })
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, body: "" } : m))
  }

  async function handleReactionToggle(msgId: string, emoji: string) {
    await fetch(`/api/conversations/${conv.id}/messages/${msgId}/react`, {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify({ emoji }),
    })
    // Optimistic: refetch
    fetchMessages().catch(console.error)
  }

  const visible = searchQ
    ? messages.filter(m => !m.isDeleted && m.body.toLowerCase().includes(searchQ.toLowerCase()))
    : messages

  const otherName = conv.type === "direct"
    ? conv.members.find(m => m.id !== currentUserId)?.name ?? conv.name
    : null

  const convLabel = conv.type === "direct"
    ? (otherName ?? conv.name)
    : (conv.type === "channel" ? `# ${conv.name}` : conv.name)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <button
          className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          onClick={onBack}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
          convColors(conv.type)
        )}>
          {convIcon(conv.type) ?? avatarInitial(otherName ?? conv.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{convLabel}</p>
          <p className="text-xs text-gray-400">
            {conv.type === "direct"
              ? conv.members.find(m => m.id !== currentUserId)?.role?.toLowerCase() ?? ""
              : `${conv.members.length} member${conv.members.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(v => !v)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
            title="Search messages"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-2 shrink-0">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            autoFocus
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search messages…"
            className="flex-1 text-sm outline-none bg-transparent"
          />
          {searchQ && (
            <span className="text-xs text-gray-400">
              {visible.length} result{visible.length !== 1 ? "s" : ""}
            </span>
          )}
          <button onClick={() => { setShowSearch(false); setSearchQ("") }} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
        {visible.length === 0 && !searchQ && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">No messages yet. Say hello!</p>
          </div>
        )}

        {visible.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isOwn={msg.senderId === currentUserId}
            currentUserId={currentUserId}
            convId={conv.id}
            onReply={setReplyTo}
            onDelete={handleDelete}
            onReactionToggle={handleReactionToggle}
          />
        ))}

        {typingNames.length > 0 && (
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-xs text-gray-500">…</span>
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5">
              <span className="text-xs text-gray-500">
                {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
              </span>
            </div>
          </div>
        )}

        {seenBy.filter(s => s.id !== currentUserId).length > 0 && (
          <div className="flex justify-end items-center gap-1 pr-1">
            <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[11px] text-gray-400">
              Seen by {seenBy.filter(s => s.id !== currentUserId).map(s => s.name).join(", ")}
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <Composer
        convId={conv.id}
        members={conv.members}
        currentUserId={currentUserId}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onMessageSent={handleMessageSent}
      />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MessagesClient({ currentUserId, currentUserName, organizationId }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [orgUsers,      setOrgUsers]      = useState<OrgUser[]>([])
  const [activeId,      setActiveId]      = useState<string | null>(null)
  const [showNew,       setShowNew]       = useState(false)
  const [searchQ,       setSearchQ]       = useState("")

  const fetchConvs = useCallback(async () => {
    const res = await fetch("/api/conversations")
    const j   = await res.json() as { conversations?: Conversation[] }
    if (j.conversations) setConversations(j.conversations)
  }, [])

  useEffect(() => {
    fetchConvs().catch(console.error)
    fetch("/api/conversations/org-users")
      .then(r => r.json() as Promise<{ users?: OrgUser[] }>)
      .then(j => { if (j.users) setOrgUsers(j.users) })
      .catch(console.error)

    const iv = setInterval(fetchConvs, 30_000)
    return () => clearInterval(iv)
  }, [fetchConvs])

  const filtered = searchQ
    ? conversations.filter(c => c.name.toLowerCase().includes(searchQ.toLowerCase()))
    : conversations

  // Group by type
  const dms       = filtered.filter(c => c.type === "direct")
  const groups    = filtered.filter(c => c.type === "group")
  const channels  = filtered.filter(c => c.type === "channel")
  const issues    = filtered.filter(c => c.type === "issue")

  const activeConv = conversations.find(c => c.id === activeId) ?? null

  function ConvSection({ label, items }: { label: string; items: Conversation[] }) {
    if (!items.length) return null
    return (
      <div>
        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        {items.map(conv => {
          const isActive = conv.id === activeId
          const otherName = conv.type === "direct"
            ? conv.members.find(m => m.id !== currentUserId)?.name
            : null
          const label = conv.type === "channel"
            ? `# ${conv.name}`
            : conv.type === "direct"
            ? (otherName ?? conv.name)
            : conv.name
          return (
            <button
              key={conv.id}
              onClick={() => setActiveId(conv.id)}
              className={cn(
                "w-full flex items-start gap-3 px-4 py-3 border-b border-gray-100 text-left transition-colors",
                isActive ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-gray-50"
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                convColors(conv.type)
              )}>
                {convIcon(conv.type) ?? avatarInitial(otherName ?? conv.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className={cn("text-sm truncate", conv.unread > 0 ? "font-bold text-gray-900" : "font-medium text-gray-700")}>
                    {label}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {conv.lastMessage && (
                      <span className="text-[10px] text-gray-400">{formatTime(conv.lastMessage.at)}</span>
                    )}
                    {conv.unread > 0 && (
                      <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                        {conv.unread > 99 ? "99+" : conv.unread}
                      </span>
                    )}
                  </div>
                </div>
                {conv.lastMessage && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    <span className="font-medium">{conv.lastMessage.sender}: </span>
                    {conv.lastMessage.body}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: conversation list */}
      <div className={cn(
        "w-full md:w-72 lg:w-80 border-r border-gray-200 flex flex-col bg-white shrink-0",
        activeId && "hidden md:flex"
      )}>
        <div className="px-4 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-gray-900">Messages</h1>
            <button
              onClick={() => setShowNew(true)}
              className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <MessageSquare className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No conversations yet</p>
              <p className="text-xs text-gray-400 mt-1">Start one with the + button above</p>
            </div>
          )}
          <ConvSection label="Direct Messages" items={dms} />
          <ConvSection label="Groups" items={groups} />
          <ConvSection label="Channels" items={channels} />
          {issues.length > 0 && <ConvSection label="Issue Chats" items={issues} />}
        </div>
      </div>

      {/* Right panel: thread */}
      <div className={cn("flex-1 flex flex-col overflow-hidden bg-white", !activeId && "hidden md:flex")}>
        {activeConv ? (
          <ThreadView
            key={activeConv.id}
            conv={activeConv}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onBack={() => setActiveId(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <MessageSquare className="w-16 h-16 text-gray-200 mb-4" />
            <h2 className="text-xl font-semibold text-gray-500">Select a conversation</h2>
            <p className="text-sm text-gray-400 mt-1">Or start a new one with the + button</p>
          </div>
        )}
      </div>

      {showNew && (
        <NewConvModal
          orgUsers={orgUsers}
          onClose={() => setShowNew(false)}
          onCreated={id => {
            setShowNew(false)
            fetchConvs().then(() => setActiveId(id)).catch(console.error)
          }}
        />
      )}
    </div>
  )
}
