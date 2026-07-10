"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  X, Send, ChevronDown, Bold, Italic, List, Link2, RotateCcw, AlertTriangle,
} from "lucide-react"

interface Template {
  id:      string
  name:    string
  subject: string
  body:    string
}

interface DemoCallCtx {
  contactName:  string
  companyName:  string
  scheduledAt?: string | null
}

interface Props {
  demoCallId:    string
  toEmail:       string
  demoCtx:       DemoCallCtx
  inReplyTo?:    string
  threadId?:     string
  initialSubject?: string
  initialBody?:    string
  onClose:       () => void
  onSent:        () => void
}

export function CrmEmailCompose({
  demoCallId, toEmail, demoCtx, inReplyTo, threadId,
  initialSubject, initialBody, onClose, onSent,
}: Props) {
  const [to,        setTo]        = useState(toEmail)
  const [cc,        setCc]        = useState("")
  const [subject,   setSubject]   = useState(initialSubject ?? "")
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState("")
  const [success,   setSuccess]   = useState(false)
  const [showCc,    setShowCc]    = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTpl,   setShowTpl]   = useState(false)
  // Company name override — used when the record has no company name set
  const [companyName,      setCompanyName]      = useState(demoCtx.companyName)
  const [showCompanyInput, setShowCompanyInput] = useState(false)
  const [pendingTpl,       setPendingTpl]       = useState<Template | null>(null)
  const [savingCompany,    setSavingCompany]     = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/super-admin/crm/email-templates")
      .then(r => r.json())
      .then(d => setTemplates((d as { templates: Template[] }).templates))
      .catch(() => null)
  }, [])

  useEffect(() => {
    if (initialBody && editorRef.current) {
      editorRef.current.innerHTML = initialBody
    }
  }, [initialBody])

  function applyMergeTags(text: string, overrideCompany?: string): string {
    const company = overrideCompany ?? companyName
    const demoDate = demoCtx.scheduledAt
      ? new Date(demoCtx.scheduledAt).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })
      : "[demo date]"
    return text
      .replace(/\{\{contact_name\}\}/g, demoCtx.contactName)
      // If company name is still blank, leave the tag in place so the user can see it needs filling
      .replace(/\{\{company_name\}\}/g, company || "{{company_name}}")
      .replace(/\{\{demo_date\}\}/g,    demoDate)
  }

  function applyTemplate(t: Template) {
    const templateText = t.subject + t.body
    const needsCompany = templateText.includes("{{company_name}}") && !companyName.trim()

    if (needsCompany) {
      // Hold the template, ask for company name first
      setPendingTpl(t)
      setShowCompanyInput(true)
      setShowTpl(false)
      return
    }

    setSubject(applyMergeTags(t.subject))
    if (editorRef.current) {
      editorRef.current.innerHTML = applyMergeTags(t.body).replace(/\n/g, "<br>")
    }
    setShowTpl(false)
  }

  async function confirmCompanyName() {
    const name = companyName.trim()
    if (!name) return

    // Save the company name back to the DemoCall record
    setSavingCompany(true)
    try {
      await fetch(`/api/super-admin/crm/demo-calls/${demoCallId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ companyName: name }),
      })
    } catch { /* non-fatal */ }
    setSavingCompany(false)

    setShowCompanyInput(false)

    // Apply the pending template now that we have a company name
    if (pendingTpl) {
      setSubject(applyMergeTags(pendingTpl.subject, name))
      if (editorRef.current) {
        editorRef.current.innerHTML = applyMergeTags(pendingTpl.body, name).replace(/\n/g, "<br>")
      }
      setPendingTpl(null)
    }
  }

  function execCmd(cmd: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
  }

  function insertLink() {
    const url = prompt("Enter URL:", "https://")
    if (url) execCmd("createLink", url)
  }

  const getHtml = useCallback(() => editorRef.current?.innerHTML ?? "", [])

  async function handleSend() {
    const bodyHtml = getHtml().trim()
    if (!to || !subject || !bodyHtml) {
      setError("To, Subject, and Body are required.")
      return
    }

    // Block if any merge tags are still unresolved
    const unresolvedTag = /\{\{[^}]+\}\}/.exec(bodyHtml) ?? /\{\{[^}]+\}\}/.exec(subject)
    if (unresolvedTag) {
      if (unresolvedTag[0] === "{{company_name}}") {
        setError("Fill in the company name before sending.")
        setShowCompanyInput(true)
      } else {
        setError(`Unresolved merge tag: ${unresolvedTag[0]}`)
      }
      return
    }

    setSending(true)
    setError("")
    try {
      const res = await fetch("/api/super-admin/crm/emails", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ demoCallId, to, cc: cc || undefined, subject, bodyHtml, inReplyTo, threadId }),
      })
      if (!res.ok) {
        const d = await res.json() as { error: string }
        setError(d.error ?? "Failed to send email.")
        return
      }
      setSuccess(true)
      setTimeout(() => { onSent(); onClose() }, 1500)
    } catch {
      setError("Network error — please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">
            {inReplyTo ? "Reply" : "Compose Email"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* To / CC / Subject */}
          <div className="border-b border-gray-800 px-5 py-3 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-8 shrink-0">To</span>
              <input
                value={to}
                onChange={e => setTo(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder-gray-600"
                placeholder="recipient@example.com"
              />
              {!showCc && (
                <button onClick={() => setShowCc(true)} className="text-xs text-gray-500 hover:text-gray-300">+ CC</button>
              )}
            </div>
            {showCc && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-8 shrink-0">CC</span>
                <input
                  value={cc}
                  onChange={e => setCc(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder-gray-600"
                  placeholder="cc@example.com"
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-8 shrink-0">Sub</span>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder-gray-600"
                placeholder="Subject"
              />
            </div>

            {/* Company name prompt — shown when a template needs it */}
            {showCompanyInput && (
              <div className="flex items-center gap-3 rounded-lg bg-yellow-950/40 border border-yellow-700/50 px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                <span className="text-xs text-yellow-400 shrink-0">Company name:</span>
                <input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void confirmCompanyName() }}
                  placeholder="e.g. Acme Corp"
                  autoFocus
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder-gray-600"
                />
                <button
                  onClick={() => void confirmCompanyName()}
                  disabled={!companyName.trim() || savingCompany}
                  className="text-xs px-2.5 py-1 bg-yellow-700/70 hover:bg-yellow-700 text-yellow-100 rounded disabled:opacity-40 transition-colors shrink-0"
                >
                  {savingCompany ? "…" : pendingTpl ? "Apply" : "Save"}
                </button>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-800">
            <ToolbarBtn title="Bold"         onClick={() => execCmd("bold")}>         <Bold   className="w-3.5 h-3.5" /></ToolbarBtn>
            <ToolbarBtn title="Italic"       onClick={() => execCmd("italic")}>       <Italic className="w-3.5 h-3.5" /></ToolbarBtn>
            <ToolbarBtn title="Bullet list"  onClick={() => execCmd("insertUnorderedList")}><List   className="w-3.5 h-3.5" /></ToolbarBtn>
            <ToolbarBtn title="Insert link"  onClick={insertLink}>                   <Link2  className="w-3.5 h-3.5" /></ToolbarBtn>
            <ToolbarBtn title="Clear format" onClick={() => execCmd("removeFormat")}> <RotateCcw className="w-3.5 h-3.5" /></ToolbarBtn>

            <div className="flex-1" />

            {/* Templates dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowTpl(v => !v)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              >
                Templates
                <ChevronDown className="w-3 h-3" />
              </button>
              {showTpl && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden">
                  {templates.length === 0 ? (
                    <p className="text-xs text-gray-500 px-4 py-3">No templates found.</p>
                  ) : (
                    templates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => applyTemplate(t)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-0"
                      >
                        {t.name}
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{t.subject}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Editable body */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[220px] px-5 py-4 text-sm text-gray-200 outline-none leading-relaxed focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-indigo-400 [&_a]:underline"
            style={{ wordBreak: "break-word" }}
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 flex items-center gap-3">
          {error   && <p className="text-xs text-red-400 flex-1">{error}</p>}
          {success && <p className="text-xs text-green-400 flex-1">Email sent!</p>}
          {!error && !success && <span className="flex-1" />}
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || success}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ToolbarBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
    >
      {children}
    </button>
  )
}
