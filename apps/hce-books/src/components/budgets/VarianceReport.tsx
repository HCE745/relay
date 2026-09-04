"use client"
import { useState, useEffect } from "react"
import { Download } from "lucide-react"

type PeriodRow = {
  period: number
  label: string
  budgeted: number
  actual: number
  variance: number
  variancePct: number | null
}

type AccountRow = {
  accountId: string
  accountCode: string
  accountName: string
  accountType: string
  periods: PeriodRow[]
  totalBudgeted: number
  totalActual: number
  totalVariance: number
  totalVariancePct: number | null
}

type VarianceData = {
  budget: { id: string; name: string; fiscalYear: number; periodType: string }
  periodLabels: string[]
  fromPeriod: number
  toPeriod: number
  rows: AccountRow[]
}

type Props = {
  budgetId: string
  totalPeriods: number
  isConsolidationParent: boolean
}

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function fmtPct(pct: number | null) {
  if (pct == null) return "—"
  return pct.toFixed(1) + "%"
}

export function VarianceReport({ budgetId, totalPeriods, isConsolidationParent }: Props) {
  const [data, setData] = useState<VarianceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fromPeriod, setFromPeriod] = useState(1)
  const [toPeriod, setToPeriod] = useState(totalPeriods)
  const [consolidated, setConsolidated] = useState(false)

  function buildUrl(format?: string) {
    const params = new URLSearchParams({
      fromPeriod: String(fromPeriod),
      toPeriod: String(toPeriod),
    })
    if (consolidated) params.set("consolidated", "true")
    if (format) params.set("format", format)
    return `/api/budgets/${budgetId}/variance?${params}`
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(buildUrl())
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load variance data")
        return r.json()
      })
      .then((d: VarianceData) => {
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetId, fromPeriod, toPeriod, consolidated])

  function handleExportCsv() {
    window.open(buildUrl("csv"), "_blank")
  }

  const incomeRows = data?.rows.filter((r) => r.accountType === "INCOME") ?? []
  const expenseRows = data?.rows.filter((r) => r.accountType === "EXPENSE") ?? []

  const totalIncomeBudgeted = incomeRows.reduce((s, r) => s + r.totalBudgeted, 0)
  const totalIncomeActual = incomeRows.reduce((s, r) => s + r.totalActual, 0)
  const totalIncomeVariance = incomeRows.reduce((s, r) => s + r.totalVariance, 0)

  const totalExpenseBudgeted = expenseRows.reduce((s, r) => s + r.totalBudgeted, 0)
  const totalExpenseActual = expenseRows.reduce((s, r) => s + r.totalActual, 0)
  const totalExpenseVariance = expenseRows.reduce((s, r) => s + r.totalVariance, 0)

  const netBudgeted = totalIncomeBudgeted - totalExpenseBudgeted
  const netActual = totalIncomeActual - totalExpenseActual
  const netVariance = netActual - netBudgeted

  const periodOptions = Array.from({ length: totalPeriods }, (_, i) => i + 1)

  const inputClass =
    "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 bg-white rounded-xl border border-gray-200 p-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From Period</label>
          <select
            className={inputClass}
            value={fromPeriod}
            onChange={(e) => setFromPeriod(Number(e.target.value))}
          >
            {periodOptions.map((p) => (
              <option key={p} value={p}>
                Period {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To Period</label>
          <select
            className={inputClass}
            value={toPeriod}
            onChange={(e) => setToPeriod(Number(e.target.value))}
          >
            {periodOptions.map((p) => (
              <option key={p} value={p}>
                Period {p}
              </option>
            ))}
          </select>
        </div>
        {isConsolidationParent && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={consolidated}
              onChange={(e) => setConsolidated(e.target.checked)}
              className="rounded"
            />
            Consolidated
          </label>
        )}
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 ml-auto"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {loading && (
        <div className="py-12 text-center text-gray-400 text-sm">Loading variance data...</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {data && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[260px]">
                  Account
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 min-w-[130px]">Budgeted</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 min-w-[130px]">Actual</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 min-w-[130px]">Variance $</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 min-w-[100px]">Variance %</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700 min-w-[100px]">Favorable?</th>
              </tr>
            </thead>
            <tbody>
              {/* Income */}
              {incomeRows.length > 0 && (
                <>
                  <tr className="bg-blue-50">
                    <td
                      colSpan={6}
                      className="px-4 py-2 text-xs font-semibold text-blue-700 uppercase tracking-wider"
                    >
                      Income
                    </td>
                  </tr>
                  {incomeRows.map((row) => (
                    <VarianceRow key={row.accountId} row={row} type="INCOME" />
                  ))}
                  <SubtotalRow
                    label="Total Income"
                    budgeted={totalIncomeBudgeted}
                    actual={totalIncomeActual}
                    variance={totalIncomeVariance}
                    type="INCOME"
                  />
                </>
              )}

              {/* Expenses */}
              {expenseRows.length > 0 && (
                <>
                  <tr className="bg-orange-50">
                    <td
                      colSpan={6}
                      className="px-4 py-2 text-xs font-semibold text-orange-700 uppercase tracking-wider"
                    >
                      Expenses
                    </td>
                  </tr>
                  {expenseRows.map((row) => (
                    <VarianceRow key={row.accountId} row={row} type="EXPENSE" />
                  ))}
                  <SubtotalRow
                    label="Total Expenses"
                    budgeted={totalExpenseBudgeted}
                    actual={totalExpenseActual}
                    variance={totalExpenseVariance}
                    type="EXPENSE"
                  />
                </>
              )}

              {/* Net */}
              <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                <td className="px-4 py-3 text-gray-900">Net Income</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(netBudgeted)}</td>
                <td className="px-4 py-3 text-right font-mono">{fmt(netActual)}</td>
                <td className={`px-4 py-3 text-right font-mono ${netVariance >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmt(netVariance)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">
                  {fmtPct(netBudgeted !== 0 ? (netVariance / Math.abs(netBudgeted)) * 100 : null)}
                </td>
                <td className="px-4 py-3 text-center">
                  <FavorableBadge favorable={netVariance >= 0} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function VarianceRow({ row, type }: { row: AccountRow; type: "INCOME" | "EXPENSE" }) {
  // Favorable: for income, actual > budgeted; for expense, actual < budgeted
  const favorable = type === "INCOME" ? row.totalVariance >= 0 : row.totalVariance <= 0

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-2 sticky left-0 bg-white hover:bg-gray-50">
        <span className="font-mono text-xs text-gray-400 mr-2">{row.accountCode}</span>
        <span className="text-gray-800">{row.accountName}</span>
      </td>
      <td className="px-4 py-2 text-right font-mono text-gray-700">{fmt(row.totalBudgeted)}</td>
      <td className="px-4 py-2 text-right font-mono text-gray-700">{fmt(row.totalActual)}</td>
      <td className={`px-4 py-2 text-right font-mono ${row.totalVariance === 0 ? "text-gray-500" : favorable ? "text-green-700" : "text-red-600"}`}>
        {fmt(row.totalVariance)}
      </td>
      <td className="px-4 py-2 text-right font-mono text-gray-600">{fmtPct(row.totalVariancePct)}</td>
      <td className="px-4 py-2 text-center">
        {row.totalBudgeted !== 0 || row.totalActual !== 0 ? <FavorableBadge favorable={favorable} /> : null}
      </td>
    </tr>
  )
}

function SubtotalRow({
  label,
  budgeted,
  actual,
  variance,
  type,
}: {
  label: string
  budgeted: number
  actual: number
  variance: number
  type: "INCOME" | "EXPENSE"
}) {
  const favorable = type === "INCOME" ? variance >= 0 : variance <= 0
  const pct = budgeted !== 0 ? (variance / Math.abs(budgeted)) * 100 : null

  return (
    <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
      <td className="px-4 py-2 text-gray-800">{label}</td>
      <td className="px-4 py-2 text-right font-mono">{fmt(budgeted)}</td>
      <td className="px-4 py-2 text-right font-mono">{fmt(actual)}</td>
      <td className={`px-4 py-2 text-right font-mono ${variance === 0 ? "text-gray-500" : favorable ? "text-green-700" : "text-red-600"}`}>
        {fmt(variance)}
      </td>
      <td className="px-4 py-2 text-right font-mono text-gray-600">{fmtPct(pct)}</td>
      <td className="px-4 py-2 text-center">
        {(budgeted !== 0 || actual !== 0) ? <FavorableBadge favorable={favorable} /> : null}
      </td>
    </tr>
  )
}

function FavorableBadge({ favorable }: { favorable: boolean }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
        favorable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
      }`}
    >
      {favorable ? "Favorable" : "Unfavorable"}
    </span>
  )
}
