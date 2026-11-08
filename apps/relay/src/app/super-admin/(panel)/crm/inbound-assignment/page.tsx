"use client"

import { useState, useEffect } from "react"
import { Users, RefreshCw, Loader2, ToggleLeft, ToggleRight, AlertTriangle } from "lucide-react"

interface SalesRep {
  id: string
  name: string
  email: string
  role: string
  inboundEligible: boolean
  inboundLastAssignedAt: string | null
  isActive: boolean
}

interface InboundStats {
  unassignedCount: number
  eligibleCount: number
}

function relativeDate(d: string | null): string {
  if (!d) return "Never"
  const diffMs   = Date.now() - new Date(d).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 60)   return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24)    return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 30)   return `${diffDays}d ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

export default function InboundAssignmentPage() {
  const [reps, setReps]         = useState<SalesRep[]>([])
  const [stats, setStats]       = useState<InboundStats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [repsRes, statsRes] = await Promise.all([
        fetch("/api/super-admin/crm/inbound-assignment"),
        fetch("/api/super-admin/crm/prospects?isUnassigned=true&isRegistered=true&limit=1"),
      ])
      const repsJson  = await repsRes.json() as { reps?: SalesRep[]; error?: string }
      const statsJson = await statsRes.json() as { total?: number }

      if (!repsRes.ok || !repsJson.reps) {
        setError(repsJson.error ?? "Failed to load reps")
        return
      }
      setReps(repsJson.reps)
      setStats({
        unassignedCount: statsJson.total ?? 0,
        eligibleCount:   repsJson.reps.filter(r => r.inboundEligible).length,
      })
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function toggleEligible(repId: string, currentValue: boolean) {
    setSaving(repId)
    try {
      const res = await fetch("/api/super-admin/crm/inbound-assignment", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ updates: [{ id: repId, inboundEligible: !currentValue }] }),
      })
      if (!res.ok) return
      setReps(prev => prev.map(r =>
        r.id === repId ? { ...r, inboundEligible: !currentValue } : r
      ))
      setStats(prev => prev ? {
        ...prev,
        eligibleCount: prev.eligibleCount + (currentValue ? -1 : 1),
      } : prev)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-400" />
            Inbound Assignment
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Control which sales reps receive new customer registrations via round-robin.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Eligible Reps</p>
            <p className={`text-2xl font-bold ${stats.eligibleCount > 0 ? "text-green-400" : "text-red-400"}`}>
              {stats.eligibleCount}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">of {reps.length} total reps</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Unassigned Queue</p>
            <p className={`text-2xl font-bold ${stats.unassignedCount > 0 ? "text-orange-400" : "text-gray-400"}`}>
              {stats.unassignedCount}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">registered customers without a rep</p>
          </div>
        </div>
      )}

      {/* Warning: no eligible reps */}
      {!loading && stats?.eligibleCount === 0 && (
        <div className="flex items-start gap-3 p-4 bg-orange-900/20 border border-orange-800/60 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
          <p className="text-sm text-orange-300">
            No reps are eligible for round-robin assignment. New registrations will be queued unassigned until a rep is enabled below.
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm">{error}</div>
      )}

      {/* Rep list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {reps.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No sales reps found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-950/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Rep</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Assigned</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Round-Robin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {reps.map(rep => (
                  <tr key={rep.id} className={`transition-colors ${rep.isActive ? "hover:bg-gray-800/30" : "opacity-50"}`}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-white">{rep.name}</span>
                        <span className="text-xs text-gray-500">{rep.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400 capitalize">{rep.role.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {relativeDate(rep.inboundLastAssignedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => void toggleEligible(rep.id, rep.inboundEligible)}
                        disabled={saving === rep.id || !rep.isActive}
                        className="inline-flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
                        aria-label={rep.inboundEligible ? "Disable round-robin" : "Enable round-robin"}
                      >
                        {saving === rep.id ? (
                          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                        ) : rep.inboundEligible ? (
                          <>
                            <ToggleRight className="w-6 h-6 text-green-400" />
                            <span className="text-green-400 font-medium text-xs">Enabled</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-6 h-6 text-gray-600" />
                            <span className="text-gray-500 text-xs">Disabled</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <p className="text-xs text-gray-600">
        Round-robin assigns the next new customer registration to the eligible rep with the oldest assignment date (nulls first). Only active reps with <code className="text-gray-500">ACTIVE</code> employment status are considered.
      </p>
    </div>
  )
}
