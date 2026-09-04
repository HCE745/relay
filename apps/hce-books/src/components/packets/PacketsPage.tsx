"use client"
import { useState, useCallback } from "react"
import {
  Loader2, Sparkles, Download, Printer, RefreshCw,
  FileText, Calculator, TrendingUp, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react"
import { generateMonthlyPrintHTML, generateTaxPrintHTML, generateInvestorPrintHTML } from "@/lib/packet-print"

// ─── Types ─────────────────────────────────────────────────────────────────────

type PacketType = "monthly" | "tax" | "investor"

type PLLine  = { code: string; name: string; amount: number }
type PLReport = { revenue: PLLine[]; totalRevenue: number; cogs: PLLine[]; totalCogs: number; grossProfit: number; expenses: PLLine[]; totalExpenses: number; netIncome: number }
type BSSection = { code: string; name: string; amount: number }
type BSReport = { assets: BSSection[]; totalAssets: number; liabilities: BSSection[]; totalLiabilities: number; equity: BSSection[]; totalEquity: number; totalLiabilitiesAndEquity: number }
type CashFlowReport = { operatingActivities: { name: string; amount: number }[]; totalOperating: number; totalInvesting: number; totalFinancing: number; netCashChange: number }

type MonthlyPacket = {
  type: "monthly"
  entity: { id: string; name: string }
  period: { year: number; month: number; label: string }
  consolidated: boolean
  generatedAt: string
  pl: PLReport
  plYTD: PLReport
  balanceSheet: BSReport
  cashFlow: CashFlowReport
  budgetVariances: {
    accountCode: string; accountName: string; type: string
    budgetedCents: number; actualCents: number; varianceCents: number; variancePct: number | null
  }[]
  hasBudget: boolean
  budgetName: string | null
  kpis: { grossMarginPct: number | null; netMarginPct: number | null; currentRatio: number | null; cashRunwayMonths: number | null; revGrowthPct: number | null }
  cashPositionCents: number
  priorMonthRevenueCents: number
  anomalies: { id: string; severity: string; reason: string; sourceType: string; ruleType: string }[]
}

type TaxPacket = {
  type: "tax"
  entity: { id: string; name: string }
  fiscalYear: number
  consolidated: boolean
  generatedAt: string
  pl: PLReport
  balanceSheet: BSReport
  trialBalance: { code: string; name: string; type: string; debit: number; credit: number; balance: number }[]
  fixedAssets: { name: string; category: string; acquisitionDate: string; costCents: number; depreciationMethod: string; usefulLifeMonths: number; depreciationYearCents: number; status: string }[]
  totalFixedAssetDeprYear: number
  vendorPayments: { vendorName: string; totalPaidCents: number; note1099: string }[]
  disclaimer: string
}

type InvestorPacket = {
  type: "investor"
  entity: { id: string; name: string }
  consolidated: boolean
  generatedAt: string
  currentYear: number
  ttmPeriod: { start: string; end: string }
  historicalPL: { year: number; isPartialYear: boolean; pl: PLReport }[]
  plTTM: PLReport
  balanceSheet: BSReport
  cashFlow: CashFlowReport
  cashPositionCents: number
  monthlyBurnCents: number
  runwayMonths: number | null
  revenueGrowthPct: number | null
  grossMarginPct: number | null
  netMarginPct: number | null
  ebitdaCents: number
  valuationLow: number
  valuationBase: number
  valuationHigh: number
  valuationNote: string
  disclaimer: string
}

type AnyPacket = MonthlyPacket | TaxPacket | InvestorPacket

// ─── Formatting ────────────────────────────────────────────────────────────────

function fmtC(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}
function fmtPct(n: number | null, d = 1): string {
  if (n == null) return "—"
  return `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3]

// ─── Helper sub-components ────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-xl font-bold font-mono mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function PLSection({ lines, label, total }: { lines: PLLine[]; label: string; total: number }) {
  if (lines.length === 0) return null
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-sm font-semibold text-gray-700 mb-1 hover:text-gray-900 w-full text-left">
        {label}
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <table className="w-full text-xs">
          <tbody>
            {lines.map((l) => (
              <tr key={l.code} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-1 pl-2 text-gray-400 w-16">{l.code}</td>
                <td className="py-1 text-gray-700">{l.name}</td>
                <td className="py-1 pr-2 text-right font-mono">{fmtC(l.amount)}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold text-xs border-t border-gray-200">
              <td colSpan={2} className="py-1.5 pl-2">Total {label}</td>
              <td className="py-1.5 pr-2 text-right font-mono">{fmtC(total)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Packet viewers ───────────────────────────────────────────────────────────

function MonthlyView({ data, narrative }: { data: MonthlyPacket; narrative: string }) {
  return (
    <div className="space-y-5">
      {narrative && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          <h3 className="text-sm font-semibold text-indigo-800 mb-2">Executive Summary</h3>
          <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">{narrative}</p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Key Metrics</h3>
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="Revenue" value={fmtC(data.pl.totalRevenue)} sub={`Gross margin ${fmtPct(data.kpis.grossMarginPct)}`} />
          <KpiCard label="Net Income" value={fmtC(data.pl.netIncome)} sub={fmtPct(data.kpis.netMarginPct) + " margin"} />
          <KpiCard label="Revenue MoM" value={fmtPct(data.kpis.revGrowthPct)} />
          <KpiCard label="Cash Position" value={fmtC(data.cashPositionCents)} />
          <KpiCard label="Cash Runway" value={data.kpis.cashRunwayMonths != null ? `${data.kpis.cashRunwayMonths.toFixed(1)} mo` : "—"} />
          <KpiCard label="Current Ratio" value={data.kpis.currentRatio != null ? data.kpis.currentRatio.toFixed(2) : "—"} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">P&L — {data.period.label}</h3>
          <PLSection lines={data.pl.revenue} label="Revenue" total={data.pl.totalRevenue} />
          <PLSection lines={data.pl.cogs} label="COGS" total={data.pl.totalCogs} />
          <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2">
            <span>Gross Profit</span><span className="font-mono">{fmtC(data.pl.grossProfit)}</span>
          </div>
          <PLSection lines={data.pl.expenses} label="Expenses" total={data.pl.totalExpenses} />
          <div className={`flex justify-between text-sm font-bold border-t-2 border-gray-300 pt-2 ${data.pl.netIncome < 0 ? "text-red-600" : ""}`}>
            <span>Net Income</span><span className="font-mono">{fmtC(data.pl.netIncome)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">YTD Summary</h3>
          <table className="w-full text-xs">
            <tbody>
              {[
                { label: "Revenue", v: data.plYTD.totalRevenue },
                { label: "COGS", v: data.plYTD.totalCogs },
                { label: "Gross Profit", v: data.plYTD.grossProfit, bold: true },
                { label: "Expenses", v: data.plYTD.totalExpenses },
                { label: "Net Income", v: data.plYTD.netIncome, bold: true },
              ].map(({ label, v, bold }) => (
                <tr key={label} className={`border-b border-gray-50 ${bold ? "bg-gray-50 font-semibold" : ""}`}>
                  <td className="py-1.5 pl-2">{label}</td>
                  <td className={`py-1.5 pr-2 text-right font-mono ${v < 0 ? "text-red-600" : ""}`}>{fmtC(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="text-sm font-semibold text-gray-700 pt-2">Cash Flow — {data.period.label}</h3>
          <table className="w-full text-xs">
            <tbody>
              {data.cashFlow.operatingActivities.map((l) => (
                <tr key={l.name} className="border-b border-gray-50">
                  <td className="py-1 pl-2">{l.name}</td>
                  <td className={`py-1 pr-2 text-right font-mono ${l.amount < 0 ? "text-red-600" : ""}`}>{fmtC(l.amount)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                <td className="py-1.5 pl-2">Net Operating Cash</td>
                <td className={`py-1.5 pr-2 text-right font-mono ${data.cashFlow.totalOperating < 0 ? "text-red-600" : ""}`}>{fmtC(data.cashFlow.totalOperating)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {data.hasBudget && data.budgetVariances.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Budget vs Actual {data.budgetName ? `(${data.budgetName})` : ""}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-3 text-left">Code</th>
                  <th className="py-2 px-3 text-left">Account</th>
                  <th className="py-2 px-3 text-right">Budget</th>
                  <th className="py-2 px-3 text-right">Actual</th>
                  <th className="py-2 px-3 text-right">Variance</th>
                  <th className="py-2 px-3 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {data.budgetVariances.slice(0, 15).map((v) => (
                  <tr key={v.accountCode} className="border-b border-gray-50">
                    <td className="py-1.5 px-3 text-gray-400">{v.accountCode}</td>
                    <td className="py-1.5 px-3">{v.accountName}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{fmtC(v.budgetedCents)}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{fmtC(v.actualCents)}</td>
                    <td className={`py-1.5 px-3 text-right font-mono font-semibold ${v.varianceCents < -500 ? "text-red-600" : v.varianceCents > 500 ? "text-green-700" : "text-gray-500"}`}>{fmtC(v.varianceCents)}</td>
                    <td className={`py-1.5 px-3 text-right ${v.variancePct != null && v.variancePct < -5 ? "text-red-600" : "text-gray-500"}`}>{v.variancePct != null ? `${v.variancePct >= 0 ? "+" : ""}${v.variancePct.toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.anomalies.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Anomalies &amp; Flags ({data.period.label})</h3>
          <div className="space-y-1.5">
            {data.anomalies.map((a) => (
              <div key={a.id} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${a.severity === "HIGH" ? "bg-red-50 text-red-800" : a.severity === "MEDIUM" ? "bg-amber-50 text-amber-800" : "bg-gray-50 text-gray-600"}`}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span><strong>{a.severity}</strong> — {a.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Balance Sheet — {data.period.label} End</h3>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="font-semibold text-gray-500 uppercase text-xs mb-1">Assets</p>
            {data.balanceSheet.assets.map((a) => <div key={a.code} className="flex justify-between py-0.5"><span className="text-gray-500">{a.name}</span><span className="font-mono">{fmtC(a.amount)}</span></div>)}
            <div className="flex justify-between py-1 font-bold border-t border-gray-200 mt-1"><span>Total</span><span className="font-mono">{fmtC(data.balanceSheet.totalAssets)}</span></div>
          </div>
          <div>
            <p className="font-semibold text-gray-500 uppercase text-xs mb-1">Liabilities</p>
            {data.balanceSheet.liabilities.map((l) => <div key={l.code} className="flex justify-between py-0.5"><span className="text-gray-500">{l.name}</span><span className="font-mono">{fmtC(l.amount)}</span></div>)}
            <div className="flex justify-between py-1 font-bold border-t border-gray-200 mt-1"><span>Total</span><span className="font-mono">{fmtC(data.balanceSheet.totalLiabilities)}</span></div>
          </div>
          <div>
            <p className="font-semibold text-gray-500 uppercase text-xs mb-1">Equity</p>
            {data.balanceSheet.equity.map((e) => <div key={e.code} className="flex justify-between py-0.5"><span className="text-gray-500">{e.name}</span><span className="font-mono">{fmtC(e.amount)}</span></div>)}
            <div className="flex justify-between py-1 font-bold border-t border-gray-200 mt-1"><span>Total</span><span className="font-mono">{fmtC(data.balanceSheet.totalEquity)}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TaxView({ data, narrative }: { data: TaxPacket; narrative: string }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><p>{data.disclaimer}</p>
      </div>

      {narrative && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          <h3 className="text-sm font-semibold text-indigo-800 mb-2">Summary Memo</h3>
          <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">{narrative}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Full-Year P&L — FY{data.fiscalYear}</h3>
          <PLSection lines={data.pl.revenue} label="Revenue" total={data.pl.totalRevenue} />
          <PLSection lines={data.pl.cogs} label="COGS" total={data.pl.totalCogs} />
          <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2">
            <span>Gross Profit</span><span className="font-mono">{fmtC(data.pl.grossProfit)}</span>
          </div>
          <PLSection lines={data.pl.expenses} label="Expenses" total={data.pl.totalExpenses} />
          <div className={`flex justify-between text-sm font-bold border-t-2 border-gray-300 pt-2 ${data.pl.netIncome < 0 ? "text-red-600" : ""}`}>
            <span>Net Income</span><span className="font-mono">{fmtC(data.pl.netIncome)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Balance Sheet — 12/31/{data.fiscalYear}</h3>
          {[
            { label: "Total Assets", v: data.balanceSheet.totalAssets },
            { label: "Total Liabilities", v: data.balanceSheet.totalLiabilities },
            { label: "Total Equity", v: data.balanceSheet.totalEquity },
          ].map(({ label, v }) => (
            <div key={label} className="flex justify-between text-sm border-b border-gray-100 pb-1.5">
              <span className="text-gray-600">{label}</span><span className="font-mono font-semibold">{fmtC(v)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Trial Balance — FY{data.fiscalYear}</h3>
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="py-1.5 px-2 text-left">Code</th>
                <th className="py-1.5 px-2 text-left">Account</th>
                <th className="py-1.5 px-2 text-left">Type</th>
                <th className="py-1.5 px-2 text-right">Debits</th>
                <th className="py-1.5 px-2 text-right">Credits</th>
                <th className="py-1.5 px-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.trialBalance.map((r) => (
                <tr key={r.code} className="border-b border-gray-50">
                  <td className="py-1 px-2 text-gray-400">{r.code}</td>
                  <td className="py-1 px-2">{r.name}</td>
                  <td className="py-1 px-2 text-gray-400">{r.type}</td>
                  <td className="py-1 px-2 text-right font-mono">{fmtC(r.debit)}</td>
                  <td className="py-1 px-2 text-right font-mono">{fmtC(r.credit)}</td>
                  <td className={`py-1 px-2 text-right font-mono font-semibold ${r.balance < 0 ? "text-red-600" : ""}`}>{fmtC(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Fixed Asset Register &amp; Depreciation — FY{data.fiscalYear}</h3>
        <p className="text-xs text-gray-400 mb-2">Total depreciation posted: <strong>{fmtC(data.totalFixedAssetDeprYear)}</strong> · Section 179 / bonus depreciation elections deferred to tax professional</p>
        {data.fixedAssets.length === 0 ? (
          <p className="text-sm text-gray-400">No fixed assets on record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-1.5 px-2 text-left">Asset</th>
                  <th className="py-1.5 px-2 text-left">Category</th>
                  <th className="py-1.5 px-2 text-left">In Service</th>
                  <th className="py-1.5 px-2 text-right">Cost</th>
                  <th className="py-1.5 px-2 text-left">Method</th>
                  <th className="py-1.5 px-2 text-right">Life</th>
                  <th className="py-1.5 px-2 text-right">Depr FY{data.fiscalYear}</th>
                </tr>
              </thead>
              <tbody>
                {data.fixedAssets.map((f, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1 px-2 font-medium">{f.name}</td>
                    <td className="py-1 px-2 text-gray-500">{f.category}</td>
                    <td className="py-1 px-2 text-gray-500">{f.acquisitionDate}</td>
                    <td className="py-1 px-2 text-right font-mono">{fmtC(f.costCents)}</td>
                    <td className="py-1 px-2 text-gray-500">{f.depreciationMethod}</td>
                    <td className="py-1 px-2 text-right">{f.usefulLifeMonths}mo</td>
                    <td className="py-1 px-2 text-right font-mono font-semibold">{fmtC(f.depreciationYearCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Vendor Payments &amp; 1099 Summary</h3>
        <p className="text-xs text-gray-400 mb-2">Review 1099-NEC requirement for vendors paid ≥$600 for services (non-corporations). Verify W-9 / tax classification.</p>
        {data.vendorPayments.length === 0 ? (
          <p className="text-sm text-gray-400">No vendor payments on record.</p>
        ) : (
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="py-1.5 px-2 text-left">Vendor</th>
                  <th className="py-1.5 px-2 text-right">Total Paid FY{data.fiscalYear}</th>
                  <th className="py-1.5 px-2 text-left">1099 Note</th>
                </tr>
              </thead>
              <tbody>
                {data.vendorPayments.map((v, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1 px-2 font-medium">{v.vendorName}</td>
                    <td className="py-1 px-2 text-right font-mono">{fmtC(v.totalPaidCents)}</td>
                    <td className="py-1 px-2">
                      {v.note1099 && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">{v.note1099}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function InvestorView({ data, narrative }: { data: InvestorPacket; narrative: string }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><p>{data.disclaimer}</p>
      </div>

      {narrative && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
          <h3 className="text-sm font-semibold text-indigo-800 mb-2">Executive Overview</h3>
          <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">{narrative}</p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Financial Highlights (TTM)</h3>
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="Revenue" value={fmtC(data.plTTM.totalRevenue)} sub={`Gross margin ${fmtPct(data.grossMarginPct)}`} />
          <KpiCard label="Net Income" value={fmtC(data.plTTM.netIncome)} sub={fmtPct(data.netMarginPct) + " margin"} />
          <KpiCard label="Revenue Growth" value={fmtPct(data.revenueGrowthPct)} />
          <KpiCard label="Cash" value={fmtC(data.cashPositionCents)} />
          <KpiCard label="Monthly Burn" value={fmtC(data.monthlyBurnCents)} />
          <KpiCard label="Runway" value={data.runwayMonths != null ? `${data.runwayMonths.toFixed(1)} mo` : "—"} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Historical Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-3 text-left">Year</th>
                <th className="py-2 px-3 text-right">Revenue</th>
                <th className="py-2 px-3 text-right">Gross Profit</th>
                <th className="py-2 px-3 text-right">Net Income</th>
                <th className="py-2 px-3 text-right">Net Margin</th>
              </tr>
            </thead>
            <tbody>
              {data.historicalPL.map((h) => (
                <tr key={h.year} className="border-b border-gray-50">
                  <td className="py-2 px-3 font-medium">{h.year}{h.isPartialYear ? "*" : ""}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmtC(h.pl.totalRevenue)}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmtC(h.pl.grossProfit)}</td>
                  <td className={`py-2 px-3 text-right font-mono ${h.pl.netIncome < 0 ? "text-red-600" : ""}`}>{fmtC(h.pl.netIncome)}</td>
                  <td className="py-2 px-3 text-right">{h.pl.totalRevenue > 0 ? fmtPct((h.pl.netIncome / h.pl.totalRevenue) * 100) : "—"}</td>
                </tr>
              ))}
              <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                <td className="py-2 px-3">TTM</td>
                <td className="py-2 px-3 text-right font-mono">{fmtC(data.plTTM.totalRevenue)}</td>
                <td className="py-2 px-3 text-right font-mono">{fmtC(data.plTTM.grossProfit)}</td>
                <td className={`py-2 px-3 text-right font-mono ${data.plTTM.netIncome < 0 ? "text-red-600" : ""}`}>{fmtC(data.plTTM.netIncome)}</td>
                <td className="py-2 px-3 text-right">{data.plTTM.totalRevenue > 0 ? fmtPct((data.plTTM.netIncome / data.plTTM.totalRevenue) * 100) : "—"}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-1">* Partial year (through current date)</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Indicative Valuation Range</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-center">
            <p className="text-xs font-semibold text-red-500 uppercase">Low</p>
            <p className="text-2xl font-bold font-mono text-red-700 mt-1">{fmtC(data.valuationLow)}</p>
          </div>
          <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4 text-center">
            <p className="text-xs font-semibold text-blue-500 uppercase">Base</p>
            <p className="text-2xl font-bold font-mono text-blue-700 mt-1">{fmtC(data.valuationBase)}</p>
          </div>
          <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4 text-center">
            <p className="text-xs font-semibold text-green-500 uppercase">High</p>
            <p className="text-2xl font-bold font-mono text-green-700 mt-1">{fmtC(data.valuationHigh)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">{data.valuationNote}</p>
      </div>
    </div>
  )
}

// ─── CSV generators ───────────────────────────────────────────────────────────

function toCSV(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
}

function monthlyCSV(data: MonthlyPacket): string {
  const rows: (string | number)[][] = [
    ["Monthly Financial Report", data.entity.name, data.period.label],
    [],
    ["P&L", "Amount"],
    ["Revenue", data.pl.totalRevenue / 100],
    ["COGS", data.pl.totalCogs / 100],
    ["Gross Profit", data.pl.grossProfit / 100],
    ["Expenses", data.pl.totalExpenses / 100],
    ["Net Income", data.pl.netIncome / 100],
    [],
    ["YTD", "Amount"],
    ["YTD Revenue", data.plYTD.totalRevenue / 100],
    ["YTD Net Income", data.plYTD.netIncome / 100],
    [],
    ["Cash Position", data.cashPositionCents / 100],
    ["Gross Margin %", data.kpis.grossMarginPct?.toFixed(2) ?? ""],
    ["Net Margin %", data.kpis.netMarginPct?.toFixed(2) ?? ""],
    ["Current Ratio", data.kpis.currentRatio?.toFixed(2) ?? ""],
    ["Cash Runway (months)", data.kpis.cashRunwayMonths?.toFixed(1) ?? ""],
  ]
  if (data.budgetVariances.length > 0) {
    rows.push([], ["Budget vs Actual"])
    rows.push(["Code", "Account", "Budget", "Actual", "Variance $", "Variance %"])
    data.budgetVariances.forEach((v) => rows.push([v.accountCode, v.accountName, v.budgetedCents / 100, v.actualCents / 100, v.varianceCents / 100, v.variancePct ?? ""]))
  }
  return toCSV(rows)
}

function taxCSV(data: TaxPacket): string {
  const rows: (string | number)[][] = [
    ["Tax Packet", data.entity.name, `FY${data.fiscalYear}`],
    ["DISCLAIMER", data.disclaimer],
    [],
    ["P&L"],
    ["Revenue", data.pl.totalRevenue / 100],
    ["COGS", data.pl.totalCogs / 100],
    ["Gross Profit", data.pl.grossProfit / 100],
    ["Expenses", data.pl.totalExpenses / 100],
    ["Net Income", data.pl.netIncome / 100],
    [],
    ["Trial Balance"],
    ["Code", "Account", "Type", "Debits", "Credits", "Balance"],
    ...data.trialBalance.map((r) => [r.code, r.name, r.type, r.debit / 100, r.credit / 100, r.balance / 100]),
    [],
    ["Fixed Assets"],
    ["Name", "Category", "In Service", "Cost", "Method", "Life (mo)", `Depr FY${data.fiscalYear}`],
    ...data.fixedAssets.map((f) => [f.name, f.category, f.acquisitionDate, f.costCents / 100, f.depreciationMethod, f.usefulLifeMonths, f.depreciationYearCents / 100]),
    [],
    ["Vendor Payments"],
    ["Vendor", "Total Paid", "1099 Note"],
    ...data.vendorPayments.map((v) => [v.vendorName, v.totalPaidCents / 100, v.note1099]),
  ]
  return toCSV(rows)
}

function investorCSV(data: InvestorPacket): string {
  const rows: (string | number)[][] = [
    ["Investor / Lender Packet", data.entity.name],
    ["DISCLAIMER", data.disclaimer],
    [],
    ["Historical Performance"],
    ["Year", "Revenue", "Gross Profit", "Net Income"],
    ...data.historicalPL.map((h) => [h.year, h.pl.totalRevenue / 100, h.pl.grossProfit / 100, h.pl.netIncome / 100]),
    ["TTM", data.plTTM.totalRevenue / 100, data.plTTM.grossProfit / 100, data.plTTM.netIncome / 100],
    [],
    ["Key Metrics"],
    ["Gross Margin %", data.grossMarginPct?.toFixed(2) ?? ""],
    ["Net Margin %", data.netMarginPct?.toFixed(2) ?? ""],
    ["Revenue Growth %", data.revenueGrowthPct?.toFixed(2) ?? ""],
    ["Cash", data.cashPositionCents / 100],
    ["Monthly Burn", data.monthlyBurnCents / 100],
    ["Runway (months)", data.runwayMonths?.toFixed(1) ?? ""],
    [],
    ["Indicative Valuation"],
    ["Low", data.valuationLow / 100],
    ["Base", data.valuationBase / 100],
    ["High", data.valuationHigh / 100],
    ["Note", data.valuationNote],
  ]
  return toCSV(rows)
}

function downloadCSV(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click()
}

function openPrint(html: string) {
  const win = window.open("", "_blank")
  if (!win) { alert("Pop-up blocked. Allow pop-ups for this site."); return }
  win.document.write(html)
  win.document.close()
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PacketsPage({ entityId, isConsolidationParent }: { entityId: string; isConsolidationParent: boolean }) {
  // Form state
  const [type, setType] = useState<PacketType>("monthly")
  const [consolidated, setConsolidated] = useState(false)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [fiscalYear, setFiscalYear] = useState(CURRENT_YEAR)

  // Packet state
  const [packet, setPacket] = useState<AnyPacket | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Narrative state
  const [narrative, setNarrative] = useState("")
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [narrativeError, setNarrativeError] = useState("")

  const assemble = useCallback(async () => {
    setLoading(true); setError(""); setNarrative("")
    try {
      const body: Record<string, unknown> = { type, entityId, consolidated }
      if (type === "monthly")  { body.year = year; body.month = month }
      if (type === "tax")      { body.fiscalYear = fiscalYear }
      const res = await fetch("/api/packets/assemble", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPacket(json as AnyPacket)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [type, entityId, consolidated, year, month, fiscalYear])

  async function generateNarrative() {
    if (!packet) return
    setNarrativeLoading(true); setNarrativeError("")
    try {
      const res = await fetch("/api/packets/narrative", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: packet.type, packetData: packet }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setNarrative(json.narrative)
    } catch (e) { setNarrativeError((e as Error).message) }
    finally { setNarrativeLoading(false) }
  }

  function handlePrint() {
    if (!packet) return
    const d = packet as unknown as Record<string, unknown>
    if (packet.type === "monthly")  openPrint(generateMonthlyPrintHTML(d, narrative))
    if (packet.type === "tax")      openPrint(generateTaxPrintHTML(d, narrative))
    if (packet.type === "investor") openPrint(generateInvestorPrintHTML(d, narrative))
  }

  function handleCSV() {
    if (!packet) return
    const name = packet.entity.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()
    if (packet.type === "monthly") downloadCSV(monthlyCSV(packet), `monthly-${name}-${year}-${String(month).padStart(2, "0")}.csv`)
    if (packet.type === "tax")     downloadCSV(taxCSV(packet), `tax-packet-${name}-fy${packet.fiscalYear}.csv`)
    if (packet.type === "investor") downloadCSV(investorCSV(packet), `investor-packet-${name}.csv`)
  }

  const PACKET_TYPES: { key: PacketType; label: string; icon: typeof FileText; desc: string }[] = [
    { key: "monthly", label: "Monthly Report", icon: FileText, desc: "P&L, Balance Sheet, Cash Flow, Budget vs Actual, KPIs" },
    { key: "tax",     label: "CPA Tax Packet", icon: Calculator, desc: "Full-year financials, trial balance, fixed assets, 1099 vendor summary" },
    { key: "investor", label: "Investor / Lender", icon: TrendingUp, desc: "Historical performance, ratios, runway, indicative valuation" },
  ]

  return (
    <div className="space-y-6">
      {/* Packet type selector */}
      <div className="grid grid-cols-3 gap-3">
        {PACKET_TYPES.map(({ key, label, icon: Icon, desc }) => (
          <button key={key} onClick={() => { setType(key); setPacket(null); setNarrative("") }}
            className={`p-4 rounded-xl border-2 text-left transition-all ${type === key ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${type === key ? "text-blue-600" : "text-gray-400"}`} />
              <span className={`text-sm font-semibold ${type === key ? "text-blue-800" : "text-gray-700"}`}>{label}</span>
            </div>
            <p className="text-xs text-gray-500">{desc}</p>
          </button>
        ))}
      </div>

      {/* Parameters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          {type === "monthly" && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Year</label>
                <select value={year} onChange={(e) => setYear(+e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Month</label>
                <select value={month} onChange={(e) => setMonth(+e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </>
          )}
          {type === "tax" && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fiscal Year</label>
              <select value={fiscalYear} onChange={(e) => setFiscalYear(+e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          {type === "investor" && (
            <p className="text-sm text-gray-500">Uses last 3 years + TTM data automatically.</p>
          )}
          {isConsolidationParent && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={consolidated} onChange={(e) => setConsolidated(e.target.checked)} className="rounded border-gray-300 text-blue-600" />
              Consolidated
            </label>
          )}
          <button onClick={assemble} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {packet ? "Regenerate" : "Generate Packet"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>

      {/* Packet preview */}
      {packet && (
        <div className="bg-white rounded-xl border border-gray-200">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                {packet.type === "monthly" && `Monthly Report — ${(packet as MonthlyPacket).period.label}`}
                {packet.type === "tax" && `CPA Tax Packet — FY${(packet as TaxPacket).fiscalYear}`}
                {packet.type === "investor" && "Investor / Lender Packet"}
                {packet.consolidated ? " (Consolidated)" : ""}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {packet.entity.name} · Generated {new Date(packet.generatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {narrativeError && <p className="text-xs text-red-500">{narrativeError}</p>}
              <button onClick={generateNarrative} disabled={narrativeLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {narrativeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {narrative ? "Regen AI Summary" : "AI Executive Summary"}
              </button>
              <button onClick={handleCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <Printer className="w-3.5 h-3.5" /> Print / PDF
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            {packet.type === "monthly" && <MonthlyView data={packet as MonthlyPacket} narrative={narrative} />}
            {packet.type === "tax"     && <TaxView data={packet as TaxPacket} narrative={narrative} />}
            {packet.type === "investor" && <InvestorView data={packet as InvestorPacket} narrative={narrative} />}
          </div>
        </div>
      )}
    </div>
  )
}
