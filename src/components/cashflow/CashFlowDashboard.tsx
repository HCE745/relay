"use client"

import { useState, useCallback } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { CashReservePanel } from "./CashReservePanel"

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = {
  label: string
  start: string
  end: string
  arInflows: number
  apOutflows: number
  adjustments: number
  netFlow: number
  projectedBalance: number
}

type ForecastData = {
  currentCash: number
  periods: Period[]
  avgMonthlyBurn: number
  runwayMonths: number | null
  isConsolidationParent: boolean
}

type Adjustment = {
  id: string
  entityId: string
  date: string
  description: string
  amountCents: number
  createdAt: string
}

type Props = {
  entityId: string
  isConsolidationParent: boolean
  initialData: ForecastData | null
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmt(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function fmtAbs(cents: number): string {
  return fmt(Math.abs(cents))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CashFlowDashboard({ entityId, isConsolidationParent, initialData }: Props) {
  const [mode, setMode] = useState<"weekly" | "monthly">("weekly")
  const [consolidated, setConsolidated] = useState(false)
  const [data, setData] = useState<ForecastData | null>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Adjustment form state
  const [adjDate, setAdjDate] = useState("")
  const [adjDesc, setAdjDesc] = useState("")
  const [adjAmount, setAdjAmount] = useState("")
  const [adjSubmitting, setAdjSubmitting] = useState(false)
  const [adjError, setAdjError] = useState<string | null>(null)
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [adjLoaded, setAdjLoaded] = useState(false)

  const periods = mode === "weekly" ? 13 : 12

  // ─── Fetch forecast ─────────────────────────────────────────────────────────

  const fetchForecast = useCallback(
    async (newMode: "weekly" | "monthly", newConsolidated: boolean) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          entityId,
          mode: newMode,
          periods: String(newMode === "weekly" ? 13 : 12),
          consolidated: String(newConsolidated),
        })
        const res = await fetch(`/api/cashflow?${params}`)
        if (!res.ok) throw new Error(await res.text())
        setData(await res.json())
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load forecast")
      } finally {
        setLoading(false)
      }
    },
    [entityId],
  )

  const handleModeChange = (newMode: "weekly" | "monthly") => {
    setMode(newMode)
    fetchForecast(newMode, consolidated)
  }

  const handleConsolidatedChange = (checked: boolean) => {
    setConsolidated(checked)
    fetchForecast(mode, checked)
  }

  // ─── Fetch adjustments ───────────────────────────────────────────────────────

  const fetchAdjustments = useCallback(async () => {
    try {
      const res = await fetch(`/api/cashflow/adjustments?entityId=${entityId}`)
      if (res.ok) {
        setAdjustments(await res.json())
        setAdjLoaded(true)
      }
    } catch {
      // ignore
    }
  }, [entityId])

  // ─── Add adjustment ─────────────────────────────────────────────────────────

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdjError(null)
    if (!adjDate || !adjDesc || !adjAmount) {
      setAdjError("All fields are required")
      return
    }
    const amountCents = Math.round(parseFloat(adjAmount) * 100)
    if (isNaN(amountCents)) {
      setAdjError("Amount must be a valid number")
      return
    }
    setAdjSubmitting(true)
    try {
      const res = await fetch("/api/cashflow/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, date: adjDate, description: adjDesc, amountCents }),
      })
      if (!res.ok) throw new Error(await res.text())
      setAdjDate("")
      setAdjDesc("")
      setAdjAmount("")
      await fetchAdjustments()
      await fetchForecast(mode, consolidated)
    } catch (e: unknown) {
      setAdjError(e instanceof Error ? e.message : "Failed to add adjustment")
    } finally {
      setAdjSubmitting(false)
    }
  }

  // ─── Delete adjustment ───────────────────────────────────────────────────────

  const handleDeleteAdjustment = async (id: string) => {
    try {
      const res = await fetch(`/api/cashflow/adjustments?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
      await fetchAdjustments()
      await fetchForecast(mode, consolidated)
    } catch (e: unknown) {
      // silently log
      console.error("Delete adjustment failed", e)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const currentCash = data?.currentCash ?? 0
  const runwayMonths = data?.runwayMonths ?? null
  const avgMonthlyBurn = data?.avgMonthlyBurn ?? 0
  const forecastPeriods = data?.periods ?? []

  return (
    <div className="space-y-6">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Mode selector */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => handleModeChange("weekly")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === "weekly"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            13 Weeks
          </button>
          <button
            onClick={() => handleModeChange("monthly")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
              mode === "monthly"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            12 Months
          </button>
        </div>

        {/* Consolidated toggle */}
        {isConsolidationParent && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={consolidated}
              onChange={(e) => handleConsolidatedChange(e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            Consolidated view
          </label>
        )}

        {loading && (
          <span className="text-sm text-gray-400 animate-pulse">Loading...</span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Current cash */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Current Cash</p>
          <p className={`text-3xl font-bold font-mono ${currentCash < 0 ? "text-red-600" : "text-gray-900"}`}>
            {fmt(currentCash)}
          </p>
        </div>

        {/* Avg monthly burn */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Avg Monthly Burn</p>
          <p className={`text-3xl font-bold font-mono ${avgMonthlyBurn < 0 ? "text-red-600" : "text-green-700"}`}>
            {avgMonthlyBurn < 0 ? `-${fmtAbs(avgMonthlyBurn)}` : fmt(avgMonthlyBurn)}
          </p>
        </div>

        {/* Runway */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Estimated Runway</p>
          {runwayMonths !== null ? (
            <p className={`text-3xl font-bold ${runwayMonths < 12 ? "text-red-600" : "text-green-700"}`}>
              {runwayMonths} <span className="text-lg font-medium">mo</span>
            </p>
          ) : (
            <p className="text-3xl font-bold text-gray-400">—</p>
          )}
        </div>
      </div>

      {/* Runway alert */}
      {runwayMonths !== null && runwayMonths < 12 && (
        <div
          className={`rounded-xl border p-4 flex items-start gap-3 ${
            runwayMonths < 3
              ? "bg-red-50 border-red-300 text-red-800"
              : "bg-orange-50 border-orange-300 text-orange-800"
          }`}
        >
          <span className="text-lg">⚠️</span>
          <div className="text-sm">
            <p className="font-semibold">
              Estimated runway: {runwayMonths} month{runwayMonths === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5">
              Average monthly burn: {fmtAbs(avgMonthlyBurn)}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      {forecastPeriods.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Projected Balance</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={forecastPeriods} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                interval={mode === "weekly" ? 1 : 0}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 100).toLocaleString("en-US", { notation: "compact" })}`}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                formatter={(value) => [fmt(Number(value)), "Projected Balance"]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 2px 8px rgba(0,0,0,.08)",
                }}
              />
              <Line
                type="monotone"
                dataKey="projectedBalance"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Projection table */}
      {forecastPeriods.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Period Detail</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="py-2.5 px-4 text-left font-semibold">Period</th>
                  <th className="py-2.5 px-4 text-right font-semibold">AR Inflows</th>
                  <th className="py-2.5 px-4 text-right font-semibold">AP Outflows</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Adjustments</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Net</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Projected Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {forecastPeriods.map((p) => (
                  <tr key={p.label} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-gray-800">{p.label}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-green-700">
                      {p.arInflows > 0 ? fmt(p.arInflows) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-red-600">
                      {p.apOutflows > 0 ? fmt(p.apOutflows) : "—"}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-mono ${p.adjustments > 0 ? "text-green-700" : p.adjustments < 0 ? "text-red-600" : "text-gray-400"}`}>
                      {p.adjustments !== 0 ? fmt(p.adjustments) : "—"}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-mono font-semibold ${p.netFlow >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {fmt(p.netFlow)}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-mono font-bold ${p.projectedBalance >= 0 ? "text-gray-900" : "text-red-600"}`}>
                      {fmt(p.projectedBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cash Reserve & Distribution Analysis */}
      <CashReservePanel entityId={entityId} consolidated={consolidated} />

      {/* Add Adjustment */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Add Manual Adjustment</h2>
        <form onSubmit={handleAddAdjustment} className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Date</label>
            <input
              type="date"
              value={adjDate}
              onChange={(e) => setAdjDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-48">
            <label className="text-xs text-gray-500">Description</label>
            <input
              type="text"
              value={adjDesc}
              onChange={(e) => setAdjDesc(e.target.value)}
              placeholder="e.g. Payroll run, Tax payment"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Amount ($)</label>
            <input
              type="number"
              value={adjAmount}
              onChange={(e) => setAdjAmount(e.target.value)}
              placeholder="+ inflow, − outflow"
              step="0.01"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={adjSubmitting}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {adjSubmitting ? "Adding..." : "Add"}
          </button>
          {!adjLoaded && (
            <button
              type="button"
              onClick={fetchAdjustments}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Load adjustments
            </button>
          )}
        </form>
        {adjError && (
          <p className="mt-2 text-xs text-red-600">{adjError}</p>
        )}

        {/* Adjustments list */}
        {adjLoaded && adjustments.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Existing Adjustments</p>
            <div className="space-y-2">
              {adjustments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-xs font-mono">
                      {new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="text-gray-700">{a.description}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono font-medium ${a.amountCents >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {fmt(a.amountCents)}
                    </span>
                    <button
                      onClick={() => handleDeleteAdjustment(a.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors text-xs"
                      aria-label="Delete adjustment"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {adjLoaded && adjustments.length === 0 && (
          <p className="mt-4 text-xs text-gray-400">No adjustments yet.</p>
        )}
      </div>
    </div>
  )
}
