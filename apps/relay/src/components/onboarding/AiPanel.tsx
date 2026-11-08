"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles, Send, X, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Bot } from "lucide-react"
import { OperationPreview } from "./OperationPreview"
import type { BatchPreviewData } from "./OperationPreview"
import type { ConfigOperation } from "@/lib/config-engine/allowlist"

interface Message {
  role: "user" | "assistant" | "system"
  content: string
}

interface AiPanelProps {
  stage: number
  sessionId?: string
  onConfigApplied?: () => void
}

export function AiPanel({ stage, sessionId, onConfigApplied }: AiPanelProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "I can help you set up your locations and departments. Tell me about your facilities, or ask me to create specific departments or locations."
    }
  ])
  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  const [loading, setLoading] = useState(false)
  const [pendingPreview, setPendingPreview] = useState<{ preview: BatchPreviewData; operations: ConfigOperation[] } | null>(null)
  const [applying, setApplying] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, pendingPreview, confirmation])

  async function sendMessage() {
    const msg = input.trim()
    if (!msg || loading) return
    setInput("")
    setError(null)
    setConfirmation(null)
    setPendingPreview(null)

    const userMsg: Message = { role: "user", content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch("/api/ai/configure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: msg, history, sessionId }),
      })
      const json = await res.json() as {
        type?: string
        question?: string
        preview?: BatchPreviewData
        operations?: ConfigOperation[]
        history?: Array<{ role: "user" | "assistant"; content: string }>
        errors?: string[]
        error?: string
      }

      if (!res.ok) {
        const errMsg = json.error ?? (json.errors?.join("; ")) ?? "An error occurred."
        setMessages(prev => [...prev, { role: "system", content: errMsg }])
        setError(errMsg)
        return
      }

      if (json.history) setHistory(json.history)

      if (json.type === "clarification") {
        setMessages(prev => [...prev, { role: "assistant", content: json.question! }])
      } else if (json.type === "preview") {
        const aiMsg = `I'll ${json.preview!.summary}. Review the changes below and click Approve to apply them.`
        setMessages(prev => [...prev, { role: "assistant", content: aiMsg }])
        setPendingPreview({ preview: json.preview!, operations: json.operations! })
      } else if (json.type === "validation_error") {
        const errText = json.errors?.join("; ") ?? "Validation failed."
        setMessages(prev => [...prev, { role: "system", content: errText }])
      } else if (json.type === "error") {
        const errText = json.errors?.join("; ") ?? json.error ?? "An error occurred."
        setMessages(prev => [...prev, { role: "system", content: errText }])
      }
    } catch {
      setMessages(prev => [...prev, { role: "system", content: "Network error. Please try again." }])
    } finally {
      setLoading(false)
    }
  }

  async function applyBatch() {
    if (!pendingPreview) return
    setApplying(true)
    setError(null)

    try {
      const res = await fetch("/api/ai/configure/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchId: pendingPreview.preview.batchId,
          operations: pendingPreview.operations,
          sessionId,
        }),
      })
      const json = await res.json() as {
        applied?: number
        failed?: number
        confirmation?: string
        failures?: Array<{ type: string; error: string }>
        error?: string
      }

      if (!res.ok) {
        setMessages(prev => [...prev, { role: "system", content: json.error ?? "Failed to apply changes." }])
        return
      }

      const confirmMsg = json.confirmation ?? `${json.applied} change${json.applied !== 1 ? "s" : ""} applied.`
      setConfirmation(confirmMsg)
      setMessages(prev => [...prev, { role: "assistant", content: confirmMsg }])
      setPendingPreview(null)

      if (json.failures && json.failures.length > 0) {
        const failMsg = `Note: ${json.failures.length} operation${json.failures.length > 1 ? "s" : ""} failed: ${json.failures.map(f => f.error).join("; ")}`
        setMessages(prev => [...prev, { role: "system", content: failMsg }])
      }

      onConfigApplied?.()
    } catch {
      setMessages(prev => [...prev, { role: "system", content: "Network error. Please try again." }])
    } finally {
      setApplying(false)
    }
  }

  function discardPreview() {
    setPendingPreview(null)
    setMessages(prev => [...prev, { role: "system", content: "Changes discarded." }])
  }

  if (!open) {
    return (
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl hover:border-blue-300 transition-colors group"
        >
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-blue-900">AI Setup Assistant</p>
            <p className="text-xs text-blue-600">Describe your facilities in plain language</p>
          </div>
          <ChevronDown className="w-4 h-4 text-blue-500 ml-auto group-hover:translate-y-0.5 transition-transform" />
        </button>
      </div>
    )
  }

  return (
    <div className="mt-6 border border-blue-200 rounded-xl bg-gradient-to-b from-blue-50 to-white overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-semibold text-blue-900">AI Setup Assistant</span>
          <span className="text-xs text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">Stage {stage}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-blue-400 hover:text-blue-700 transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Message thread */}
      <div className="px-4 py-3 space-y-3 max-h-72 overflow-y-auto">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {pendingPreview && (
          <div className="mt-2">
            <OperationPreview
              preview={pendingPreview.preview}
              onApprove={applyBatch}
              onDiscard={discardPreview}
              applying={applying}
            />
          </div>
        )}

        {confirmation && !pendingPreview && (
          <div className="flex items-start gap-2 p-2.5 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800">
            <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
            {confirmation}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            Thinking…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-4">
        {error && (
          <div className="flex items-start gap-1.5 mb-2 text-xs text-red-700">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="e.g. Create Production and Maintenance at Main Plant"
            disabled={loading || applying}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!input.trim() || loading || applying}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">AI changes require your approval before anything is saved</p>
      </div>
    </div>
  )
}

function ChatMessage({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-xs px-3 py-2 bg-blue-600 text-white text-sm rounded-xl rounded-tr-sm">
          {message.content}
        </div>
      </div>
    )
  }

  if (message.role === "system") {
    return (
      <div className="flex items-start gap-1.5 text-xs text-amber-700">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        {message.content}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-3 h-3 text-blue-600" />
      </div>
      <div className="max-w-xs px-3 py-2 bg-white border border-gray-200 text-gray-800 text-sm rounded-xl rounded-tl-sm">
        {message.content}
      </div>
    </div>
  )
}
