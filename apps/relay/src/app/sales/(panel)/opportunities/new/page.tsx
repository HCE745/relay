"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Briefcase, Loader2 } from "lucide-react"

const STAGES = ["Qualified", "Demo", "Proposal", "Negotiating", "Closed Won", "Closed Lost"]

export default function NewOpportunityPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  // Prefill from query params (passed when navigating from a DemoCall detail page)
  const demoCallId    = searchParams.get("demoCallId") ?? ""
  const companyPrefill = searchParams.get("company") ?? ""
  const contactPrefill = searchParams.get("contact") ?? ""

  const [title,    setTitle]    = useState(companyPrefill ? `${companyPrefill} — Relay` : "")
  const [stage,    setStage]    = useState("Qualified")
  const [value,    setValue]    = useState("")
  const [closeDate, setCloseDate] = useState("")
  const [notes,    setNotes]    = useState("")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  // Update title when prefill data loads from params
  useEffect(() => {
    if (companyPrefill && !title) setTitle(`${companyPrefill} — Relay`)
  }, [companyPrefill]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError("Title is required"); return }
    setLoading(true); setError("")

    try {
      const res = await fetch("/api/sales/opportunities", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title:     title.trim(),
          stage,
          value:     value ? Number(value) : undefined,
          closeDate: closeDate || undefined,
          notes:     notes || undefined,
          demoCallId: demoCallId || undefined,
        }),
      })

      const data = await res.json() as { id?: string; error?: string }
      if (!res.ok) { setError(data.error ?? "Failed to create opportunity"); return }

      router.push(`/sales/opportunities/${data.id}`)
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-xl">
      {/* Back link */}
      <div className="mb-5">
        <Link
          href={demoCallId ? `/sales/accounts/${demoCallId}` : "/sales/opportunities"}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {demoCallId ? "Back to Account" : "Back to Opportunities"}
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">New Opportunity</h1>
          {(companyPrefill || contactPrefill) && (
            <p className="text-gray-400 text-sm mt-0.5">
              {companyPrefill}{companyPrefill && contactPrefill ? " · " : ""}{contactPrefill}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Opportunity Title *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Acme Corp — Relay Professional"
            className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        {/* Stage */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Stage</label>
          <select
            value={stage}
            onChange={e => setStage(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
          >
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <p className="text-xs text-gray-600 mt-1">
            Use <strong className="text-gray-500">Qualified</strong> for a new buying conversation. Advance stage as the deal progresses.
          </p>
        </div>

        {/* Value + Close date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Estimated Value (USD)</label>
            <input
              type="number"
              min="0"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="e.g. 12000"
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Expected Close Date</label>
            <input
              type="date"
              value={closeDate}
              onChange={e => setCloseDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Context about this deal, buying triggers, decision-maker details…"
            className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-emerald-500"
          />
        </div>

        {demoCallId && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/20 border border-blue-900/40 rounded-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            <p className="text-xs text-blue-300">This opportunity will be linked to the demo call record.</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Opportunity
          </button>
          <Link
            href={demoCallId ? `/sales/accounts/${demoCallId}` : "/sales/opportunities"}
            className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
