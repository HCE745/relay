"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { CheckCircle, UserCheck, Loader2, ChevronDown, Sparkles, Lightbulb } from "lucide-react"
import { MediaUpload, type UploadedFile } from "@/components/media-upload"

interface UserOption {
  id: string
  name: string
  role: string
}

interface RoutingPreview {
  category: string | null
  categoryLabel: string | null
  routedTo: { id: string; name: string } | null
}


interface Props {
  users: UserOption[]
  aiSuggestionsEnabled?: boolean
}

export function SuggestionForm({ users, aiSuggestionsEnabled = true }: Props) {
  const [content, setContent] = useState("")
  const [overrideUserId, setOverrideUserId] = useState("")
  const [showOverride, setShowOverride] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [doneRoutedTo, setDoneRoutedTo] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<RoutingPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [attachments, setAttachments] = useState<UploadedFile[]>([])
  const [liveTip, setLiveTip] = useState<string | null>(null)
  const [tipLoading, setTipLoading] = useState(false)
  const [tipError, setTipError] = useState(false)
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tipAbortRef    = useRef<AbortController | null>(null)
  const aiBlockedRef   = useRef(false)
  const detectedCatRef = useRef<string>("GENERAL")

  const fetchPreview = useCallback(async (text: string) => {
    if (!text.trim() || text.trim().length < 10) { setPreview(null); return }
    setPreviewLoading(true)
    try {
      const res = await fetch("/api/suggestions/preview-routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      })
      if (res.ok) {
        const data: RoutingPreview = await res.json()
        setPreview(data)
        if (data.category) detectedCatRef.current = data.category
      }
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  const fetchLiveTip = useCallback(async (text: string) => {
    if (!aiSuggestionsEnabled || !text.trim() || text.trim().length < 15) return
    if (aiBlockedRef.current) return  // already know AI is off/unconfigured — don't flash

    tipAbortRef.current?.abort()
    const controller = new AbortController()
    tipAbortRef.current = controller

    setTipLoading(true)
    setTipError(false)
    try {
      const category = detectedCatRef.current || "GENERAL"
      const params = new URLSearchParams({ category, description: text.slice(0, 400) })
      const res = await fetch(`/api/analytics/suggestions?${params}`, { signal: controller.signal })
      if (!res.ok) {
        console.error("[AI Suggestion] API error:", res.status, res.statusText)
        setTipError(true)
        return
      }
      const data = await res.json() as { aiTip?: string | null; blocked?: boolean }
      if (data.blocked) {
        aiBlockedRef.current = true
        setLiveTip(null); setTipError(false); return
      }
      if (data.aiTip) {
        setLiveTip(data.aiTip)
        setTipError(false)
        console.log("[AI Suggestion] Live tip received, length:", data.aiTip.length)
      } else {
        console.error("[AI Suggestion] API returned empty/null aiTip")
        setTipError(true)
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return
      console.error("[AI Suggestion] fetch failed:", err)
      setTipError(true)
    } finally {
      setTipLoading(false)
    }
  }, [aiSuggestionsEnabled])

  useEffect(() => {
    if (overrideUserId) { setPreview(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPreview(content), 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [content, overrideUserId, fetchPreview])

  // Fetch AI tip with a longer debounce (after routing preview has run)
  useEffect(() => {
    if (!aiSuggestionsEnabled) return
    if (suggestionRef.current) clearTimeout(suggestionRef.current)
    suggestionRef.current = setTimeout(() => fetchLiveTip(content), 1500)
    return () => { if (suggestionRef.current) clearTimeout(suggestionRef.current) }
  }, [content, aiSuggestionsEnabled, fetchLiveTip])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, overrideUserId: overrideUserId || null, attachments }),
      })
      if (res.ok) {
        const data = await res.json()
        setDoneRoutedTo(data.routedToUser?.name ?? null)
        setDone(true)
        setContent("")
        setOverrideUserId("")
        setShowOverride(false)
        setPreview(null)
        setAttachments([])
        return
      }
      const d = await res.json().catch(() => ({}))
      setError((d as { error?: string }).error ?? "Failed to submit")
    } catch {
      setError("Network error — please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Thanks for your suggestion!</h3>
        <p className="text-gray-500 text-sm mb-1">
          {doneRoutedTo
            ? <>Your suggestion has been routed to <span className="font-medium text-gray-700">{doneRoutedTo}</span>.</>
            : "Your suggestion has been submitted."}
        </p>
        <p className="text-gray-400 text-xs mb-6">They&apos;ll review it and may follow up.</p>
        <button onClick={() => { setDone(false); setDoneRoutedTo(null) }} className="text-sm text-blue-600 hover:underline">
          Submit another
        </button>
      </div>
    )
  }

  const overrideUser = users.find(u => u.id === overrideUserId)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Your suggestion or feedback</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={6}
          placeholder="Share an idea, report a process issue, or give feedback on anything…"
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          required
        />
        <p className="text-xs text-gray-400 mt-1">Submissions are anonymous to other employees. Admins can see who submitted.</p>
      </div>

      {/* Live AI tip — only shown while loading or when a tip was actually returned */}
      {aiSuggestionsEnabled && (tipLoading || liveTip) && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border border-amber-200 bg-amber-50 text-sm">
          {tipLoading
            ? <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin mt-0.5 shrink-0" />
            : <Sparkles className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-amber-900 leading-relaxed">
              {tipLoading
                ? <span className="text-amber-400 italic">Generating suggestion…</span>
                : liveTip}
            </p>
            {!tipLoading && liveTip && (
              <p className="text-amber-500 text-xs mt-1.5">AI Suggestions are a beta feature and will continue to improve over time.</p>
            )}
          </div>
        </div>
      )}

      {/* Routing preview */}
      {!overrideUserId && content.trim().length >= 10 && (
        <div className={`flex items-center gap-2.5 px-3.5 py-3 rounded-lg border text-sm ${
          preview?.routedTo ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-gray-50 border-gray-200 text-gray-400"
        }`}>
          {previewLoading
            ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            : <UserCheck className="w-4 h-4 shrink-0 text-blue-500" />}
          <div className="min-w-0">
            {previewLoading ? (
              <span>Analyzing suggestion…</span>
            ) : preview?.routedTo ? (
              <>
                <span className="font-medium">Will be routed to {preview.routedTo.name}</span>
                {preview.categoryLabel && <span className="text-blue-600"> · {preview.categoryLabel}</span>}
              </>
            ) : (
              <span>Keep typing to see who this will be routed to…</span>
            )}
          </div>
        </div>
      )}

      {/* Media upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Attach photos or videos (optional)</label>
        <MediaUpload value={attachments} onChange={setAttachments} />
      </div>

      {/* Manual override */}
      <div>
        <button
          type="button"
          onClick={() => { setShowOverride(v => !v); if (showOverride) setOverrideUserId("") }}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOverride ? "rotate-180" : ""}`} />
          {showOverride ? "Remove manual recipient override" : "Override who this goes to"}
        </button>
        {showOverride && (
          <div className="mt-2">
            <select
              value={overrideUserId}
              onChange={e => setOverrideUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">— select a person —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
            {overrideUser && (
              <p className="mt-1 text-xs text-amber-600">Auto-routing is disabled — will go directly to {overrideUser.name}.</p>
            )}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
        {loading ? "Submitting…" : "Submit Suggestion"}
      </button>
    </form>
  )
}
