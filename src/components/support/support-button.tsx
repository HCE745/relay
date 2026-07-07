"use client"

import { useState, useRef, useEffect } from "react"
import {
  CircleHelp, X, Loader2, CheckCircle, Bug, MessageSquare,
  BookOpen, Send, ChevronLeft, AlertCircle, Video, Monitor, Headphones,
  Camera, FileVideo, ImageIcon,
} from "lucide-react"
import { isNativeApp } from "@/lib/capacitor"

// ─── Types ───────────────────────────────────────────────────────────────────

type View = "menu" | "bug" | "bug-done" | "feedback" | "feedback-done" | "chat"
          | "record-unsupported" | "record-instructions" | "record-review" | "record-done"
          | "support" | "support-done"
          | "native-capture" | "native-review"

// Media captured by the native Android capture flow
type NativeMedia =
  | { kind: "image-dataurl"; dataUrl: string }   // direct camera capture
  | { kind: "image-file";    file: File }         // image picked from gallery
  | { kind: "video-file";    file: File }         // screen recording from gallery

interface ChatMessage {
  role:    "user" | "assistant"
  content: string
}

interface Props {
  userName?:        string
  orgName?:         string
  triggerClassName?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FEEDBACK_TYPES = [
  { value: "feature_request",     label: "Feature Request",     desc: "I want a new feature" },
  { value: "product_feedback",    label: "Product Feedback",    desc: "General thoughts on how Relay works" },
  { value: "ui_ux_suggestion",    label: "UI/UX Suggestion",    desc: "Something about the design or usability" },
  { value: "integration_request", label: "Integration Request", desc: "Connect Relay with another tool" },
  { value: "pricing_feedback",    label: "Pricing Feedback",    desc: "Thoughts on pricing or plans" },
  { value: "general_suggestion",  label: "General Suggestion",  desc: "Anything else" },
] as const

type FeedbackTypeValue = typeof FEEDBACK_TYPES[number]["value"]

const FREQ_OPTIONS = [
  { value: "daily",   label: "Daily" },
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "rarely",  label: "Rarely" },
] as const

const MAIN_PLACEHOLDER: Record<FeedbackTypeValue, string> = {
  feature_request:     "What would you like Relay to do?",
  product_feedback:    "Share your thoughts on how Relay works…",
  ui_ux_suggestion:    "What about the design or usability would you change?",
  integration_request: "Which tool, and what would the integration do?",
  pricing_feedback:    "Share your thoughts on pricing or plans…",
  general_suggestion:  "Share any idea or suggestion…",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function captureScreenshot(): Promise<string | null> {
  try {
    const html2canvas = (await import("html2canvas")).default
    const canvas = await html2canvas(document.body, { useCORS: true, scale: 0.5 })
    return canvas.toDataURL("image/png")
  } catch {
    return null
  }
}

function isRecordingSupported(): boolean {
  if (typeof window === "undefined") return false
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  if (isMobile) return false
  return typeof navigator.mediaDevices?.getDisplayMedia === "function"
}

function formatRecordingTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

// ─── Sub-views ───────────────────────────────────────────────────────────────

function RecordBugUnsupported({ onBugForm, onBack }: { onBugForm: () => void; onBack: () => void }) {
  return (
    <div className="px-5 py-6">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-4">
        <ChevronLeft className="w-3 h-3" /> Back
      </button>
      <div className="flex items-center gap-2 mb-3">
        <Monitor className="w-4 h-4 text-gray-500" />
        <h3 className="font-semibold text-gray-900">Screen Recording</h3>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 space-y-2">
        <p className="text-sm text-gray-700 leading-relaxed">
          Screen recording is available on desktop browsers including Chrome, Firefox, Edge, and Safari.
          To record a bug report, please log in on a desktop computer.
        </p>
        <p className="text-sm text-gray-500">
          On mobile you can still report a bug using the text form.
        </p>
      </div>
      <button
        onClick={onBugForm}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
      >
        <Bug className="w-3.5 h-3.5" />
        Report a Bug Instead
      </button>
    </div>
  )
}

function RecordBugInstructions({ onStart, onBack }: { onStart: () => Promise<void>; onBack: () => void }) {
  const [starting, setStarting] = useState(false)

  async function handleStart() {
    setStarting(true)
    await onStart()
    setStarting(false)
  }

  return (
    <div className="px-5 py-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-4">
        <ChevronLeft className="w-3 h-3" /> Back
      </button>
      <div className="flex items-center gap-2 mb-4">
        <Video className="w-4 h-4 text-red-500" />
        <h3 className="font-semibold text-gray-900">Record Your Screen</h3>
      </div>
      <ol className="space-y-2.5 mb-5">
        {[
          "Click Start Recording below",
          "Select your screen or tab when prompted",
          "Reproduce the issue",
          "Click Stop and Send when done",
        ].map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span className="text-sm text-gray-700">{step}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-gray-400 mb-4">Your recording helps us fix issues faster.</p>
      <button
        onClick={handleStart}
        disabled={starting}
        className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors"
      >
        {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
        {starting ? "Starting…" : "Start Recording"}
      </button>
    </div>
  )
}

function RecordBugReview({
  videoBlob,
  onDone,
  onBack,
}: {
  videoBlob: Blob | null
  onDone:    (ticket: string) => void
  onBack:    () => void
}) {
  const [description, setDescription] = useState("")
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState("")

  async function handleSend() {
    if (!description.trim() || !videoBlob) return
    setSubmitting(true)
    setError("")
    try {
      const formData = new FormData()
      formData.append("video", videoBlob, `bug-recording-${Date.now()}.webm`)
      formData.append("description", description.trim())
      formData.append("currentPageUrl", window.location.href)
      formData.append("browserInfo", navigator.userAgent)
      formData.append("timestamp", new Date().toISOString())
      const res = await fetch("/api/support/bug-video", { method: "POST", body: formData })
      const j = await res.json().catch(() => ({})) as { ok?: boolean; ticketNumber?: string; error?: string }
      if (!res.ok) { setError(j.error ?? "Failed to submit. Please try again."); return }
      onDone(j.ticketNumber ?? "VID")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const sizeMB = videoBlob ? (videoBlob.size / 1024 / 1024).toFixed(1) : "0"

  return (
    <div className="px-5 py-5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <h3 className="font-semibold text-gray-900">Recording Captured</h3>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700">
        {sizeMB} MB recorded — ready to send.
      </div>
      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">What went wrong? <span className="text-red-400">*</span></label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Briefly describe what happened…"
          autoFocus
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          Discard
        </button>
        <button
          onClick={handleSend}
          disabled={submitting || !description.trim() || !videoBlob}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60"
        >
          {submitting
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <><Send className="w-3.5 h-3.5" />Send Report</>
          }
        </button>
      </div>
    </div>
  )
}

function RecordBugDone({ ticketNumber, onClose }: { ticketNumber: string; onClose: () => void }) {
  return (
    <div className="px-5 py-10 flex flex-col items-center text-center">
      <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
      <p className="font-semibold text-gray-900 mb-1">Recording submitted!</p>
      <p className="text-sm text-gray-500 mb-1">Our team will review the video and investigate.</p>
      <p className="text-xs font-mono bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg mb-5">{ticketNumber}</p>
      <button onClick={onClose} className="text-sm text-blue-600 hover:underline">Close</button>
    </div>
  )
}

function BugForm({
  onDone, onBack,
}: {
  onDone:  (ticket: string) => void
  onBack:  () => void
}) {
  const [description,      setDescription]      = useState("")
  const [expectedBehavior, setExpectedBehavior] = useState("")
  const [submitting,       setSubmitting]       = useState(false)
  const [screenshotting,   setScreenshotting]   = useState(false)
  const [error,            setError]            = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim() || !expectedBehavior.trim()) return
    setSubmitting(true)
    setError("")
    setScreenshotting(true)
    const screenshot = await captureScreenshot()
    setScreenshotting(false)
    try {
      const res = await fetch("/api/support/bug-report", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description:       description.trim(),
          expectedBehavior:  expectedBehavior.trim(),
          currentPageUrl:    window.location.href,
          browserInfo:       navigator.userAgent,
          screenshotDataUrl: screenshot,
          timestamp:         new Date().toISOString(),
        }),
      })
      const j = await res.json().catch(() => ({})) as { ok?: boolean; ticketNumber?: string; error?: string }
      if (!res.ok) { setError(j.error ?? "Failed to submit. Please try again."); return }
      onDone(j.ticketNumber ?? "BUG")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-1">
        <ChevronLeft className="w-3 h-3" /> Back
      </button>
      <div className="flex items-center gap-2 mb-2">
        <Bug className="w-4 h-4 text-red-500" />
        <h3 className="font-semibold text-gray-900">Report a Bug</h3>
      </div>
      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">What happened? <span className="text-red-400">*</span></label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe what went wrong…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">What did you expect to happen? <span className="text-red-400">*</span></label>
        <textarea
          value={expectedBehavior}
          onChange={e => setExpectedBehavior(e.target.value)}
          rows={2}
          placeholder="What should have happened instead?"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          required
        />
      </div>
      <p className="text-xs text-gray-400">
        Page URL, browser info, and a screenshot will be captured automatically.
      </p>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !description.trim() || !expectedBehavior.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60"
        >
          {submitting ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" />{screenshotting ? "Capturing…" : "Submitting…"}</>
          ) : (
            <><Send className="w-3.5 h-3.5" />Submit Report</>
          )}
        </button>
      </div>
    </form>
  )
}

function BugDone({ ticketNumber, onClose }: { ticketNumber: string; onClose: () => void }) {
  return (
    <div className="px-5 py-10 flex flex-col items-center text-center">
      <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
      <p className="font-semibold text-gray-900 mb-1">Bug reported!</p>
      <p className="text-sm text-gray-500 mb-1">Our team has been notified and will investigate.</p>
      <p className="text-xs font-mono bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg mb-5">{ticketNumber}</p>
      <button onClick={onClose} className="text-sm text-blue-600 hover:underline">Close</button>
    </div>
  )
}

function FeedbackForm({ userName, onDone, onBack }: { userName: string; onDone: () => void; onBack: () => void }) {
  const [feedbackType, setFeedbackType] = useState<FeedbackTypeValue>("feature_request")
  const [description,  setDescription]  = useState("")
  const [useCase,      setUseCase]      = useState("")
  const [frequency,    setFrequency]    = useState<"daily"|"weekly"|"monthly"|"rarely">("weekly")
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState("")

  const isFeatureRequest = feedbackType === "feature_request"
  const canSubmit = description.trim().length > 0 && (!isFeatureRequest || useCase.trim().length > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/support/feature-request", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          feedbackType,
          description: description.trim(),
          ...(isFeatureRequest ? { useCase: useCase.trim(), frequency } : {}),
        }),
      })
      const j = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok) { setError(j.error ?? "Failed to submit. Please try again."); return }
      onDone()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedType = FEEDBACK_TYPES.find(t => t.value === feedbackType)!

  return (
    <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-1">
        <ChevronLeft className="w-3 h-3" /> Back
      </button>
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-4 h-4 text-indigo-500" />
        <h3 className="font-semibold text-gray-900">Share Feedback</h3>
      </div>
      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}

      {/* Type selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Feedback type</label>
        <select
          value={feedbackType}
          onChange={e => { setFeedbackType(e.target.value as FeedbackTypeValue); setDescription(""); setUseCase("") }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          {FEEDBACK_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
          ))}
        </select>
      </div>

      {/* Main text area */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {isFeatureRequest ? "Describe the feature" : "Your feedback"}
          {" "}<span className="text-red-400">*</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder={MAIN_PLACEHOLDER[feedbackType]}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          required
        />
      </div>

      {/* Feature-request extras */}
      {isFeatureRequest && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Why do you need it? <span className="text-red-400">*</span></label>
            <textarea
              value={useCase}
              onChange={e => setUseCase(e.target.value)}
              rows={2}
              placeholder="What problem does this solve for your team?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">How often would you use it?</label>
            <div className="grid grid-cols-4 gap-1.5">
              {FREQ_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFrequency(opt.value)}
                  className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    frequency === opt.value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <p className="text-xs text-gray-400">Submitting as {userName}</p>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5" />Send Feedback</>}
        </button>
      </div>
    </form>
  )
}

function FeedbackDone({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-5 py-10 flex flex-col items-center text-center">
      <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
      <p className="font-semibold text-gray-900 mb-1">Feedback sent!</p>
      <p className="text-sm text-gray-500 mb-5">Thanks — we read every submission.</p>
      <button onClick={onClose} className="text-sm text-blue-600 hover:underline">Close</button>
    </div>
  )
}

function AIChatPanel({ onBack }: { onBack: () => void }) {
  const [messages,  setMessages]  = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I'm the Relay Help Assistant. Ask me anything about how to use Relay — from creating issues to setting up routing rules, managing your team, or understanding your analytics." },
  ])
  const [input,     setInput]     = useState("")
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setInput("")
    setError("")
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: text }]
    setMessages(newMessages)
    setSending(true)
    try {
      const res = await fetch("/api/support/chat", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      })
      const j = await res.json().catch(() => ({})) as { reply?: string; error?: string }
      if (!res.ok || !j.reply) {
        setError(j.error ?? "Couldn't get a response. Please try again.")
        setMessages(prev => prev.slice(0, -1))
        setInput(text)
        return
      }
      setMessages(prev => [...prev, { role: "assistant", content: j.reply! }])
    } catch {
      setError("Network error. Please try again.")
      setMessages(prev => prev.slice(0, -1))
      setInput(text)
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "520px" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 p-0.5">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <BookOpen className="w-4 h-4 text-blue-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">How to Use Relay</p>
          <p className="text-xs text-gray-400">AI-powered help — may not be perfectly accurate</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-gray-100 text-gray-800 rounded-bl-sm"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
            </div>
          </div>
        )}
        {error && (
          <p className="text-xs text-red-500 text-center px-2">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100">
        <form onSubmit={sendMessage} className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask anything about Relay…"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            style={{ maxHeight: "80px", overflowY: "auto" }}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">AI-powered · may occasionally be inaccurate</p>
      </div>
    </div>
  )
}

// ─── Native Android Capture Panel ────────────────────────────────────────────

function NativeCapturePanel({
  onMediaCaptured,
  onBugForm,
  onBack,
}: {
  onMediaCaptured: (media: NativeMedia) => void
  onBugForm:       () => void
  onBack:          () => void
}) {
  const [capturing, setCapturing] = useState(false)
  const [error,     setError]     = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleCameraCapture() {
    setCapturing(true)
    setError("")
    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera")
      const photo = await Camera.getPhoto({
        quality:      90,
        allowEditing: false,
        resultType:   CameraResultType.DataUrl,
        source:       CameraSource.Prompt, // lets user choose camera or gallery
      })
      if (!photo.dataUrl) return
      onMediaCaptured({ kind: "image-dataurl", dataUrl: photo.dataUrl })
    } catch {
      // User cancelled or permission denied — stay on panel
      setError("Screenshot cancelled. Try again or use the file picker.")
    } finally {
      setCapturing(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type.startsWith("video/")) {
      onMediaCaptured({ kind: "video-file", file })
    } else {
      onMediaCaptured({ kind: "image-file", file })
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="px-5 py-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-4">
        <ChevronLeft className="w-3 h-3" /> Back
      </button>
      <div className="flex items-center gap-2 mb-4">
        <Camera className="w-4 h-4 text-red-500" />
        <h3 className="font-semibold text-gray-900">Capture Bug Evidence</h3>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2 mb-4">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <p className="text-sm text-gray-500 mb-4">
        Take a screenshot or upload a screen recording you already captured.
      </p>

      <div className="space-y-3">
        {/* Screenshot / gallery image */}
        <button
          onClick={handleCameraCapture}
          disabled={capturing}
          className="w-full flex items-start gap-4 p-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-left transition-colors disabled:opacity-60"
        >
          <div className="mt-0.5">
            {capturing
              ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              : <ImageIcon className="w-5 h-5 text-blue-500" />}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Take or Pick Screenshot</p>
            <p className="text-xs text-gray-500 mt-0.5">Opens camera or photo gallery</p>
          </div>
        </button>

        {/* Video from gallery (pre-recorded screen recording) */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-start gap-4 p-4 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-left transition-colors"
        >
          <FileVideo className="w-5 h-5 text-orange-500 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-900 text-sm">Upload Screen Recording</p>
            <p className="text-xs text-gray-500 mt-0.5">Pick a video you recorded from your gallery</p>
          </div>
        </button>

        {/* Text-only fallback */}
        <button
          onClick={onBugForm}
          className="w-full flex items-start gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-left transition-colors"
        >
          <Bug className="w-5 h-5 text-gray-500 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-900 text-sm">Describe in Text</p>
            <p className="text-xs text-gray-500 mt-0.5">Type what went wrong without media</p>
          </div>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <p className="text-xs text-gray-400 mt-4 text-center">
        To record your screen: use Android's built-in screen recorder, then upload the video here.
      </p>
    </div>
  )
}

// ─── Native Media Review ──────────────────────────────────────────────────────

function NativeMediaReview({
  media,
  onDone,
  onBack,
}: {
  media:  NativeMedia
  onDone: (ticket: string) => void
  onBack: () => void
}) {
  const [description,      setDescription]      = useState("")
  const [expectedBehavior, setExpectedBehavior] = useState("")
  const [submitting,       setSubmitting]        = useState(false)
  const [uploading,        setUploading]         = useState(false)
  const [error,            setError]             = useState("")
  const [imagePreview,     setImagePreview]      = useState<string | null>(null)

  // Build a preview dataUrl for image-file kind
  useEffect(() => {
    if (media.kind === "image-dataurl") {
      setImagePreview(media.dataUrl)
    } else if (media.kind === "image-file") {
      const reader = new FileReader()
      reader.onload = e => setImagePreview(e.target?.result as string)
      reader.readAsDataURL(media.file)
    }
  }, [media])

  const isVideo = media.kind === "video-file"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    if (!isVideo && !expectedBehavior.trim()) return
    setSubmitting(true)
    setError("")

    try {
      if (isVideo) {
        // Upload video via bug-video endpoint (FormData)
        setUploading(true)
        const form = new FormData()
        form.append("video",         (media as { kind: "video-file"; file: File }).file, `screen-recording-${Date.now()}.mp4`)
        form.append("description",   description.trim())
        form.append("currentPageUrl", window.location.href)
        form.append("browserInfo",   navigator.userAgent)
        form.append("timestamp",     new Date().toISOString())
        setUploading(false)

        const res = await fetch("/api/support/bug-video", { method: "POST", body: form })
        const j   = await res.json().catch(() => ({})) as { ok?: boolean; ticketNumber?: string; error?: string }
        if (!res.ok) { setError(j.error ?? "Upload failed. Please try again."); return }
        onDone(j.ticketNumber ?? "VID")
      } else {
        // Submit image (dataUrl) via bug-report endpoint
        const dataUrl = media.kind === "image-dataurl"
          ? media.dataUrl
          : imagePreview   // already converted in useEffect

        const res = await fetch("/api/support/bug-report", {
          method:  "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            description:       description.trim(),
            expectedBehavior:  expectedBehavior.trim(),
            currentPageUrl:    window.location.href,
            browserInfo:       navigator.userAgent,
            screenshotDataUrl: dataUrl,
            timestamp:         new Date().toISOString(),
          }),
        })
        const j = await res.json().catch(() => ({})) as { ok?: boolean; ticketNumber?: string; error?: string }
        if (!res.ok) { setError(j.error ?? "Submission failed. Please try again."); return }
        onDone(j.ticketNumber ?? "BUG")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-1">
        <ChevronLeft className="w-3 h-3" /> Back
      </button>
      <div className="flex items-center gap-2 mb-2">
        {isVideo ? <FileVideo className="w-4 h-4 text-orange-500" /> : <ImageIcon className="w-4 h-4 text-blue-500" />}
        <h3 className="font-semibold text-gray-900">{isVideo ? "Screen Recording" : "Screenshot"} Captured</h3>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* Preview */}
      {imagePreview && !isVideo && (
        <div className="rounded-xl overflow-hidden border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="Screenshot preview" className="w-full max-h-40 object-cover" />
        </div>
      )}
      {isVideo && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2 text-sm text-orange-800">
          <FileVideo className="w-4 h-4 shrink-0" />
          <span className="truncate">{(media as { kind: "video-file"; file: File }).file.name}</span>
          <span className="text-xs text-orange-500 shrink-0">
            {((media as { kind: "video-file"; file: File }).file.size / 1024 / 1024).toFixed(1)} MB
          </span>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">What went wrong? <span className="text-red-400">*</span></label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe what happened…"
          autoFocus
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          required
        />
      </div>

      {!isVideo && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">What should have happened? <span className="text-red-400">*</span></label>
          <textarea
            value={expectedBehavior}
            onChange={e => setExpectedBehavior(e.target.value)}
            rows={2}
            placeholder="Expected behavior…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            required
          />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          Back
        </button>
        <button
          type="submit"
          disabled={submitting || !description.trim() || (!isVideo && !expectedBehavior.trim())}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60"
        >
          {submitting
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{uploading ? "Uploading…" : "Submitting…"}</>
            : <><Send className="w-3.5 h-3.5" />Submit Report</>
          }
        </button>
      </div>
    </form>
  )
}

// ─── Support Chat Panel ───────────────────────────────────────────────────────

function SupportChatPanel({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [messages,    setMessages]    = useState<{ id: string; fromUser: boolean; body: string; createdAt: string }[]>([])
  const [input,       setInput]       = useState("")
  const [sending,     setSending]     = useState(false)
  const [error,       setError]       = useState("")
  const [isOnline,    setIsOnline]    = useState(true)
  const [firstMsg,    setFirstMsg]    = useState(true)
  const lastTime      = useRef<string | null>(null)
  const bottomRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function poll() {
      const url = `/api/support-chat${lastTime.current ? `?since=${lastTime.current}` : ""}`
      const res = await fetch(url)
      const j   = await res.json() as {
        messages?: { id: string; senderType: string; body: string; createdAt: string }[]
        online?:   boolean
      }
      if (j.messages?.length) {
        const mapped = j.messages.map(m => ({ id: m.id, fromUser: m.senderType === "user", body: m.body, createdAt: m.createdAt }))
        setMessages(prev => firstMsg ? mapped : [...prev, ...mapped])
        setFirstMsg(false)
        lastTime.current = j.messages.at(-1)!.createdAt
      }
      setIsOnline(j.online ?? true)
    }
    poll().catch(console.error)
    const iv = setInterval(poll, 5_000)
    return () => clearInterval(iv)
  }, [firstMsg])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setInput("")
    setError("")
    setSending(true)
    try {
      const res = await fetch("/api/support-chat", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
      })
      const j = await res.json() as { message?: { id: string; senderType: string; body: string; createdAt: string }; error?: string }
      if (!res.ok) { setError(j.error ?? "Failed to send"); return }
      if (j.message) {
        setMessages(prev => [...prev, { id: j.message!.id, fromUser: true, body: j.message!.body, createdAt: j.message!.createdAt }])
        lastTime.current = j.message.createdAt
        setFirstMsg(false)
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "480px" }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 p-0.5">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <Headphones className="w-4 h-4 text-green-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Contact Support</p>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-400" : "bg-gray-400"}`} />
            {isOnline ? "Online" : "Offline — we'll reply soon"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-6">
            <p className="text-sm text-gray-500">Send us a message and we'll get back to you!</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.fromUser ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.fromUser
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-gray-100 text-gray-800 rounded-bl-sm"
            }`}>
              {msg.body}
            </div>
          </div>
        ))}
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-gray-100">
        <form onSubmit={handleSend} className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
            rows={1}
            placeholder="Type your message…"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            style={{ maxHeight: "80px", overflowY: "auto" }}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="w-9 h-9 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded-xl disabled:opacity-40 transition-colors shrink-0"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SupportButton({ userName = "", orgName = "", triggerClassName }: Props) {
  const [open, setOpen]                   = useState(false)
  const [view, setView]                   = useState<View>("menu")
  const [ticketNum, setTicketNum]         = useState("")
  const [isRecording, setIsRecording]     = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordTicketNum, setRecordTicketNum]   = useState("")
  const [nativeMedia, setNativeMedia]     = useState<NativeMedia | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const recordedBlobRef  = useRef<Blob | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)

  function openModal() { setView("menu"); setOpen(true) }
  function closeModal() { setOpen(false) }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        recordedBlobRef.current = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" })
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        setIsRecording(false)
        setRecordingSeconds(0)
        setView("record-review")
        setOpen(true)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingSeconds(0)
      setOpen(false)
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch {
      // User cancelled permission dialog — stay on instructions
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
  }

  return (
    <>
      {/* Nav trigger */}
      <button
        onClick={openModal}
        aria-label="Help & support"
        className={triggerClassName ?? "p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"}
      >
        <CircleHelp className="w-5 h-5" />
      </button>

      {/* Screen recording indicator (shown during active recording) */}
      {isRecording && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 bg-black/85 text-white px-3.5 py-2 rounded-full shadow-xl">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
          <span className="text-xs font-mono">{formatRecordingTime(recordingSeconds)}</span>
          <button
            onClick={stopRecording}
            className="ml-1 text-xs bg-white/20 hover:bg-white/30 px-2.5 py-0.5 rounded-full transition-colors whitespace-nowrap font-medium"
          >
            Stop &amp; Send
          </button>
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 px-4 pt-4 modal-safe-bottom">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden">
            {/* Header */}
            {view !== "chat" && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h2 className="font-semibold text-gray-900">Support</h2>
                  <p className="text-xs text-gray-500">{orgName}</p>
                </div>
                <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {view === "chat" && (
              <div className="absolute top-3 right-3 z-10">
                <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 bg-white shadow-sm">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Views */}
            {view === "menu" && (
              <div className="px-5 py-5 space-y-3">
                <p className="text-sm text-gray-500 mb-4">How can we help you?</p>
                {[
                  {
                    icon:   <Bug className="w-5 h-5 text-red-500" />,
                    bg:     "bg-red-50 hover:bg-red-100 border-red-200",
                    title:  "Report a Bug",
                    desc:   "Describe what went wrong with the text form",
                    action: () => setView("bug"),
                  },
                  {
                    icon:   <Video className="w-5 h-5 text-orange-500" />,
                    bg:     "bg-orange-50 hover:bg-orange-100 border-orange-200",
                    title:  "Record Bug",
                    desc:   isNativeApp()
                      ? "Capture a screenshot or upload a screen recording"
                      : "Capture your screen to show us exactly what happened",
                    action: () => setView(
                      isNativeApp()
                        ? "native-capture"
                        : isRecordingSupported()
                        ? "record-instructions"
                        : "record-unsupported"
                    ),
                  },
                  {
                    icon:   <MessageSquare className="w-5 h-5 text-indigo-500" />,
                    bg:     "bg-indigo-50 hover:bg-indigo-100 border-indigo-200",
                    title:  "Share Feedback",
                    desc:   "Feature requests, suggestions, or general thoughts",
                    action: () => setView("feedback"),
                  },
                  {
                    icon:   <BookOpen className="w-5 h-5 text-blue-500" />,
                    bg:     "bg-blue-50 hover:bg-blue-100 border-blue-200",
                    title:  "How to Use Relay",
                    desc:   "Chat with our AI assistant for instant help",
                    action: () => setView("chat"),
                  },
                  {
                    icon:   <Headphones className="w-5 h-5 text-green-500" />,
                    bg:     "bg-green-50 hover:bg-green-100 border-green-200",
                    title:  "Contact Support",
                    desc:   "Message our team directly — we'll get back to you ASAP",
                    action: () => setView("support"),
                  },
                ].map(item => (
                  <button
                    key={item.title}
                    onClick={item.action}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-colors ${item.bg}`}
                  >
                    <div className="mt-0.5">{item.icon}</div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {view === "bug" && (
              <BugForm
                onDone={ticket => { setTicketNum(ticket); setView("bug-done") }}
                onBack={() => setView("menu")}
              />
            )}
            {view === "bug-done" && <BugDone ticketNumber={ticketNum} onClose={closeModal} />}

            {view === "feedback" && (
              <FeedbackForm
                userName={userName}
                onDone={() => setView("feedback-done")}
                onBack={() => setView("menu")}
              />
            )}
            {view === "feedback-done" && <FeedbackDone onClose={closeModal} />}

            {view === "chat" && (
              <AIChatPanel onBack={() => setView("menu")} />
            )}

            {view === "record-unsupported" && (
              <RecordBugUnsupported
                onBugForm={() => setView("bug")}
                onBack={() => setView("menu")}
              />
            )}
            {view === "record-instructions" && (
              <RecordBugInstructions
                onStart={startRecording}
                onBack={() => setView("menu")}
              />
            )}
            {view === "record-review" && (
              <RecordBugReview
                videoBlob={recordedBlobRef.current}
                onDone={ticket => { setRecordTicketNum(ticket); setView("record-done") }}
                onBack={() => { recordedBlobRef.current = null; setView("menu") }}
              />
            )}
            {view === "record-done" && (
              <RecordBugDone ticketNumber={recordTicketNum} onClose={closeModal} />
            )}

            {view === "native-capture" && (
              <NativeCapturePanel
                onMediaCaptured={media => { setNativeMedia(media); setView("native-review") }}
                onBugForm={() => setView("bug")}
                onBack={() => setView("menu")}
              />
            )}
            {view === "native-review" && nativeMedia && (
              <NativeMediaReview
                media={nativeMedia}
                onDone={ticket => { setRecordTicketNum(ticket); setView("record-done") }}
                onBack={() => setView("native-capture")}
              />
            )}

            {view === "support" && (
              <SupportChatPanel
                onDone={() => setView("support-done")}
                onBack={() => setView("menu")}
              />
            )}
            {view === "support-done" && (
              <div className="px-5 py-10 flex flex-col items-center text-center">
                <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
                <p className="font-semibold text-gray-900 mb-1">Message sent!</p>
                <p className="text-sm text-gray-500 mb-5">Our team will reply soon. Check your Messages page for updates.</p>
                <button onClick={closeModal} className="text-sm text-blue-600 hover:underline">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
