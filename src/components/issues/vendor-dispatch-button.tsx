"use client"

import { useState } from "react"
import { Send, X, Loader2, CheckCircle, Save, AlertCircle } from "lucide-react"

interface Props {
  issueId: string
  vendorId: string
  orgName: string
  vendorEmail: string | null
}

interface TemplateData {
  vendorName: string
  vendorEmail: string | null
  contactName: string | null
  defaultSubject: string
  defaultBody: string
  savedSubject?: string | null
}

export function VendorDispatchButton({ issueId, vendorEmail }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [template, setTemplate] = useState<TemplateData | null>(null)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [saveTemplate, setSaveAsTemplate] = useState(false)

  async function openDialog() {
    setOpen(true)
    setSent(false)
    setError("")
    setLoading(true)
    const res = await fetch(`/api/issues/${issueId}/vendor-dispatch`)
    setLoading(false)
    if (res.ok) {
      const data: TemplateData = await res.json()
      setTemplate(data)
      setSubject(data.savedSubject ?? data.defaultSubject)
      setBody(data.defaultBody)
    } else {
      const d = await res.json()
      setError(d.error ?? "Failed to load template")
    }
  }

  async function handleSend() {
    setSending(true)
    setError("")
    const res = await fetch(`/api/issues/${issueId}/vendor-dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, saveTemplate }),
    })
    setSending(false)
    if (res.ok) {
      setSent(true)
    } else {
      const d = await res.json()
      setError(d.error ?? "Failed to send")
    }
  }

  if (!vendorEmail) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        No email on file — add one to the vendor to enable dispatch
      </div>
    )
  }

  return (
    <>
      <button
        onClick={openDialog}
        className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
      >
        <Send className="w-4 h-4" />
        Contact Vendor
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">Contact Vendor</h3>
                {template && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Sending to: {template.vendorEmail ?? "No email on file"} ({template.vendorName})
                  </p>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {loading && (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading template…
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
              )}

              {sent && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Email sent to {template?.vendorName}
                </div>
              )}

              {!loading && template && !sent && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                    <input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Message Body</label>
                    <textarea
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      rows={12}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveTemplate}
                      onChange={e => setSaveAsTemplate(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Save className="w-3.5 h-3.5 text-gray-400" />
                    Save as default template for future vendor emails
                  </label>
                </>
              )}
            </div>

            {!loading && template && !sent && (
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
                <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !template.vendorEmail}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Sending…" : "Send Email"}
                </button>
              </div>
            )}

            {sent && (
              <div className="flex justify-end px-6 py-4 border-t border-gray-100">
                <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
