"use client"

import { useState } from "react"
import { Download, Loader2, ChevronDown } from "lucide-react"

interface Props {
  accountId:   string
  accountType: "demoCall" | "prospect"
}

export function ExportEmailsButton({ accountId, accountType }: Props) {
  const [open,      setOpen]      = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error,     setError]     = useState("")

  async function doExport(format: "pdf" | "text") {
    setExporting(true); setError("")
    try {
      const res = await fetch("/api/sales/emails/export/account", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ accountId, accountType, format }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: undefined })) as { error?: string }
        const msg = d.error ?? `Export failed (${res.status})`
        setError(msg)
        alert(`Export failed: ${msg}`)
        return
      }
      const blob    = await res.blob()
      if (blob.size === 0) {
        setError("Export returned empty file")
        alert("Export failed: server returned empty file")
        return
      }
      const url     = URL.createObjectURL(blob)
      const a       = document.createElement("a")
      const cd      = res.headers.get("Content-Disposition") ?? ""
      const fnMatch = cd.match(/filename="([^"]+)"/)
      a.href        = url
      a.download    = fnMatch?.[1] ?? `email-export.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error"
      setError(msg)
      alert(`Export error: ${msg}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
      >
        {exporting
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Download className="w-3.5 h-3.5" />}
        Export Emails
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-48 overflow-hidden">
          <button
            onClick={() => void doExport("pdf")}
            disabled={exporting}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white text-left transition-colors disabled:opacity-50"
          >
            Export as PDF
          </button>
          <button
            onClick={() => void doExport("text")}
            disabled={exporting}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white text-left transition-colors disabled:opacity-50"
          >
            Export as Text
          </button>
          {error && (
            <p className="text-xs text-red-400 px-4 py-2">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}
