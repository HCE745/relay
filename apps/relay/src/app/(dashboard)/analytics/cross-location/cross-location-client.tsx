"use client"

import { useState, useCallback } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface ComparisonScope {
  id: string
  name: string
}

interface ComparisonMetrics {
  id: string
  name: string
  issueVolume: number
  avgResolutionDays: number | null
  escalationRate: number
  repeatIssueCount: number
  injuryReportCount: number
}

type CompareMode = "location" | "region" | "department"

export function CrossLocationClient({
  locations,
  departments,
  regions,
  organizationId,
}: {
  locations: ComparisonScope[]
  departments: ComparisonScope[]
  regions: ComparisonScope[]
  organizationId: string
}) {
  const [mode, setMode] = useState<CompareMode>("location")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [data, setData] = useState<ComparisonMetrics[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const options = mode === "location" ? locations : mode === "region" ? regions : departments

  function toggleId(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 6 ? [...prev, id] : prev
    )
  }

  const runComparison = useCallback(async () => {
    if (selectedIds.length < 2) { setError("Select at least 2 to compare"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/analytics/cross-location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, ids: selectedIds }),
      })
      if (!res.ok) { setError("Failed to load comparison"); return }
      const j = await res.json() as { metrics: ComparisonMetrics[] }
      setData(j.metrics)
    } catch {
      setError("Network error")
    } finally { setLoading(false) }
  }, [mode, selectedIds])

  const fmtDays = (d: number | null) => d == null ? "—" : `${Math.round(d * 10) / 10}d`

  const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899"]

  const chartData = data.map((d, i) => ({
    name: d.name.length > 16 ? d.name.slice(0, 14) + "…" : d.name,
    "Issue Volume": d.issueVolume,
    "Escalation %": Math.round(d.escalationRate * 10) / 10,
    "Repeat Issues": d.repeatIssueCount,
    "Injury Reports": d.injuryReportCount,
    fill: COLORS[i % COLORS.length],
  }))

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Mode selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Compare by</h2>
        <div className="flex gap-2 flex-wrap mb-5">
          {(["location", "region", "department"] as CompareMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setSelectedIds([]); setData([]) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                mode === m
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {options.length === 0 ? (
          <p className="text-sm text-gray-400">No {mode}s found for your organization.</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">Select 2–6 {mode}s to compare</p>
            <div className="flex flex-wrap gap-2">
              {options.map(o => {
                const selected = selectedIds.includes(o.id)
                const disabled = !selected && selectedIds.length >= 6
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleId(o.id)}
                    disabled={disabled}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      selected
                        ? "bg-blue-600 text-white border-blue-600"
                        : disabled
                        ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {o.name}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <button
          onClick={runComparison}
          disabled={loading || selectedIds.length < 2}
          className="mt-4 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? "Loading…" : "Compare"}
        </button>
      </div>

      {/* Results */}
      {data.length > 0 && (
        <div className="space-y-6">
          {/* Summary table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Comparison Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Issues</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Resolution</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Escalation %</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Repeat Issues</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Injuries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.map((d, i) => (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="font-medium text-gray-900">{d.name}</span>
                        </div>
                      </td>
                      <td className="text-right px-4 py-3.5 font-semibold text-gray-900">{d.issueVolume}</td>
                      <td className="text-right px-4 py-3.5 text-gray-700">{fmtDays(d.avgResolutionDays)}</td>
                      <td className="text-right px-4 py-3.5">
                        <span className={`font-medium ${d.escalationRate > 20 ? "text-red-600" : d.escalationRate > 10 ? "text-amber-600" : "text-green-600"}`}>
                          {Math.round(d.escalationRate)}%
                        </span>
                      </td>
                      <td className="text-right px-4 py-3.5 text-gray-700">{d.repeatIssueCount}</td>
                      <td className="text-right px-6 py-3.5 text-gray-700">{d.injuryReportCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Issue Volume</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Issue Volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Escalation Rate (%)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ left: 0, right: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v) => [`${v}%`, "Escalation Rate"]} />
                  <Bar dataKey="Escalation %" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
