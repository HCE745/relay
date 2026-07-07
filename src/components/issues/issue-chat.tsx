"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Send, Loader2, Paperclip, Smile, Reply, Trash2, Copy,
  CheckCheck, X, MessageSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface Props {
  issueId:         string
  currentUserId:   string
  currentUserName: string
}

// ─── Emoji Picker ─────────────────────────────────────────────────────────────

const COMMON_EMOJIS = ["👍","👎","❤️","🔥","🎉","✅","😂","😢","😮","🤔","💯","⭐"]

function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-full mb-1 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2">
      <div className="grid grid-cols-6 gap-0.5">
        {COMMON_EMOJIS.map(e => (
          <button key={e} type="button" onClick={() => { onPick(e); onClose() }}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-base">
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function IssueMsgBubble({
  msg, isOwn, currentUserId, convId, onReply, onDelete, onReactionToggle,
}: {
  msg: Message; isOwn: boolean; currentUserId: string; convId: string
  onReply: (m: Message) => void; onDelete: (id: string) => void
  onReactionToggle: (msgId: string, emoji: string) => void
}) {
  const [showActions,   setShowActions]   = useState(false)
  const [showEmojiPick, setShowEmojiPick] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showActions && !showEmojiPick) return
    function h(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false); setShowEmojiPick(false)
      }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [showActions, showEmojiPick])

  if (msg.isDeleted) {
    return (
      <div className={cn("flex gap-2 group", isOwn && "flex-row-reverse")}>
        <div className="w-7 h-7 rounded-full shrink-0" />
        <p className="italic text-xs text-gray-400 px-3 py-2 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          Message deleted
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn("flex gap-2 group relative", isOwn && "flex-row-reverse")}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { if (!showEmojiPick) setShowActions(false) }}
    >
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1",
        isOwn ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
      )}>
        {msg.sender.name.charAt(0).toUpperCase()}
      </div>

      <div className={cn("max-w-[75%] flex flex-col", isOwn && "items-end")}>
        <p className="text-[10px] text-gray-400 mb-0.5 px-1">
          {isOwn ? "You" : msg.sender.name}
          {" · "}
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>

        {msg.replyTo && (
          <div className={cn("mb-1 px-2.5 py-1.5 rounded-xl border-l-4 text-xs",
            isOwn ? "border-blue-300 bg-blue-50" : "border-gray-300 bg-gray-50"
          )}>
            <p className="font-medium text-gray-500 mb-0.5">{msg.replyTo.sender.name}</p>
            <p className="text-gray-600 line-clamp-1">{msg.replyTo.isDeleted ? "Message deleted" : msg.replyTo.body}</p>
          </div>
        )}

        {msg.body && (
          <div className={cn(
            "rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
            isOwn ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"
          )}>
            {msg.body}
          </div>
        )}

        {msg.attachmentUrl && (
          <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer"
            className={cn(
              "mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs border",
              isOwn ? "border-blue-400 text-blue-100 bg-blue-700" : "border-gray-300 text-gray-700 bg-white"
            )}
          >
            <Paperclip className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[140px]">{msg.attachmentName ?? "Attachment"}</span>
          </a>
        )}

        {msg.reactions.length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1", isOwn && "justify-end")}>
            {msg.reactions.map(r => (
              <button key={r.emoji} type="button"
                onClick={() => onReactionToggle(msg.id, r.emoji)}
                title={r.names.join(", ")}
                className={cn(
                  "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                  r.userIds.includes(currentUserId)
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-700"
                )}>
                <span>{r.emoji}</span>
                <span className="font-medium">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showActions && (
        <div ref={actionsRef}
          className={cn(
            "absolute top-0 z-20 flex items-center gap-0.5 bg-white border border-gray-200 rounded-xl shadow px-0.5 py-0.5",
            isOwn ? "right-11" : "left-11"
          )}>
          <button type="button" title="Reply" onClick={() => { onReply(msg); setShowActions(false) }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <Reply className="w-3 h-3" />
          </button>
          <div className="relative">
            <button type="button" title="React" onClick={() => setShowEmojiPick(v => !v)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <Smile className="w-3 h-3" />
            </button>
            {showEmojiPick && (
              <EmojiPicker
                onPick={e => { onReactionToggle(msg.id, e); setShowEmojiPick(false); setShowActions(false) }}
                onClose={() => { setShowEmojiPick(false); setShowActions(false) }}
              />
            )}
          </div>
          <button type="button" title="Copy"
            onClick={() => { navigator.clipboard.writeText(msg.body).catch(() => {}); setShowActions(false) }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <Copy className="w-3 h-3" />
          </button>
          {isOwn && (
            <button type="button" title="Delete" onClick={() => { onDelete(msg.id); setShowActions(false) }}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IssueChat({ issueId, currentUserId, currentUserName }: Props) {
  const [convId,       setConvId]       = useState<string | null>(null)
  const [members,      setMembers]      = useState<{ id: string; name: string }[]>([])
  const [messages,     setMessages]     = useState<Message[]>([])
  const [typingNames,  setTypingNames]  = useState<string[]>([])
  const [seenBy,       setSeenBy]       = useState<{ id: string; name: string }[]>([])
  const [input,        setInput]        = useState("")
  const [sending,      setSending]      = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [showEmoji,    setShowEmoji]    = useState(false)
  const [replyTo,      setReplyTo]      = useState<Message | null>(null)
  const lastMsgTime = useRef<string | null>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)
  const typingRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load issue conversation
  useEffect(() => {
    fetch(`/api/conversations/issue/${issueId}`)
      .then(r => r.json() as Promise<{ conversation?: { id: string; members?: { user: { id: string; name: string } }[] } }>)
      .then(j => {
        if (j.conversation) {
          setConvId(j.conversation.id)
          setMembers((j.conversation.members ?? []).map(m => m.user))
        }
      })
      .catch(console.error)
  }, [issueId])

  const fetchMessages = useCallback(async (initial = false) => {
    if (!convId) return
    const since = initial ? undefined : lastMsgTime.current
    const url   = `/api/conversations/${convId}/messages${since ? `?since=${since}` : ""}`
    const res   = await fetch(url)
    const j     = await res.json() as { messages: Message[]; typingNames: string[]; seenBy: { id: string; name: string }[] }
    if (j.messages?.length) {
      setMessages(prev => initial ? j.messages : [...prev, ...j.messages.filter(m => !prev.some(p => p.id === m.id))])
      lastMsgTime.current = j.messages.at(-1)!.createdAt
    }
    setTypingNames(j.typingNames ?? [])
    setSeenBy(j.seenBy ?? [])
  }, [convId])

  useEffect(() => {
    if (!convId) return
    setMessages([]); lastMsgTime.current = null
    fetchMessages(true).catch(console.error)
    fetch(`/api/conversations/${convId}/read`, { method: "POST" }).catch(console.error)
    const iv = setInterval(() => fetchMessages(), 3_000)
    return () => clearInterval(iv)
  }, [convId, fetchMessages])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, typingNames])

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending || !convId) return
    setInput(""); setSending(true)
    const replyToId = replyTo?.id ?? null
    setReplyTo(null)
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text, replyToId }),
      })
      const j = await res.json() as { message?: Message }
      if (j.message) {
        setMessages(prev => [...prev, j.message!])
        lastMsgTime.current = j.message.createdAt
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
      }
    } catch { /* ignore */ }
    finally { setSending(false); inputRef.current?.focus() }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!convId) return
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const form = new FormData(); form.append("file", file)
      const up = await fetch("/api/conversations/upload", { method: "POST", body: form })
      const uj = await up.json() as { url?: string; name?: string; type?: string }
      if (!up.ok || !uj.url) return
      const res = await fetch(`/api/conversations/${convId}/messages`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "", attachmentUrl: uj.url, attachmentName: uj.name, attachmentType: uj.type }),
      })
      const j = await res.json() as { message?: Message }
      if (j.message) setMessages(prev => [...prev, j.message!])
    } catch { /* ignore */ }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = "" }
  }

  async function handleDelete(msgId: string) {
    if (!convId) return
    await fetch(`/api/conversations/${convId}/messages/${msgId}`, { method: "DELETE" })
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, body: "" } : m))
  }

  async function handleReactionToggle(msgId: string, emoji: string) {
    if (!convId) return
    await fetch(`/api/conversations/${convId}/messages/${msgId}/react`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ emoji }),
    })
    fetchMessages().catch(console.error)
  }

  function sendTyping() {
    if (!convId) return
    if (typingRef.current) clearTimeout(typingRef.current)
    fetch(`/api/conversations/${convId}/typing`, { method: "POST" }).catch(console.error)
    typingRef.current = setTimeout(() => { typingRef.current = null }, 2000)
  }

  if (!convId) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col border border-gray-200 rounded-2xl overflow-hidden bg-white" style={{ height: "480px" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
        <MessageSquare className="w-4 h-4 text-blue-500" />
        <p className="text-sm font-semibold text-gray-900">Internal Chat</p>
        {members.length > 0 && (
          <div className="flex -space-x-1.5 ml-auto">
            {members.slice(0, 5).map(m => (
              <div key={m.id}
                className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-700"
                title={m.name}>
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {members.length > 5 && (
              <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[9px] text-gray-500">
                +{members.length - 5}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-gray-400">Internal team discussion for this issue</p>
          </div>
        )}
        {messages.map(msg => (
          <IssueMsgBubble
            key={msg.id}
            msg={msg}
            isOwn={msg.senderId === currentUserId}
            currentUserId={currentUserId}
            convId={convId}
            onReply={setReplyTo}
            onDelete={handleDelete}
            onReactionToggle={handleReactionToggle}
          />
        ))}
        {typingNames.length > 0 && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-xs text-gray-500">…</span>
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
              <span className="text-xs text-gray-500">{typingNames.join(", ")} typing…</span>
            </div>
          </div>
        )}
        {seenBy.filter(s => s.id !== currentUserId).length > 0 && (
          <div className="flex justify-end items-center gap-1">
            <CheckCheck className="w-3 h-3 text-blue-500" />
            <span className="text-[10px] text-gray-400">
              Seen by {seenBy.filter(s => s.id !== currentUserId).map(s => s.name).join(", ")}
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-3 py-2.5 border-t border-gray-100 bg-white shrink-0">
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
            <Reply className="w-3 h-3 text-gray-400 shrink-0" />
            <p className="text-xs text-gray-500 flex-1 truncate">
              <span className="font-medium">{replyTo.sender.name}:</span> {replyTo.body}
            </p>
            <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-end gap-1.5">
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
          </button>
          <div className="relative flex-1">
            {showEmoji && (
              <EmojiPicker
                onPick={e => { setInput(p => p + e); setShowEmoji(false) }}
                onClose={() => setShowEmoji(false)}
              />
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); sendTyping() }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
              rows={1}
              placeholder="Team discussion…"
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ maxHeight: "80px", overflowY: "auto" }}
            />
          </div>
          <button type="button" onClick={() => setShowEmoji(v => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0">
            <Smile className="w-3.5 h-3.5" />
          </button>
          <button type="submit" disabled={!input.trim() || sending}
            className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 shrink-0">
            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          </button>
        </form>
      </div>
    </div>
  )
}
