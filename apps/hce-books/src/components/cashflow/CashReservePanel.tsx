"use client"
import { useState, useEffect, useCallback } from "react"
import { Info } from "lucide-react"

type ReserveData = {
  currentCashCents: number
  avgMonthlyExpensesCents: number
  reserveMonths: number
  recommendedReserveCents: number
  surplusOrShortfallCents: number
  apDue30Cents: number
  apDue60Cents: number
  apDue90Cents: number
  distributable: { horizon30: number; horizon60: number; horizon90: number }
  breakdown30: { label: string; amountCents: number; total?: boolean }[]
}

type Props = {
  entityId: string
  consolidated: boolean
}

function fmt(cents: number): string {
  return (Math.abs(cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export function CashReservePanel({ entityId, consolidated }: Props) {
  const [data, setData] = useState<ReserveData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [reserveMonths, setReserveMonths] = useState(3)
  const [horizon, setHorizon] = useState<30 | 60 | 90>(30)
  const [showDetails, setShowDetails] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams({
        entityId,
        reserveMonths: String(reserveMonths),
        consolidated: String(consolidated),
      })
      const res = await fetch(`/api/cashflow/reserve?${params}`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [entityId, reserveMonths, consolidated])

  useEffect(() => { fetchData() }, [fetchData])

  const distributable = data
    ? (horizon === 30 ? data.distributable.horizon30 : horizon === 60 ? data.distributable.horizon60 : data.distributable.horizon90)
    : null

  const apForHorizon = data
    ? (horizon === 30 ? data.apDue30Cents : horizon === 60 ? data.apDue30Cents + data.apDue60Cents : data.apDue30Cents + data.apDue60Cents + data.apDue90Cents)
    : 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Cash Reserve & Distribution Analysis</h2>
        {loading && <span className="text-xs text-gray-400 animate-pulse">Loading…</span>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Reserve months:</label>
          <input
            type="range" min={1} max={12} value={reserveMonths}
            onChange={(e) => setReserveMonths(Number(e.target.value))}
            className="w-28 accent-blue-600"
          />
          <span className="text-sm font-semibold text-blue-700 w-6">{reserveMonths}</span>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {([30, 60, 90] as const).map((h) => (
            <button key={h} onClick={() => setHorizon(h)}
              className={`px-3 py-1.5 font-medium transition-colors ${horizon === h ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
              {h}d
            </button>
          ))}
        </div>
      </div>

      {data && (
        <>
          {/* 30/60/90-day AP summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "AP due 0–30d", value: data.apDue30Cents, urgent: data.apDue30Cents > 500000 },
              { label: "AP due 31–60d", value: data.apDue60Cents, urgent: false },
              { label: "AP due 61–90d", value: data.apDue90Cents, urgent: false },
            ].map(({ label, value, urgent }) => (
              <div key={label} className={`rounded-lg border px-3 py-2.5 ${urgent ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-gray-50"}`}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-sm font-mono font-semibold mt-0.5 ${value > 0 ? (urgent ? "text-orange-700" : "text-gray-800") : "text-gray-400"}`}>
                  {value > 0 ? fmt(value) : "—"}
                </p>
              </div>
            ))}
          </div>

          {/* Reserve status */}
          <div className={`rounded-xl border px-5 py-4 ${data.surplusOrShortfallCents >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {data.surplusOrShortfallCents >= 0 ? "Cash surplus above reserve" : "Cash shortfall vs reserve"}
                </p>
                <p className={`text-2xl font-bold font-mono mt-1 ${data.surplusOrShortfallCents >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {data.surplusOrShortfallCents >= 0 ? "+" : "−"}{fmt(Math.abs(data.surplusOrShortfallCents))}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Current cash {fmt(data.currentCashCents)} vs {reserveMonths}-month reserve {fmt(data.recommendedReserveCents)}
                  {" "}(avg monthly expenses: {fmt(data.avgMonthlyExpensesCents)})
                </p>
              </div>
            </div>
          </div>

          {/* Distributable */}
          <div className={`rounded-xl border px-5 py-4 ${distributable !== null && distributable >= 0 ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Safe to distribute ({horizon}-day horizon)
                </p>
                <p className={`text-2xl font-bold font-mono mt-1 ${distributable !== null && distributable >= 0 ? "text-blue-700" : "text-red-700"}`}>
                  {distributable !== null ? (distributable >= 0 ? fmt(distributable) : `(${fmt(Math.abs(distributable))})`) : "—"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Cash {fmt(data.currentCashCents)} − reserve {fmt(data.recommendedReserveCents)} − AP next {horizon}d {fmt(apForHorizon)}
                </p>
              </div>
              <button onClick={() => setShowDetails((s) => !s)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors mt-1">
                <Info className="w-3.5 h-3.5" />
                {showDetails ? "Hide" : "Show"} math
              </button>
            </div>
          </div>

          {/* Math breakdown */}
          {showDetails && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Distribution Calculation (30-day horizon)</p>
              {data.breakdown30.map((row, i) => (
                <div key={i} className={`flex items-center justify-between text-sm ${row.total ? "border-t border-gray-300 pt-2 font-bold" : ""}`}>
                  <span className={row.total ? "text-gray-900" : "text-gray-600"}>{row.label}</span>
                  <span className={`font-mono ${row.amountCents < 0 ? "text-red-600" : row.total ? "text-blue-700" : "text-gray-800"}`}>
                    {row.amountCents < 0 ? `(${fmt(Math.abs(row.amountCents))})` : fmt(row.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
