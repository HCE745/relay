"use client"
import { useState } from "react"
import { Loader2, AlertCircle, Download, ChevronDown, ChevronUp } from "lucide-react"

type Entity = { id: string; name: string; isConsolidationParent: boolean }

type KPIData = {
  asOf: string
  period: string
  entity: string
  liquidity: { currentRatio: number | null; quickRatio: number | null; workingCapitalCents: number }
  efficiency: { dso: number; dpo: number; cashConversionCycle: number | null }
  profitability: { grossMarginPct: number | null; operatingMarginPct: number | null; netMarginPct: number | null }
  cash: { cashCents: number; monthlyBurnCents: number | null; runwayMonths: number | null }
  leverage: { debtToEquity: number | null }
  trend: { months: string[]; netMarginPct: (number | null)[]; currentRatio: (number | null)[]; grossMarginPct: (number | null)[] }
  sources: Record<string, Record<string, string>>
}

type Props = { entityId: string; entities: Entity[] }

function buildMonthOptions() {
  const opts: { label: string; year: number; month: number }[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    opts.push({
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    })
  }
  return opts
}

function fmtDollar(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}
function fmtRatio(v: number | null): string {
  return v == null ? "—" : v.toFixed(2)
}
function fmtPct(v: number | null): string {
  return v == null ? "—" : v.toFixed(1) + "%"
}
function fmtDays(v: number): string {
  return v === 0 ? "—" : v.toFixed(1) + " days"
}

// Simple inline SVG sparkline
function Sparkline({ values, color = "#3b82f6" }: { values: (number | null)[]; color?: string }) {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length < 2) return <span className="text-xs text-gray-400">no data</span>
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const range = max - min || 1
  const w = 80, h = 24
  const pts = values
    .map((v, i) => {
      if (v === null) return null
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .filter(Boolean)
    .join(" ")

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrendArrow({ values }: { values: (number | null)[] }) {
  const last = values.filter((v): v is number => v !== null)
  if (last.length < 2) return null
  const diff = last[last.length - 1] - last[last.length - 2]
  if (Math.abs(diff) < 0.01) return null
  return diff > 0
    ? <span className="text-green-600 text-xs font-medium">↑ {Math.abs(diff).toFixed(1)}</span>
    : <span className="text-red-500 text-xs font-medium">↓ {Math.abs(diff).toFixed(1)}</span>
}

type KPITileProps = {
  label: string
  value: string
  trendValues?: (number | null)[]
  color?: string
  sub?: string
}
function KPITile({ label, value, trendValues, sub }: KPITileProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
      {trendValues && (
        <div className="flex items-center gap-2 mt-1">
          <Sparkline values={trendValues} />
          <TrendArrow values={trendValues} />
        </div>
      )}
    </div>
  )
}

export function KPIDashboard({ entityId: defaultEntityId, entities }: Props) {
  const monthOptions = buildMonthOptions()
  const [monthIdx, setMonthIdx] = useState(0)
  const [selectedEntityId, setSelectedEntityId] = useState(defaultEntityId)
  const [consolidated, setConsolidated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<KPIData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSources, setShowSources] = useState(false)

  const selectedMonth = monthOptions[monthIdx]
  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? entities[0]

  async function calculate() {
    setLoading(true); setError(null); setData(null)
    const params = new URLSearchParams({
      entityId: selectedEntityId,
      year: String(selectedMonth.year),
      month: String(selectedMonth.month),
      consolidated: String(consolidated),
    })
    try {
      const res = await fetch(`/api/kpis?${params}`)
      const json = await res.json()
      if (!res.ok) setError(json.error ?? "Error")
      else setData(json as KPIData)
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  function exportCsv() {
    if (!data) return
    const rows = [
      ["Period", data.period],
      ["Entity", data.entity],
      [],
      ["KPI", "Value"],
      ["Current Ratio", fmtRatio(data.liquidity.currentRatio)],
      ["Quick Ratio", fmtRatio(data.liquidity.quickRatio)],
      ["Working Capital", fmtDollar(data.liquidity.workingCapitalCents)],
      ["DSO (days)", fmtDays(data.efficiency.dso)],
      ["DPO (days)", fmtDays(data.efficiency.dpo)],
      ["Cash Conversion Cycle", fmtDays(data.efficiency.cashConversionCycle ?? 0)],
      ["Gross Margin %", fmtPct(data.profitability.grossMarginPct)],
      ["Operating Margin %", fmtPct(data.profitability.operatingMarginPct)],
      ["Net Margin %", fmtPct(data.profitability.netMarginPct)],
      ["Cash Position", fmtDollar(data.cash.cashCents)],
      ["Monthly Burn", data.cash.monthlyBurnCents ? fmtDollar(data.cash.monthlyBurnCents) : "—"],
      ["Runway (months)", data.cash.runwayMonths?.toFixed(1) ?? "—"],
      ["Debt-to-Equity", fmtRatio(data.leverage.debtToEquity)],
    ]
    const csv = rows.map((r) => r.map((v) => (String(v).includes(",") ? `"${v}"` : v)).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `kpis-${data.period.replace(/\s/g, "-")}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">KPI Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Financial ratios and metrics derived from the ledger.</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
            <select value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {monthOptions.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entity</label>
            <select value={selectedEntityId} onChange={(e) => { setSelectedEntityId(e.target.value); setConsolidated(false) }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {entities.map((e) => <option key={e.id} value={e.id}>{e.name}{e.isConsolidationParent ? " (parent)" : ""}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-3">
            {selectedEntity?.isConsolidationParent && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={consolidated} onChange={(e) => setConsolidated(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                <span className="text-sm text-gray-700">Consolidated</span>
              </label>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={calculate} disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Calculating…</span> : "Calculate KPIs"}
          </button>
          {data && (
            <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500">As of {new Date(data.asOf).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} — {data.entity}</p>

          {/* Liquidity */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Liquidity</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KPITile label="Current Ratio" value={fmtRatio(data.liquidity.currentRatio)}
                trendValues={data.trend.currentRatio} sub="Current assets ÷ current liabilities" />
              <KPITile label="Quick Ratio" value={fmtRatio(data.liquidity.quickRatio)}
                sub="(Current assets − inventory) ÷ current liabilities" />
              <KPITile label="Working Capital" value={fmtDollar(data.liquidity.workingCapitalCents)}
                sub="Current assets − current liabilities" />
            </div>
          </section>

          {/* Profitability */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Profitability</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KPITile label="Gross Margin" value={fmtPct(data.profitability.grossMarginPct)}
                trendValues={data.trend.grossMarginPct} sub="Gross profit ÷ revenue" />
              <KPITile label="Operating Margin" value={fmtPct(data.profitability.operatingMarginPct)}
                sub="Operating income ÷ revenue" />
              <KPITile label="Net Margin" value={fmtPct(data.profitability.netMarginPct)}
                trendValues={data.trend.netMarginPct} sub="Net income ÷ revenue" />
            </div>
          </section>

          {/* Efficiency */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Efficiency</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KPITile label="DSO" value={fmtDays(data.efficiency.dso)} sub="Days Sales Outstanding" />
              <KPITile label="DPO" value={fmtDays(data.efficiency.dpo)} sub="Days Payable Outstanding" />
              <KPITile label="Cash Conversion" value={fmtDays(data.efficiency.cashConversionCycle ?? 0)} sub="DSO − DPO" />
            </div>
          </section>

          {/* Cash */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Cash</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KPITile label="Cash Position" value={fmtDollar(data.cash.cashCents)} sub="Cash account balances" />
              <KPITile label="Monthly Burn" value={data.cash.monthlyBurnCents ? fmtDollar(data.cash.monthlyBurnCents) : "—"} sub="Avg net cash outflow (3 months)" />
              <KPITile label="Runway" value={data.cash.runwayMonths != null ? data.cash.runwayMonths.toFixed(1) + " mo" : "—"} sub="Cash ÷ monthly burn" />
            </div>
          </section>

          {/* Leverage */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Leverage</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KPITile label="Debt-to-Equity" value={fmtRatio(data.leverage.debtToEquity)} sub="Total liabilities ÷ equity" />
            </div>
          </section>

          {/* Audit sources */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl">
            <button onClick={() => setShowSources((s) => !s)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700">
              <span>Ratio Sources (Auditable)</span>
              {showSources ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showSources && (
              <div className="px-4 pb-4 space-y-2 text-xs text-gray-600">
                {Object.entries(data.sources).map(([key, src]) => (
                  <div key={key} className="border-t border-gray-200 pt-2">
                    <span className="font-semibold capitalize">{key.replace(/([A-Z])/g, " $1")}: </span>
                    {Object.entries(src).map(([k, v]) => (
                      <span key={k} className="mr-3"><span className="text-gray-400">{k}:</span> {v}</span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
