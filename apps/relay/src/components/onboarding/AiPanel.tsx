"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles, Send, X, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Bot, Users, Building2, Tags, ArrowRight, Upload, User } from "lucide-react"
import { OperationPreview } from "./OperationPreview"
import type { BatchPreviewData } from "./OperationPreview"
import type { ConfigOperation, WizardUpdatePayload } from "@/lib/config-engine/allowlist"

interface Message {
  role: "user" | "assistant" | "system"
  content: string
}

interface AiPanelProps {
  stage: number
  sessionId?: string
  onConfigApplied?: () => void
  onWizardUpdate?: (update: WizardUpdatePayload) => void
  wizardContext?: Record<string, unknown>
}

function stageHint(stage: number): string {
  switch (stage) {
    case 1: return "Describe your company in plain language"
    case 2: return "Tell me about your operations"
    case 3: return "Describe your facilities in plain language"
    case 4: return "Describe your job titles or team structure"
    case 5: return "Paste names and emails, or upload a CSV"
    case 6: return "Describe how you want issues assigned"
    default: return "Tell me what you need"
  }
}

function stageGreeting(stage: number): string {
  switch (stage) {
    case 1: return "I can help fill in your organization profile. Describe your company — what industry you're in, how many employees, and how many locations."
    case 2: return "I can suggest which issue categories to track based on your operations. What kinds of problems does your team typically handle?"
    case 3: return "I can help you set up your locations and departments. Tell me about your facilities, or ask me to create specific departments or locations."
    case 4: return "I can suggest employee role types based on your team structure. Describe your job titles, positions, or workforce — I'll map them to the right Relay roles."
    case 5: return "I can help add team members. Paste a list of names and emails, describe your team, or upload a CSV roster."
    case 6: return "I can help set up routing rules for each issue type. Tell me who should receive each category of issue."
    default: return "Tell me how I can help with your setup."
  }
}

// Wizard stages that return local-state suggestions rather than DB operations
const WIZARD_STAGES = new Set([1, 2, 4, 5, 6])

export function AiPanel({ stage, sessionId, onConfigApplied, onWizardUpdate, wizardContext }: AiPanelProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: stageGreeting(stage) }
  ])
  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  const [loading, setLoading] = useState(false)
  const [pendingPreview, setPendingPreview] = useState<{ preview: BatchPreviewData; operations: ConfigOperation[] } | null>(null)
  const [pendingWizardUpdate, setPendingWizardUpdate] = useState<{ update: WizardUpdatePayload; summary: string } | null>(null)
  const [applying, setApplying] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, pendingPreview, pendingWizardUpdate, confirmation])

  async function sendMessage(overrideMsg?: string) {
    const msg = (overrideMsg ?? input).trim()
    if (!msg || loading) return
    setInput("")
    setError(null)
    setConfirmation(null)
    setPendingPreview(null)
    setPendingWizardUpdate(null)

    const userMsg: Message = { role: "user", content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch("/api/ai/configure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history,
          sessionId,
          stage,
          wizardContext: WIZARD_STAGES.has(stage) ? wizardContext : undefined,
        }),
      })
      const json = await res.json() as {
        type?: string
        question?: string
        preview?: BatchPreviewData
        operations?: ConfigOperation[]
        update?: WizardUpdatePayload
        summary?: string
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
      } else if (json.type === "wizard_update") {
        const aiMsg = `I'll ${json.summary!}. Review the suggestions below and click Apply to add them.`
        setMessages(prev => [...prev, { role: "assistant", content: aiMsg }])
        setPendingWizardUpdate({ update: json.update!, summary: json.summary! })
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

  function applyWizardUpdate() {
    if (!pendingWizardUpdate) return
    onWizardUpdate?.(pendingWizardUpdate.update)
    const confirmMsg = `${pendingWizardUpdate.summary} — added to your setup.`
    setConfirmation(confirmMsg)
    setMessages(prev => [...prev, { role: "assistant", content: confirmMsg }])
    setPendingWizardUpdate(null)
  }

  function discardPreview() {
    setPendingPreview(null)
    setPendingWizardUpdate(null)
    setMessages(prev => [...prev, { role: "system", content: "Suggestions discarded." }])
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    // Read as text — works for CSV; for XLSX we extract visible text
    try {
      const text = await file.text()
      const preview = text.slice(0, 2000)
      await sendMessage(`Here is my team roster (CSV):\n${preview}`)
    } catch {
      setError("Could not read the file. Please paste the content as text instead.")
    }
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
            <p className="text-xs text-blue-600">{stageHint(stage)}</p>
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

        {pendingWizardUpdate && (
          <div className="mt-2">
            <WizardUpdatePreview
              update={pendingWizardUpdate.update}
              summary={pendingWizardUpdate.summary}
              onApprove={applyWizardUpdate}
              onDiscard={discardPreview}
            />
          </div>
        )}

        {confirmation && !pendingPreview && !pendingWizardUpdate && (
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
          {/* CSV upload button — only shown for team invites stage */}
          {stage === 5 && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || applying}
                title="Upload CSV roster"
                className="p-2 border border-gray-300 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 text-gray-500 hover:text-blue-600 rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
              </button>
            </>
          )}
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder={stageHint(stage)}
            disabled={loading || applying}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white"
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading || applying}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">AI suggestions require your approval before anything is saved</p>
      </div>
    </div>
  )
}

// ── Wizard Update Preview ─────────────────────────────────────────────────────

function WizardUpdatePreview({
  update,
  summary,
  onApprove,
  onDiscard,
}: {
  update: WizardUpdatePayload
  summary: string
  onApprove: () => void
  onDiscard: () => void
}) {
  const totalItems =
    (update.orgProfile ? 1 : 0) +
    (update.issueTypes?.length ?? 0) +
    (update.employeeTypeDefs?.length ?? 0) +
    (update.teamMembers?.length ?? 0) +
    (update.routing ? Object.keys(update.routing).length : 0)

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
        <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-900">{summary}</p>
          <p className="text-xs text-blue-700 mt-0.5">{totalItems} suggestion{totalItems !== 1 ? "s" : ""} · Review and approve to apply</p>
        </div>
      </div>

      {update.orgProfile && (
        <WizardPreviewGroup label="Organization Profile" icon={<Building2 className="w-3.5 h-3.5 text-blue-600" />}>
          {Object.entries(update.orgProfile).filter(([, v]) => v).map(([k, v]) => (
            <WizardPreviewItem key={k} title={formatFieldName(k)} detail={String(v)} color="blue" />
          ))}
        </WizardPreviewGroup>
      )}

      {update.issueTypes && update.issueTypes.length > 0 && (
        <WizardPreviewGroup label="Issue Types" icon={<Tags className="w-3.5 h-3.5 text-purple-600" />}>
          {update.issueTypes.map(t => (
            <WizardPreviewItem key={t} title={t} color="purple" />
          ))}
        </WizardPreviewGroup>
      )}

      {update.employeeTypeDefs && update.employeeTypeDefs.length > 0 && (
        <WizardPreviewGroup label="Employee Types" icon={<Users className="w-3.5 h-3.5 text-green-600" />}>
          {update.employeeTypeDefs.map(d => (
            <WizardPreviewItem key={d.id} title={d.name} detail={`${d.baseRole} · ${d.pageAccess.length} pages`} color="green" />
          ))}
        </WizardPreviewGroup>
      )}

      {update.teamMembers && update.teamMembers.length > 0 && (
        <WizardPreviewGroup label="Team Members" icon={<User className="w-3.5 h-3.5 text-orange-600" />}>
          {update.teamMembers.map(m => (
            <WizardPreviewItem key={m.id} title={m.name || m.email} detail={[m.title, m.email].filter(Boolean).join(" · ")} color="orange" />
          ))}
        </WizardPreviewGroup>
      )}

      {update.routing && Object.keys(update.routing).length > 0 && (
        <WizardPreviewGroup label="Routing Rules" icon={<ArrowRight className="w-3.5 h-3.5 text-indigo-600" />}>
          {Object.entries(update.routing).map(([cat, val]) => (
            <WizardPreviewItem key={cat} title={cat} detail={`→ ${val}`} color="indigo" />
          ))}
        </WizardPreviewGroup>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onApprove}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Apply to Setup
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  )
}

function WizardPreviewGroup({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

type ColorVariant = "blue" | "purple" | "green" | "orange" | "indigo"
const colorMap: Record<ColorVariant, string> = {
  blue:   "bg-blue-50 border-blue-200",
  purple: "bg-purple-50 border-purple-200",
  green:  "bg-green-50 border-green-200",
  orange: "bg-orange-50 border-orange-200",
  indigo: "bg-indigo-50 border-indigo-200",
}

function WizardPreviewItem({ title, detail, color = "blue" }: { title: string; detail?: string; color?: ColorVariant }) {
  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg border ${colorMap[color]}`}>
      <div className="min-w-0 flex-1">
        <span className="text-xs font-semibold text-gray-800">{title}</span>
        {detail && <p className="text-xs text-gray-500 mt-0.5 truncate">{detail}</p>}
      </div>
    </div>
  )
}

function formatFieldName(key: string): string {
  const map: Record<string, string> = {
    companyName: "Company Name",
    industry: "Industry",
    companySize: "Company Size",
    numberOfLocations: "Number of Locations",
  }
  return map[key] ?? key
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
