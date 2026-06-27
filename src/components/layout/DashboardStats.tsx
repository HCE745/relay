"use client"
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, Clock } from "lucide-react"

function fmt(cents: number) {
  const sign = cents < 0 ? "-" : ""
  return sign + "$" + Math.abs(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
}

type Stat = { label: string; value: string; sub?: string; color?: string; icon: React.ReactNode }
type Entry = { id: string; date: string; memo: string; source: string; firstAccount: string; amount: number }

type Props = {
  entityName: string
  cashBalance: number
  arBalance: number
  apBalance: number
  netIncome: number
  totalRevenue: number
  totalExpenses: number
  overdueInvoices: number
  unpaidBills: number
  recentEntries: Entry[]
}

export function DashboardStats(props: Props) {
  const stats: Stat[] = [
    {
      label: "Cash Balance",
      value: fmt(props.cashBalance),
      icon: <DollarSign className="w-5 h-5 text-green-600" />,
      color: "green",
    },
    {
      label: "Accounts Receivable",
      value: fmt(props.arBalance),
      sub: props.overdueInvoices > 0 ? `${props.overdueInvoices} overdue` : undefined,
      icon: <TrendingUp className="w-5 h-5 text-blue-600" />,
      color: "blue",
    },
    {
      label: "Accounts Payable",
      value: fmt(props.apBalance),
      sub: props.unpaidBills > 0 ? `${props.unpaidBills} unpaid` : undefined,
      icon: <TrendingDown className="w-5 h-5 text-orange-600" />,
      color: "orange",
    },
    {
      label: "Net Income (MTD)",
      value: fmt(props.netIncome),
      sub: `Revenue: ${fmt(props.totalRevenue)}`,
      icon: props.netIncome >= 0
        ? <TrendingUp className="w-5 h-5 text-emerald-600" />
        : <TrendingDown className="w-5 h-5 text-red-600" />,
      color: props.netIncome >= 0 ? "emerald" : "red",
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{props.entityName}</h1>
        <p className="text-sm text-gray-500">Dashboard · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{s.label}</span>
              {s.icon}
            </div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            {s.sub && <div className="text-xs text-gray-500 mt-1">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Recent Journal Entries</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {props.recentEntries.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No entries yet</div>
          )}
          {props.recentEntries.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{e.memo || e.firstAccount}</div>
                  <div className="text-xs text-gray-400">{e.date} · {e.source}</div>
                </div>
              </div>
              <div className="text-sm font-semibold text-gray-700 ml-4 flex-shrink-0">{fmt(e.amount)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      {(props.overdueInvoices > 0 || props.unpaidBills > 0) && (
        <div className="flex gap-3">
          {props.overdueInvoices > 0 && (
            <a href="/invoices?status=OVERDUE" className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg hover:bg-red-100 transition-colors">
              <AlertCircle className="w-4 h-4" />
              {props.overdueInvoices} overdue {props.overdueInvoices === 1 ? "invoice" : "invoices"}
            </a>
          )}
          {props.unpaidBills > 0 && (
            <a href="/bills?status=ENTERED" className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 text-orange-700 text-sm rounded-lg hover:bg-orange-100 transition-colors">
              <Clock className="w-4 h-4" />
              {props.unpaidBills} unpaid {props.unpaidBills === 1 ? "bill" : "bills"}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
