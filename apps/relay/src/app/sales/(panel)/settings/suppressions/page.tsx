"use client"

import { useState, useEffect, useCallback } from "react"
import { ShieldOff, Plus, Trash2, RefreshCw, AlertCircle } from "lucide-react"

interface UnsubscribeRecord {
  email:     string
  reason:    string
  addedAt:   string
  notes:     string | null
  addedById: string | null
}

const REASON_LABELS: Record<string, string> = {
  UNSUBSCRIBE:    "Unsubscribed",
  DO_NOT_CONTACT: "Do Not Contact",
  BOUNCED:        "Hard Bounce",
  MANUAL:         "Manually Added",
}

const REASON_COLORS: Record<string, string> = {
  UNSUBSCRIBE:    "bg-orange-900/40 text-orange-300",
  DO_NOT_CONTACT: "bg-red-900/40 text-red-300",
  BOUNCED:        "bg-gray-800 text-gray-400",
  MANUAL:         "bg-blue-900/40 text-blue-300",
}

export default function SuppressionsPage() {
  const [records, setRecords]   = useState<UnsubscribeRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [email, setEmail]       = useState("")
  const [reason, setReason]     = useState("MANUAL")
  const [notes, setNotes]       = useState("")
  const [adding, setAdding]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/sales/unsubscribe")
      if (res.ok) {
        const data = await res.json()
        setRecords(data.records ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setAdding(true)
    try {
      const res = await fetch("/api/sales/unsubscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, reason, notes: notes || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to add"); return }
      setEmail("")
      setNotes("")
      setReason("MANUAL")
      await load()
    } catch {
      setError("Request failed")
    } finally {
      setAdding(false)
    }
  }

  async function remove(emailAddr: string) {
    setDeleting(emailAddr)
    try {
      await fetch(`/api/sales/unsubscribe?email=${encodeURIComponent(emailAddr)}`, { method: "DELETE" })
      setRecords(r => r.filter(x => x.email !== emailAddr))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <ShieldOff className="w-6 h-6 text-orange-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Email Suppressions</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Contacts on this list will not receive any outbound emails or be enrolled in sequences.
          </p>
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={add} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-300">Add to suppression list</p>
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-900/50 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="contact@company.com"
            required
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
          >
            <option value="MANUAL">Manual</option>
            <option value="DO_NOT_CONTACT">Do Not Contact</option>
            <option value="BOUNCED">Hard Bounce</option>
            <option value="UNSUBSCRIBE">Unsubscribed</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
          <button
            type="submit"
            disabled={adding}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-700 hover:bg-orange-600 disabled:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {adding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </button>
        </div>
      </form>

      {/* List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <p className="text-sm font-semibold text-gray-300">Suppressed contacts ({records.length})</p>
          <button onClick={load} className="text-gray-600 hover:text-gray-400 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-600 text-sm">Loading…</div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-gray-600 text-sm">No suppressed contacts</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Reason</th>
                <th className="text-left px-4 py-2 font-medium">Added</th>
                <th className="text-left px-4 py-2 font-medium">Notes</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {records.map(r => (
                <tr key={r.email} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">{r.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${REASON_COLORS[r.reason] ?? "bg-gray-800 text-gray-400"}`}>
                      {REASON_LABELS[r.reason] ?? r.reason}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(r.addedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{r.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(r.email)}
                      disabled={deleting === r.email}
                      title="Remove from suppression list"
                      className="text-gray-700 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {deleting === r.email
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
