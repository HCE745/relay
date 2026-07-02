"use client"
import { useState } from "react"
import { Loader2, Copy, Check, Download, AlertCircle } from "lucide-react"

type Entity = { id: string; name: string; isConsolidationParent: boolean }

type ChecklistItem = {
  label: string
  status: "PASS" | "FAIL" | "WARN"
  detail: string
}

type CloseNumbers = {
  revenue: number
  cogs: number
  grossProfit: number
  expenses: number
  netIncome: number
  priorRevenue: number
  priorExpenses: number
  priorNetIncome: number
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  cashCents: number
  arCount: number
  arTotalCents: number
  apCount: number
  apTotalCents: number
}

type CloseReport = {
  month: string
  entity: string
  checklist: ChecklistItem[]
  numbers: CloseNumbers
  briefing: string
}

interface Props {
  entityId: string
  entities: Entity[]
}

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function statusBadge(status: "PASS" | "FAIL" | "WARN") {
  const classes = {
    PASS: "bg-green-100 text-green-700",
    FAIL: "bg-red-100 text-red-700",
    WARN: "bg-orange-100 text-orange-700",
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${classes[status]}`}>
      {status}
    </span>
  )
}

// Build list of year/month options: current month back 24 months
function buildMonthOptions() {
  const options: { label: string; year: number; month: number }[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    options.push({ label, year, month })
  }
  return options
}

export function CloseDashboard({ entityId: defaultEntityId, entities }: Props) {
  const monthOptions = buildMonthOptions()
  // Default to prior month (index 1)
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(1)
  const [selectedEntityId, setSelectedEntityId] = useState(defaultEntityId)
  const [consolidated, setConsolidated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<CloseReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const selectedMonth = monthOptions[selectedMonthIdx]
  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? entities[0]
  const isConsolidationParent = selectedEntity?.isConsolidationParent ?? false

  async function generate() {
    if (loading) return
    setLoading(true)
    setError(null)
    setReport(null)

    const params = new URLSearchParams({
      year: String(selectedMonth.year),
      month: String(selectedMonth.month),
      entityId: selectedEntityId,
      consolidated: String(consolidated),
    })

    try {
      const res = await fetch(`/api/close?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "An error occurred. Please try again.")
      } else {
        setReport(json as CloseReport)
      }
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  async function copyBriefing() {
    if (!report?.briefing) return
    await navigator.clipboard.writeText(report.briefing)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function exportReport() {
    if (!report) return
    const lines: string[] = [
      `Month-End Close Report: ${report.month}`,
      `Entity: ${report.entity}`,
      "",
      "=== CLOSE CHECKLIST ===",
      ...report.checklist.map((c) => `[${c.status}] ${c.label}: ${c.detail}`),
      "",
      "=== KEY NUMBERS ===",
      `Revenue: ${fmt(report.numbers.revenue)}`,
      `Expenses: ${fmt(report.numbers.expenses)}`,
      `Net Income: ${fmt(report.numbers.netIncome)}`,
      `Cash: ${fmt(report.numbers.cashCents)}`,
      "",
      "=== EXECUTIVE BRIEFING ===",
      report.briefing,
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `close-report-${report.month.replace(/\s+/g, "-").toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Month-End Close</h1>
        <p className="text-sm text-gray-500 mt-1">
          Run the close checklist and generate an AI executive briefing for any month.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Month picker */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
            <select
              value={selectedMonthIdx}
              onChange={(e) => setSelectedMonthIdx(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthOptions.map((opt, i) => (
                <option key={i} value={i}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Entity selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entity</label>
            <select
              value={selectedEntityId}
              onChange={(e) => {
                setSelectedEntityId(e.target.value)
                setConsolidated(false)
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.isConsolidationParent ? " (parent)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Consolidated toggle (only if entity is consolidation parent) */}
          <div className="flex items-end">
            {isConsolidationParent ? (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consolidated}
                  onChange={(e) => setConsolidated(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Consolidated view</span>
              </label>
            ) : (
              <div />
            )}
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating report…
            </span>
          ) : (
            "Generate Close Report"
          )}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span>Running checklist, gathering numbers, and generating AI briefing…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Could not generate report</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {report && !loading && (
        <div className="space-y-6">
          {/* Header banner */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{report.month} — {report.entity}</h2>
            </div>
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          {/* Key Numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Revenue", value: fmt(report.numbers.revenue), color: "text-green-700" },
              { label: "Expenses", value: fmt(report.numbers.expenses), color: "text-red-600" },
              { label: "Net Income", value: fmt(report.numbers.netIncome), color: report.numbers.netIncome >= 0 ? "text-green-700" : "text-red-600" },
              { label: "Cash", value: fmt(report.numbers.cashCents), color: "text-blue-700" },
            ].map((item) => (
              <div key={item.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{item.label}</div>
                <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Checklist */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Close Checklist</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Status</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {report.checklist.map((item) => (
                    <tr key={item.label}>
                      <td className="font-medium">{item.label}</td>
                      <td>{statusBadge(item.status)}</td>
                      <td className="text-gray-600">{item.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Executive Briefing */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide">
                Executive Briefing
              </h3>
              <button
                onClick={copyBriefing}
                className="flex-shrink-0 p-1.5 text-blue-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-100"
                aria-label="Copy briefing"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm">
              {report.briefing}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
