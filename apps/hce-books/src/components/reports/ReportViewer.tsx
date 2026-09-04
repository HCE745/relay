"use client"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Download } from "lucide-react"
import { Suspense } from "react"

type PLData = {
  revenue: { code: string; name: string; amount: number }[]
  totalRevenue: number
  cogs: { code: string; name: string; amount: number }[]
  totalCogs: number
  grossProfit: number
  expenses: { code: string; name: string; amount: number }[]
  totalExpenses: number
  netIncome: number
}

type BSData = {
  assets: { code: string; name: string; amount: number }[]
  totalAssets: number
  liabilities: { code: string; name: string; amount: number }[]
  totalLiabilities: number
  equity: { code: string; name: string; amount: number }[]
  totalEquity: number
  totalLiabilitiesAndEquity: number
}

type TBLine = { code: string; name: string; type: string; debit: number; credit: number; balance: number }
type AgingLine = {
  customerId?: string; customerName?: string
  vendorId?: string; vendorName?: string
  current: number; days30: number; days60: number; days90: number; over90: number; total: number
}

type ReportData = {
  type: string
  data: PLData | BSData | TBLine[] | AgingLine[] | unknown
  period: { start: string; end: string }
  entity: string
  consolidated: boolean
}

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function Row({ label, amount, bold, indent }: { label: string; amount: number; bold?: boolean; indent?: boolean }) {
  return (
    <tr className={bold ? "font-semibold bg-gray-50" : ""}>
      <td className={`py-1.5 text-sm ${indent ? "pl-8" : "pl-4"} pr-4`}>{label}</td>
      <td className={`py-1.5 text-sm text-right pr-4 font-mono ${amount < 0 ? "text-red-600" : ""}`}>{fmt(amount)}</td>
    </tr>
  )
}

function PLReport({ data }: { data: PLData }) {
  return (
    <table className="w-full">
      <tbody>
        <tr><td colSpan={2} className="py-2 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Revenue</td></tr>
        {data.revenue.map((l) => <Row key={l.code} label={l.name} amount={l.amount} indent />)}
        <Row label="Total Revenue" amount={data.totalRevenue} bold />
        <tr><td colSpan={2} className="py-2 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Cost of Goods Sold</td></tr>
        {data.cogs.map((l) => <Row key={l.code} label={l.name} amount={l.amount} indent />)}
        <Row label="Total COGS" amount={data.totalCogs} bold />
        <Row label="Gross Profit" amount={data.grossProfit} bold />
        <tr><td colSpan={2} className="py-2 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Operating Expenses</td></tr>
        {data.expenses.map((l) => <Row key={l.code} label={l.name} amount={l.amount} indent />)}
        <Row label="Total Expenses" amount={data.totalExpenses} bold />
        <tr className="border-t-2 border-gray-900">
          <td className="py-2 pl-4 font-bold text-sm">Net Income</td>
          <td className={`py-2 pr-4 text-right font-bold font-mono text-sm ${data.netIncome < 0 ? "text-red-600" : "text-green-700"}`}>{fmt(data.netIncome)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function BSReport({ data }: { data: BSData }) {
  return (
    <table className="w-full">
      <tbody>
        <tr><td colSpan={2} className="py-2 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Assets</td></tr>
        {data.assets.map((l) => <Row key={l.code} label={l.name} amount={l.amount} indent />)}
        <Row label="Total Assets" amount={data.totalAssets} bold />
        <tr><td colSpan={2} className="py-3" /></tr>
        <tr><td colSpan={2} className="py-2 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Liabilities</td></tr>
        {data.liabilities.map((l) => <Row key={l.code} label={l.name} amount={l.amount} indent />)}
        <Row label="Total Liabilities" amount={data.totalLiabilities} bold />
        <tr><td colSpan={2} className="py-2 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Equity</td></tr>
        {data.equity.map((l) => <Row key={l.code} label={l.name} amount={l.amount} indent />)}
        <Row label="Total Equity" amount={data.totalEquity} bold />
        <tr className="border-t-2 border-gray-900">
          <td className="py-2 pl-4 font-bold text-sm">Total Liabilities + Equity</td>
          <td className="py-2 pr-4 text-right font-bold font-mono text-sm">{fmt(data.totalLiabilitiesAndEquity)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function TBReport({ data }: { data: TBLine[] }) {
  const totalDebit = data.reduce((s, l) => s + l.debit, 0)
  const totalCredit = data.reduce((s, l) => s + l.credit, 0)
  return (
    <table className="data-table w-full">
      <thead>
        <tr><th>Code</th><th>Account</th><th>Type</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr>
      </thead>
      <tbody>
        {data.map((l) => (
          <tr key={l.code}>
            <td className="font-mono text-gray-500">{l.code}</td>
            <td>{l.name}</td>
            <td className="text-xs text-gray-400">{l.type}</td>
            <td className="text-right font-mono">{l.debit > 0 ? fmt(l.debit) : "—"}</td>
            <td className="text-right font-mono">{l.credit > 0 ? fmt(l.credit) : "—"}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-gray-900 font-bold bg-gray-50">
          <td colSpan={3} className="py-2 pl-4 text-sm">Totals</td>
          <td className="text-right font-mono pr-4 text-sm">{fmt(totalDebit)}</td>
          <td className="text-right font-mono pr-4 text-sm">{fmt(totalCredit)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function AgingReport({ data, type }: { data: AgingLine[]; type: "ar" | "ap" }) {
  const totals = data.reduce(
    (s, r) => ({
      current: s.current + r.current, days30: s.days30 + r.days30,
      days60: s.days60 + r.days60, days90: s.days90 + r.days90,
      over90: s.over90 + r.over90, total: s.total + r.total,
    }),
    { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 },
  )
  return (
    <table className="data-table w-full">
      <thead>
        <tr>
          <th>{type === "ar" ? "Customer" : "Vendor"}</th>
          <th className="text-right">Current</th>
          <th className="text-right">1-30 days</th>
          <th className="text-right">31-60 days</th>
          <th className="text-right">61-90 days</th>
          <th className="text-right">&gt;90 days</th>
          <th className="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r, i) => (
          <tr key={i}>
            <td>{r.customerName ?? r.vendorName}</td>
            <td className="text-right font-mono">{r.current > 0 ? fmt(r.current) : "—"}</td>
            <td className="text-right font-mono">{r.days30 > 0 ? fmt(r.days30) : "—"}</td>
            <td className="text-right font-mono">{r.days60 > 0 ? fmt(r.days60) : "—"}</td>
            <td className="text-right font-mono">{r.days90 > 0 ? fmt(r.days90) : "—"}</td>
            <td className="text-right font-mono">{r.over90 > 0 ? fmt(r.over90) : "—"}</td>
            <td className="text-right font-mono font-semibold">{fmt(r.total)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-gray-900 font-bold bg-gray-50">
          <td className="py-2 pl-4">Totals</td>
          <td className="text-right font-mono pr-4">{fmt(totals.current)}</td>
          <td className="text-right font-mono pr-4">{fmt(totals.days30)}</td>
          <td className="text-right font-mono pr-4">{fmt(totals.days60)}</td>
          <td className="text-right font-mono pr-4">{fmt(totals.days90)}</td>
          <td className="text-right font-mono pr-4">{fmt(totals.over90)}</td>
          <td className="text-right font-mono pr-4">{fmt(totals.total)}</td>
        </tr>
      </tbody>
    </table>
  )
}

const REPORTS = [
  { id: "pl", label: "Profit & Loss" },
  { id: "bs", label: "Balance Sheet" },
  { id: "tb", label: "Trial Balance" },
  { id: "ar_aging", label: "A/R Aging" },
  { id: "ap_aging", label: "A/P Aging" },
]

export function ReportViewer({
  reportData,
  isConsolidationParent,
  selectedReport,
}: {
  reportData: ReportData | null
  isConsolidationParent: boolean
  selectedReport: string
}) {
  const title = REPORTS.find((r) => r.id === selectedReport)?.label ?? "Report"

  return (
    <div className="p-6 max-w-7xl space-y-4">
      <div className="page-header">
        <h1 className="page-title heritage-engraved">Reports</h1>
        {reportData && (
          <button
            onClick={() => {
              const data = Array.isArray(reportData.data)
                ? (reportData.data as Record<string, unknown>[])
                : [reportData.data as Record<string, unknown>]
              const csv = data.map((row) => Object.fromEntries(
                Object.entries(row).map(([k, v]) => [k, typeof v === "number" ? (v / 100).toFixed(2) : String(v ?? "")])
              ))
              const text = [Object.keys(csv[0]).join(","), ...csv.map((r) => Object.values(r).join(","))].join("\n")
              const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }))
              const a = document.createElement("a")
              a.href = url; a.download = `${selectedReport}.csv`; a.click()
            }}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {/* Report type nav */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200">
        {REPORTS.map((r) => (
          <Link
            key={r.id}
            href={`/reports?report=${r.id}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              selectedReport === r.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {/* Consolidated toggle for parent entities */}
      {isConsolidationParent && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">View:</span>
          <Link href={`/reports?report=${selectedReport}`} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!reportData?.consolidated ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            Standalone
          </Link>
          <Link href={`/reports?report=${selectedReport}&consolidated=true`} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${reportData?.consolidated ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            Consolidated
          </Link>
        </div>
      )}

      {/* Report body */}
      {reportData && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="heritage-section-banner mb-3">{title}</div>
            <h2 className="text-base font-semibold text-gray-900 heritage-engraved">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {reportData.entity}
              {reportData.consolidated ? " (Consolidated)" : ""}
              {" · "}{reportData.period.start} – {reportData.period.end}
            </p>
          </div>
          <div className="overflow-x-auto">
            {reportData.type === "pl" && <PLReport data={reportData.data as PLData} />}
            {reportData.type === "bs" && <BSReport data={reportData.data as BSData} />}
            {reportData.type === "tb" && <TBReport data={reportData.data as TBLine[]} />}
            {reportData.type === "ar_aging" && <AgingReport data={reportData.data as AgingLine[]} type="ar" />}
            {reportData.type === "ap_aging" && <AgingReport data={reportData.data as AgingLine[]} type="ap" />}
          </div>
        </div>
      )}
    </div>
  )
}
