"use client"

import { useState, useRef, useEffect } from "react"
import { MoreHorizontal, Archive, ArchiveRestore, Trash2, AlertTriangle, Download, FileText, Forward, Loader2 } from "lucide-react"

interface Props {
  emailId:    string
  threadKey?: string   // thread to export (defaults to emailId)
  subject:    string
  isArchived: boolean
  byName?:    string
  onSuccess:  () => void
  onForward?: (prefilledBody: string, subject: string) => void
  threadEmails?: Array<{
    direction: "sent" | "received"
    fromAddress: string
    toAddress: string
    subject: string
    bodyText: string
    sentAt: string
  }>
}

export function EmailActionMenu({ emailId, threadKey, subject, isArchived, byName, onSuccess, onForward, threadEmails }: Props) {
  const [open,        setOpen]        = useState(false)
  const [confirming,  setConfirming]  = useState(false)
  const [busy,        setBusy]        = useState(false)
  const [exporting,   setExporting]   = useState(false)
  const [error,       setError]       = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false)
        setConfirming(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    setOpen(v => !v)
    setConfirming(false)
    setError("")
  }

  async function patch(action: string, extra: Record<string, string> = {}) {
    setBusy(true); setError("")
    try {
      const r = await fetch(`/api/super-admin/crm/emails/${emailId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action, ...extra }),
      })
      if (r.ok) {
        setOpen(false)
        setConfirming(false)
        onSuccess()
      } else {
        const d = await r.json() as { error?: string }
        setError(d.error ?? "Action failed")
      }
    } catch {
      setError("Network error")
    } finally {
      setBusy(false)
    }
  }

  async function exportThread(format: "pdf" | "text") {
    setExporting(true); setError("")
    const key = threadKey ?? emailId
    try {
      const res = await fetch("/api/sales/emails/export", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ threadId: key, format }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setError(d.error ?? `Export failed (${res.status})`); return
      }
      const blob     = await res.blob()
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement("a")
      const cd       = res.headers.get("Content-Disposition") ?? ""
      const fnMatch  = cd.match(/filename="([^"]+)"/)
      a.href         = url
      a.download     = fnMatch?.[1] ?? `email-export.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setOpen(false)
    } catch {
      setError("Export failed")
    } finally {
      setExporting(false)
    }
  }

  function forwardThread(e: React.MouseEvent) {
    e.stopPropagation()
    if (!onForward || !threadEmails) return
    const lines: string[] = ["\n\n--- Forwarded Email Thread ---\n"]
    const sorted = [...threadEmails].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
    for (const email of sorted) {
      const dir = email.direction === "sent" ? "Sent" : "Received"
      lines.push(`[${dir}] ${new Date(email.sentAt).toLocaleString()}`)
      lines.push(`From: ${email.fromAddress}`)
      lines.push(`To: ${email.toAddress}`)
      lines.push(`Subject: ${email.subject}`)
      lines.push("")
      lines.push(email.bodyText || "(no body)")
      lines.push("")
    }
    onForward(lines.join("\n"), `Fwd: ${subject}`)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button
        onClick={toggle}
        title="Email actions"
        className="p-1 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-700/60 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && !confirming && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-56 overflow-hidden">
          {/* Archive / Unarchive */}
          {isArchived ? (
            <button
              onClick={e => { e.stopPropagation(); void patch("unarchive") }}
              disabled={busy}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white text-left transition-colors disabled:opacity-50"
            >
              <ArchiveRestore className="w-4 h-4 text-blue-400 shrink-0" />
              Unarchive
            </button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); void patch("archive") }}
              disabled={busy}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white text-left transition-colors disabled:opacity-50"
            >
              <Archive className="w-4 h-4 text-yellow-400 shrink-0" />
              <span className="flex-1">Archive</span>
              <span className="text-[10px] text-gray-500">hides from inbox</span>
            </button>
          )}

          <div className="border-t border-gray-700" />

          {/* Export options */}
          <button
            onClick={e => { e.stopPropagation(); void exportThread("pdf") }}
            disabled={exporting}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white text-left transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 text-emerald-400 shrink-0 animate-spin" /> : <Download className="w-4 h-4 text-emerald-400 shrink-0" />}
            Export Thread as PDF
          </button>
          <button
            onClick={e => { e.stopPropagation(); void exportThread("text") }}
            disabled={exporting}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white text-left transition-colors disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
            Export Thread as Text
          </button>
          {onForward && threadEmails && (
            <button
              onClick={forwardThread}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white text-left transition-colors"
            >
              <Forward className="w-4 h-4 text-purple-400 shrink-0" />
              Forward as Email Thread
            </button>
          )}

          <div className="border-t border-gray-700" />

          {/* Delete */}
          <button
            onClick={e => { e.stopPropagation(); setConfirming(true) }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 text-left transition-colors"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            Delete CRM Record
          </button>
        </div>
      )}

      {open && confirming && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-gray-800 border border-red-700/50 rounded-xl shadow-2xl w-72 p-4">
          <div className="flex items-start gap-2.5 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white mb-1.5">Delete this email record?</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                This removes the record from your CRM. It does not unsend the email or delete it from the recipient&apos;s inbox.
              </p>
              {subject && (
                <p className="text-xs text-gray-600 mt-1.5 truncate italic">&ldquo;{subject}&rdquo;</p>
              )}
            </div>
          </div>
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); void patch("delete", byName ? { deletedByName: byName } : {}) }}
              disabled={busy}
              className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
            >
              {busy ? "Deleting…" : "Delete Record"}
            </button>
            <button
              onClick={e => { e.stopPropagation(); setConfirming(false) }}
              className="px-3 py-2 text-xs text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
