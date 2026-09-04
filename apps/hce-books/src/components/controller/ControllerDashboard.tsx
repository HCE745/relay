"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { AlertTriangle, RefreshCw, Sparkles, TrendingDown, TrendingUp, Loader2 } from "lucide-react"
import { CornerFlourish } from "@/components/heritage/CornerFlourish"
import { RadialTexture } from "@/components/heritage/RadialTexture"

// ─── Types ────────────────────────────────────────────────────────────────────

type Alert = {
  type: string
  title: string
  message: string
  severity: "HIGH" | "MEDIUM" | "LOW"
  linkHref?: string
}

type BudgetVariance = {
  accountId: string
  accountName: string
  accountCode: string
  accountType: string
  budgeted: number
  actual: number
  variance: number
  variancePct: number | null
}

type Anomaly = {
  id: string
  reason: string
  severity: string
  sourceType: string
  createdAt: string
}

type DashboardData = {
  entityId: string
  entityName: string
  isConsolidationParent: boolean
  asOf: string
  currentCashCents: number
  revenueMTDCents: number
  revenueYTDCents: number
  expensesMTDCents: number
  expensesYTDCents: number
  profitMTDCents: number
  profitYTDCents: number
  runwayMonths: number | null
  avgMonthlyExpensesCents: number
  reserveMonths: number
  recommendedReserveCents: number
  surplusOrShortfallCents: number
  apDue30Cents: number
  apDue60Cents: number
  apDue90Cents: number
  distributableCents: number
  budgetSnapshot: {
    budgetId: string
    budgetName: string
    currentPeriod: number
    totalBudgeted: number
    totalActual: number
    topVariances: BudgetVariance[]
  } | null
  anomalies: Anomaly[]
  alerts: Alert[]
}

type Props = {
  entityId: string
  isConsolidationParent: boolean
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  return (Math.abs(cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 })
}
function fmtFull(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}
function pct(a: number, b: number): string {
  if (b === 0) return "—"
  return ((a / Math.abs(b)) * 100).toFixed(1) + "%"
}

const SEVERITY_BADGE: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 border-red-200",
  MEDIUM: "bg-orange-100 text-orange-700 border-orange-200",
  LOW: "bg-blue-100 text-blue-700 border-blue-200",
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({ label, mtd, ytd, inverted, link }: {
  label: string; mtd: number; ytd: number; inverted?: boolean; link: string
}) {
  const mtdPositive = inverted ? mtd <= 0 : mtd >= 0
  return (
    <Link href={link} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 transition-colors block relative heritage-kpi-frame">
      <CornerFlourish corner="tl" />
      <CornerFlourish corner="tr" />
      <CornerFlourish corner="br" />
      <CornerFlourish corner="bl" />
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold font-mono mt-1 ${mtdPositive ? "text-gray-900" : "text-red-600"}`}>
        {mtd < 0 ? `(${fmt(Math.abs(mtd))})` : fmt(mtd)}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">YTD: {mtd < 0 ? `(${fmt(Math.abs(ytd))})` : fmt(ytd)}</p>
    </Link>
  )
}

function AlertItem({ alert }: { alert: Alert }) {
  const badge = SEVERITY_BADGE[alert.severity] ?? "bg-gray-100 text-gray-600"
  const content = (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${alert.severity === "HIGH" ? "border-red-100 bg-red-50" : "border-orange-100 bg-orange-50"}`}>
      <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${alert.severity === "HIGH" ? "text-red-500" : "text-orange-500"}`} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-gray-900">{alert.title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${badge}`}>{alert.severity}</span>
        </div>
        <p className="text-xs text-gray-600">{alert.message}</p>
      </div>
    </div>
  )
  return alert.linkHref ? <Link href={alert.linkHref}>{content}</Link> : content
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ControllerDashboard({ entityId, isConsolidationParent }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [consolidated, setConsolidated] = useState(false)
  const [reserveMonths] = useState(3)
  const [budgetOpen, setBudgetOpen] = useState(true)

  const [briefing, setBriefing] = useState("")
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingError, setBriefingError] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams({
        entityId,
        consolidated: String(consolidated),
        reserveMonths: String(reserveMonths),
      })
      const res = await fetch(`/api/controller/dashboard?${params}`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [entityId, consolidated, reserveMonths])

  useEffect(() => { fetchData() }, [fetchData])

  async function generateBriefing() {
    setBriefingLoading(true); setBriefingError(""); setBriefing("")
    try {
      const res = await fetch("/api/controller/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, consolidated, reserveMonths }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed")
      setBriefing(json.briefing)
    } catch (e) {
      setBriefingError((e as Error).message)
    } finally {
      setBriefingLoading(false)
    }
  }

  const alerts = data?.alerts ?? []
  const anomalies = data?.anomalies ?? []
  const totalAlerts = alerts.length + anomalies.length

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-xs text-gray-400">
          {data ? `As of ${new Date(data.asOf).toLocaleTimeString()}` : "Loading…"}
        </div>
        {isConsolidationParent && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={consolidated} onChange={(e) => setConsolidated(e.target.checked)}
              className="rounded border-gray-300 text-blue-600" />
            Consolidated
          </label>
        )}
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

      {/* Heritage-only section banner */}
      <div className="heritage-section-banner">Financial Position</div>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Cash — hero card with radial texture background */}
        <Link href="/cashflow" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 transition-colors col-span-1 relative heritage-kpi-frame">
          <CornerFlourish corner="tl" />
          <CornerFlourish corner="tr" />
          <CornerFlourish corner="br" />
          <CornerFlourish corner="bl" />
          <RadialTexture />
          <div style={{ position: "relative", zIndex: 1 }}>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Current Cash</p>
            <p className={`text-xl font-bold font-mono mt-1 ${(data?.currentCashCents ?? 0) >= 0 ? "text-gray-900" : "text-red-600"}`}>
              {data ? fmt(data.currentCashCents) : "—"}
            </p>
            {data?.runwayMonths !== undefined && data.runwayMonths !== null && (
              <p className={`text-xs mt-0.5 ${data.runwayMonths < 6 ? "text-red-500" : "text-gray-400"}`}>
                {data.runwayMonths}mo runway
              </p>
            )}
          </div>
        </Link>

        {/* Revenue */}
        <KPICard label="Revenue" mtd={data?.revenueMTDCents ?? 0} ytd={data?.revenueYTDCents ?? 0} link="/reports" />

        {/* Expenses */}
        <KPICard label="Expenses" mtd={data?.expensesMTDCents ?? 0} ytd={data?.expensesYTDCents ?? 0} inverted link="/reports" />

        {/* Profit MTD */}
        <Link href="/reports" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 transition-colors block relative heritage-kpi-frame">
          <CornerFlourish corner="tl" />
          <CornerFlourish corner="tr" />
          <CornerFlourish corner="br" />
          <CornerFlourish corner="bl" />
          <p className="text-xs text-gray-400 uppercase tracking-wide">Net Profit MTD</p>
          <p className={`text-xl font-bold font-mono mt-1 ${(data?.profitMTDCents ?? 0) >= 0 ? "text-green-700" : "text-red-600"}`}>
            {data ? (data.profitMTDCents < 0 ? `(${fmt(Math.abs(data.profitMTDCents))})` : fmt(data.profitMTDCents)) : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            YTD: {data ? (data.profitYTDCents < 0 ? `(${fmt(Math.abs(data.profitYTDCents))})` : fmt(data.profitYTDCents)) : "—"}
          </p>
        </Link>

        {/* Reserve status */}
        <div className={`rounded-xl border p-4 col-span-1 relative heritage-kpi-frame ${(data?.surplusOrShortfallCents ?? 0) >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <CornerFlourish corner="tl" />
          <CornerFlourish corner="tr" />
          <CornerFlourish corner="br" />
          <CornerFlourish corner="bl" />
          <p className="text-xs text-gray-500 uppercase tracking-wide">Reserve Status</p>
          <div className="flex items-center gap-1 mt-1">
            {(data?.surplusOrShortfallCents ?? 0) >= 0
              ? <TrendingUp className="w-4 h-4 text-green-600" />
              : <TrendingDown className="w-4 h-4 text-red-600" />}
            <p className={`text-xl font-bold font-mono ${(data?.surplusOrShortfallCents ?? 0) >= 0 ? "text-green-700" : "text-red-700"}`}>
              {data ? (data.surplusOrShortfallCents >= 0 ? "+" : "−") + fmt(Math.abs(data.surplusOrShortfallCents)) : "—"}
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{reserveMonths}-mo reserve: {data ? fmt(data.recommendedReserveCents) : "—"}</p>
        </div>

        {/* Distributable */}
        <Link href="/cashflow" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 transition-colors block relative heritage-kpi-frame">
          <CornerFlourish corner="tl" />
          <CornerFlourish corner="tr" />
          <CornerFlourish corner="br" />
          <CornerFlourish corner="bl" />
          <p className="text-xs text-gray-400 uppercase tracking-wide">Distributable</p>
          <p className={`text-xl font-bold font-mono mt-1 ${(data?.distributableCents ?? 0) >= 0 ? "text-blue-700" : "text-red-600"}`}>
            {data ? (data.distributableCents < 0 ? `(${fmt(Math.abs(data.distributableCents))})` : fmt(data.distributableCents)) : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">After reserve + 30d AP</p>
        </Link>
      </div>

      {/* Heritage-only section banner */}
      <div className="heritage-section-banner">Analysis</div>

      {/* Alerts + Budget side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Alerts & Anomalies
              {totalAlerts > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">{totalAlerts}</span>
              )}
            </h2>
            <Link href="/anomalies" className="text-xs text-blue-600 hover:underline">All anomalies →</Link>
          </div>
          <div className="p-4 space-y-2">
            {loading && <p className="text-sm text-gray-400">Loading…</p>}
            {!loading && alerts.length === 0 && anomalies.length === 0 && (
              <p className="text-sm text-green-600 font-medium py-2">No active alerts.</p>
            )}
            {alerts.map((a) => <AlertItem key={a.type} alert={a} />)}
            {anomalies.slice(0, 3).map((a) => (
              <Link key={a.id} href="/anomalies">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-100 bg-yellow-50">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-yellow-500" />
                  <div>
                    <span className="text-xs font-medium text-yellow-800 capitalize">{a.sourceType.toLowerCase()}</span>
                    <p className="text-xs text-gray-700 mt-0.5">{a.reason}</p>
                  </div>
                </div>
              </Link>
            ))}
            {anomalies.length > 3 && (
              <Link href="/anomalies" className="block text-xs text-blue-600 hover:underline pt-1">
                +{anomalies.length - 3} more anomalies →
              </Link>
            )}
          </div>
        </div>

        {/* Budget snapshot */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <button onClick={() => setBudgetOpen((s) => !s)}
              className="text-sm font-semibold text-gray-700 flex items-center gap-1">
              Budget vs Actual
              <span className="ml-1 text-gray-400 text-xs">{budgetOpen ? "▲" : "▼"}</span>
            </button>
            <Link href="/budgets" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {budgetOpen && (
            <div className="p-4">
              {!data?.budgetSnapshot && !loading && (
                <p className="text-sm text-gray-400 py-2">
                  No budget for {new Date().getFullYear()}.{" "}
                  <Link href="/budgets/new" className="text-blue-600 hover:underline">Create one →</Link>
                </p>
              )}
              {data?.budgetSnapshot && (() => {
                const snap = data.budgetSnapshot!
                const totalVariance = snap.totalActual - snap.totalBudgeted
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{snap.budgetName} — Period {snap.currentPeriod}</span>
                      <span>Total var: <span className={totalVariance >= 0 ? "text-green-700 font-medium" : "text-red-600 font-medium"}>{totalVariance >= 0 ? "+" : ""}{fmtFull(totalVariance)}</span></span>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 uppercase">
                          <th className="text-left pb-1.5">Account</th>
                          <th className="text-right pb-1.5">Budget</th>
                          <th className="text-right pb-1.5">Actual</th>
                          <th className="text-right pb-1.5">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {snap.topVariances.map((v) => (
                          <tr key={v.accountId}>
                            <td className="py-1.5 text-gray-700">{v.accountName}</td>
                            <td className="py-1.5 text-right font-mono text-gray-500">{fmtFull(v.budgeted)}</td>
                            <td className="py-1.5 text-right font-mono text-gray-800">{fmtFull(v.actual)}</td>
                            <td className={`py-1.5 text-right font-mono font-semibold ${v.variance < 0 && v.accountType === "EXPENSE" ? "text-red-600" : v.variance > 0 ? "text-green-700" : "text-gray-500"}`}>
                              {v.variance >= 0 ? "+" : ""}{fmtFull(v.variance)}
                              {v.variancePct !== null && <span className="text-gray-400 font-normal ml-1">({v.variancePct.toFixed(0)}%)</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Link href={`/budgets/${snap.budgetId}`} className="text-xs text-blue-600 hover:underline">Full variance report →</Link>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Heritage-only section banner */}
      <div className="heritage-section-banner">Obligations</div>

      {/* AP Horizon summary */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">AP Obligations by Horizon</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Due in 30 days", cents: data.apDue30Cents },
              { label: "Due 31–60 days", cents: data.apDue60Cents },
              { label: "Due 61–90 days", cents: data.apDue90Cents },
            ].map(({ label, cents }) => (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-lg font-bold font-mono mt-0.5 ${cents > 0 ? "text-gray-900" : "text-gray-300"}`}>
                  {cents > 0 ? fmtFull(cents) : "—"}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Total 90-day AP: {fmtFull(data.apDue30Cents + data.apDue60Cents + data.apDue90Cents)}
          </p>
        </div>
      )}

      {/* Heritage-only section banner */}
      <div className="heritage-section-banner">Intelligence</div>

      {/* Daily Briefing */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            Daily Financial Briefing
          </h2>
          <button onClick={generateBriefing} disabled={briefingLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
            {briefingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {briefing ? "Regenerate" : "Generate Briefing"}
          </button>
        </div>

        {briefingError && <p className="text-sm text-red-600 mb-3">{briefingError}</p>}

        {!briefing && !briefingLoading && (
          <p className="text-sm text-gray-400">
            Click "Generate Briefing" to get an AI-written narrative summarizing today&apos;s financial position.
            The AI narrates the numbers we computed above — it does not invent or estimate figures.
          </p>
        )}

        {briefingLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 animate-pulse py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating briefing from computed numbers…
          </div>
        )}

        {briefing && (
          <div className="prose prose-sm max-w-none">
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{briefing}</div>
          </div>
        )}
      </div>
    </div>
  )
}
