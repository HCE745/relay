"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Send, AtSign } from "lucide-react"

interface Comment {
  id: string
  content: string
  isInternal: boolean
  createdAt: Date | string
  author: { id: string; name: string }
}

interface OrgUser {
  id: string
  name: string
}

interface Props {
  issueId: string
  comments: Comment[]
  currentUserId: string
  orgUsers?: OrgUser[]
}

export function IssueComments({ issueId, comments, currentUserId, orgUsers = [] }: Props) {
  const router = useRouter()
  const [content, setContent] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStart, setMentionStart] = useState(0)
  const [mentionIndex, setMentionIndex] = useState(0)

  const mentionMatches = mentionQuery !== null
    ? orgUsers.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : []

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setContent(val)

    // Detect @mention trigger
    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const atMatch = before.match(/@(\w*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionStart(cursor - atMatch[0].length)
      setMentionIndex(0)
    } else {
      setMentionQuery(null)
    }
  }

  function insertMention(user: OrgUser) {
    const before = content.slice(0, mentionStart)
    const after = content.slice(textareaRef.current?.selectionStart ?? content.length)
    const inserted = `@${user.name} `
    const next = before + inserted + after
    setContent(next)
    setMentionQuery(null)
    textareaRef.current?.focus()
    // Move cursor after inserted mention
    setTimeout(() => {
      const pos = before.length + inserted.length
      textareaRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionMatches.length - 1)) }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)) }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionMatches[mentionIndex]) }
      if (e.key === "Escape")    { setMentionQuery(null) }
    }
  }

  function parseMentions(text: string): string[] {
    const ids: string[] = []
    const pattern = /@([\w ]+?)(?=\s|$|@)/g
    let m: RegExpExecArray | null
    while ((m = pattern.exec(text)) !== null) {
      const name = m[1].trim()
      const user = orgUsers.find(u => u.name.toLowerCase() === name.toLowerCase())
      if (user && !ids.includes(user.id)) ids.push(user.id)
    }
    return ids
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    const mentionedUserIds = parseMentions(content)
    const res = await fetch(`/api/issues/${issueId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, isInternal, mentionedUserIds }),
    })
    if (res.ok) {
      setContent("")
      setMentionQuery(null)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="font-medium text-gray-900 mb-4 text-sm">
        Comments ({comments.length})
      </h3>

      <div className="space-y-4 mb-4">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No comments yet. Be the first to comment.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className={`rounded-lg p-3 ${comment.isInternal ? "bg-yellow-50 border border-yellow-100" : "bg-gray-50"}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs font-medium">{comment.author.name.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{comment.author.name}</span>
                  {comment.isInternal && (
                    <span className="text-xs text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">Internal</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {comment.content.split(/(@[\w ]+)/g).map((part, i) => {
                  if (part.startsWith("@") && orgUsers.some(u => u.name === part.slice(1))) {
                    return <span key={i} className="text-blue-600 font-medium">{part}</span>
                  }
                  return part
                })}
              </p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-100 pt-4">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment… (type @ to mention someone)"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />

          {/* @mention dropdown */}
          {mentionQuery !== null && mentionMatches.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-56 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-20">
              <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-1.5">
                <AtSign className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-400">Mention a team member</span>
              </div>
              {mentionMatches.map((u, i) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); insertMention(u) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${i === mentionIndex ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-900"}`}
                >
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                    <span className="text-white text-[10px] font-medium">{u.name.charAt(0)}</span>
                  </div>
                  {u.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded border-gray-300"
            />
            Internal note
          </label>
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {loading ? "…" : "Comment"}
          </button>
        </div>
      </form>
    </div>
  )
}
