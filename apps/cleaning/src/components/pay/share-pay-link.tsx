"use client"

import { useState } from "react"
import { apiSend } from "@/lib/client"

// Staff control: generate (idempotent) a public pay link for an invoice and copy
// it to send to the customer. Login-free payment on the other end.
export function SharePayLink({ invoiceId }: { invoiceId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setBusy(true); setError(null)
    const res = await apiSend<{ token: string }>(`/api/invoices/${invoiceId}/pay-link`, "POST")
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setUrl(`${window.location.origin}/pay/${res.data.token}`)
  }
  async function copy() {
    if (!url) return
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ }
  }
  return (
    <div className="flex items-center gap-2">
      {url ? (
        <>
          <input readOnly value={url} className="w-56 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-600" onFocus={(e) => e.target.select()} />
          <button onClick={copy} className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white">{copied ? "Copied" : "Copy"}</button>
        </>
      ) : (
        <button onClick={generate} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {busy ? "…" : "Pay link"}
        </button>
      )}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
