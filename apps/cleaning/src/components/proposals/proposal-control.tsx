"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiSend } from "@/lib/client"

type Proposal = { id: string; token: string; status: string }

// Staff control on an estimate: create a proposal, send it, copy the public
// accept link, download the PDF (Phase 27).
export function ProposalControl({ estimateId, proposal }: { estimateId: string; proposal: Proposal | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setBusy(true); setError(null)
    const res = await apiSend(`/api/estimates/${estimateId}/proposal`, "POST", {})
    setBusy(false)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }
  async function send() {
    setBusy(true); setError(null)
    const res = await apiSend(`/api/proposals/${proposal!.id}/send`, "POST")
    setBusy(false)
    if (!res.ok) return setError(res.error)
    router.refresh()
  }
  async function copy() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/proposal/${proposal!.token}`); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ }
  }

  if (!proposal) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={create} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">{busy ? "…" : "Create proposal"}</button>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Proposal · {proposal.status.toLowerCase()}</span>
      {proposal.status === "DRAFT" ? <button onClick={send} disabled={busy} className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">Send</button> : null}
      <button onClick={copy} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{copied ? "Copied" : "Copy link"}</button>
      <a href={`/api/proposals/${proposal.id}/pdf`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">PDF</a>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
