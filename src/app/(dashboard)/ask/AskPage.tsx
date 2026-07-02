"use client"
import { useState, useRef } from "react"
import { Send, Loader2, Copy, Check, AlertCircle } from "lucide-react"

type Entity = { id: string; name: string }

type QueryIntentType =
  | "pl"
  | "balance_sheet"
  | "account_balance"
  | "vendor_spend"
  | "top_vendors"
  | "cash_position"
  | "ar_summary"
  | "ap_summary"

interface QueryIntent {
  type: QueryIntentType
  entityId: string
  consolidated: boolean
  dateStart: string
  dateEnd: string
  accountCodes: string[] | null
  topN: number | null
  canAnswer: boolean
  cantAnswerReason: string | null
}

interface AskResponse {
  answer: string
  data: unknown
  intent: QueryIntent
  error?: string
}

// ─── Data display helpers ─────────────────────────────────────────────────────

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function PLTable({ data }: { data: unknown }) {
  const d = data as {
    revenue: { code: string; name: string; amount: number }[]
    totalRevenue: number
    cogs: { code: string; name: string; amount: number }[]
    totalCogs: number
    grossProfit: number
    expenses: { code: string; name: string; amount: number }[]
    totalExpenses: number
    netIncome: number
  }
  return (
    <table className="data-table">
      <thead>
        <tr><th>Account</th><th className="text-right">Amount</th></tr>
      </thead>
      <tbody>
        {d.revenue.length > 0 && (
          <tr className="bg-gray-50"><td colSpan={2} className="font-semibold text-gray-700">Revenue</td></tr>
        )}
        {d.revenue.map((r) => (
          <tr key={r.code}><td className="pl-4 text-sm">{r.code} {r.name}</td><td className="text-right text-sm">{fmt(r.amount)}</td></tr>
        ))}
        {d.revenue.length > 0 && (
          <tr className="border-t border-gray-200 font-semibold"><td>Total Revenue</td><td className="text-right">{fmt(d.totalRevenue)}</td></tr>
        )}
        {d.cogs.length > 0 && (
          <>
            <tr className="bg-gray-50"><td colSpan={2} className="font-semibold text-gray-700">Cost of Goods Sold</td></tr>
            {d.cogs.map((r) => (
              <tr key={r.code}><td className="pl-4 text-sm">{r.code} {r.name}</td><td className="text-right text-sm">{fmt(r.amount)}</td></tr>
            ))}
            <tr className="border-t border-gray-200 font-semibold"><td>Gross Profit</td><td className="text-right">{fmt(d.grossProfit)}</td></tr>
          </>
        )}
        {d.expenses.length > 0 && (
          <tr className="bg-gray-50"><td colSpan={2} className="font-semibold text-gray-700">Expenses</td></tr>
        )}
        {d.expenses.map((r) => (
          <tr key={r.code}><td className="pl-4 text-sm">{r.code} {r.name}</td><td className="text-right text-sm">{fmt(r.amount)}</td></tr>
        ))}
        {d.expenses.length > 0 && (
          <tr className="border-t border-gray-200 font-semibold"><td>Total Expenses</td><td className="text-right">{fmt(d.totalExpenses)}</td></tr>
        )}
        <tr className="border-t-2 border-gray-400 font-bold text-base">
          <td>Net Income</td>
          <td className={`text-right ${d.netIncome >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(d.netIncome)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function BalanceSheetTable({ data }: { data: unknown }) {
  const d = data as {
    assets: { code: string; name: string; amount: number }[]
    totalAssets: number
    liabilities: { code: string; name: string; amount: number }[]
    totalLiabilities: number
    equity: { code: string; name: string; amount: number }[]
    totalEquity: number
    totalLiabilitiesAndEquity: number
  }
  return (
    <table className="data-table">
      <thead>
        <tr><th>Account</th><th className="text-right">Amount</th></tr>
      </thead>
      <tbody>
        <tr className="bg-gray-50"><td colSpan={2} className="font-semibold text-gray-700">Assets</td></tr>
        {d.assets.map((r) => (
          <tr key={r.code}><td className="pl-4 text-sm">{r.code} {r.name}</td><td className="text-right text-sm">{fmt(r.amount)}</td></tr>
        ))}
        <tr className="border-t border-gray-200 font-semibold"><td>Total Assets</td><td className="text-right">{fmt(d.totalAssets)}</td></tr>
        <tr className="bg-gray-50"><td colSpan={2} className="font-semibold text-gray-700">Liabilities</td></tr>
        {d.liabilities.map((r) => (
          <tr key={r.code}><td className="pl-4 text-sm">{r.code} {r.name}</td><td className="text-right text-sm">{fmt(r.amount)}</td></tr>
        ))}
        <tr className="border-t border-gray-200 font-semibold"><td>Total Liabilities</td><td className="text-right">{fmt(d.totalLiabilities)}</td></tr>
        <tr className="bg-gray-50"><td colSpan={2} className="font-semibold text-gray-700">Equity</td></tr>
        {d.equity.map((r) => (
          <tr key={r.code}><td className="pl-4 text-sm">{r.code} {r.name}</td><td className="text-right text-sm">{fmt(r.amount)}</td></tr>
        ))}
        <tr className="border-t-2 border-gray-400 font-bold"><td>Total Liabilities &amp; Equity</td><td className="text-right">{fmt(d.totalLiabilitiesAndEquity)}</td></tr>
      </tbody>
    </table>
  )
}

function AccountBalanceTable({ data }: { data: unknown }) {
  const d = data as { accounts: { code: string; name: string; type: string; balanceCents: number }[]; totalBalanceCents: number }
  return (
    <table className="data-table">
      <thead>
        <tr><th>Code</th><th>Account</th><th>Type</th><th className="text-right">Balance</th></tr>
      </thead>
      <tbody>
        {d.accounts.map((a) => (
          <tr key={a.code}>
            <td className="font-mono text-xs text-gray-500">{a.code}</td>
            <td>{a.name}</td>
            <td className="text-xs text-gray-500">{a.type}</td>
            <td className="text-right font-medium">{fmt(a.balanceCents)}</td>
          </tr>
        ))}
        {d.accounts.length > 1 && (
          <tr className="border-t-2 border-gray-400 font-bold">
            <td colSpan={3}>Total</td>
            <td className="text-right">{fmt(d.totalBalanceCents)}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

function CashPositionTable({ data }: { data: unknown }) {
  const d = data as { cashAccounts: { code: string; name: string; balanceCents: number }[]; totalCashCents: number }
  return (
    <table className="data-table">
      <thead>
        <tr><th>Code</th><th>Account</th><th className="text-right">Balance</th></tr>
      </thead>
      <tbody>
        {d.cashAccounts.map((a) => (
          <tr key={a.code}>
            <td className="font-mono text-xs text-gray-500">{a.code}</td>
            <td>{a.name}</td>
            <td className="text-right font-medium">{fmt(a.balanceCents)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-gray-400 font-bold">
          <td colSpan={2}>Total Cash</td>
          <td className="text-right text-green-700">{fmt(d.totalCashCents)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function VendorSpendTable({ data }: { data: unknown }) {
  const d = data as {
    bills: { id: string; date: string; total: number; status: string; vendor: { name: string } }[]
    totalSpendCents: number
    billCount: number
  }
  return (
    <table className="data-table">
      <thead>
        <tr><th>Vendor</th><th>Date</th><th>Status</th><th className="text-right">Amount</th></tr>
      </thead>
      <tbody>
        {d.bills.map((b) => (
          <tr key={b.id}>
            <td className="font-medium">{b.vendor.name}</td>
            <td className="text-sm text-gray-500">{new Date(b.date).toLocaleDateString()}</td>
            <td><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{b.status}</span></td>
            <td className="text-right">{fmt(b.total)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-gray-400 font-bold">
          <td colSpan={3}>Total ({d.billCount} bills)</td>
          <td className="text-right">{fmt(d.totalSpendCents)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function TopVendorsTable({ data }: { data: unknown }) {
  const d = data as { topVendors: { vendorId: string; vendorName: string; totalCents: number; billCount: number }[]; totalVendors: number }
  return (
    <table className="data-table">
      <thead>
        <tr><th>#</th><th>Vendor</th><th className="text-right">Bills</th><th className="text-right">Total Spend</th></tr>
      </thead>
      <tbody>
        {d.topVendors.map((v, i) => (
          <tr key={v.vendorId}>
            <td className="text-gray-400 text-sm">{i + 1}</td>
            <td className="font-medium">{v.vendorName}</td>
            <td className="text-right text-sm text-gray-500">{v.billCount}</td>
            <td className="text-right font-medium">{fmt(v.totalCents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ARSummaryTable({ data }: { data: unknown }) {
  const d = data as {
    invoices: { id: string; invoiceNumber: string; date: string; dueDate: string; total: number; amountDue: number; status: string; customer: { name: string } }[]
    totalInvoicedCents: number
    totalOutstandingCents: number
    invoiceCount: number
  }
  return (
    <table className="data-table">
      <thead>
        <tr><th>Customer</th><th>#</th><th>Date</th><th>Due</th><th>Status</th><th className="text-right">Total</th><th className="text-right">Outstanding</th></tr>
      </thead>
      <tbody>
        {d.invoices.map((inv) => (
          <tr key={inv.id}>
            <td className="font-medium">{inv.customer.name}</td>
            <td className="text-xs text-gray-500 font-mono">{inv.invoiceNumber}</td>
            <td className="text-sm text-gray-500">{new Date(inv.date).toLocaleDateString()}</td>
            <td className="text-sm text-gray-500">{new Date(inv.dueDate).toLocaleDateString()}</td>
            <td><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{inv.status}</span></td>
            <td className="text-right text-sm">{fmt(inv.total)}</td>
            <td className="text-right font-medium">{fmt(inv.amountDue)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-gray-400 font-bold">
          <td colSpan={5}>Total ({d.invoiceCount} invoices)</td>
          <td className="text-right">{fmt(d.totalInvoicedCents)}</td>
          <td className="text-right text-orange-600">{fmt(d.totalOutstandingCents)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function APSummaryTable({ data }: { data: unknown }) {
  const d = data as {
    bills: { id: string; billNumber: string | null; date: string; dueDate: string; total: number; amountDue: number; status: string; vendor: { name: string } }[]
    totalBilledCents: number
    totalOutstandingCents: number
    billCount: number
  }
  return (
    <table className="data-table">
      <thead>
        <tr><th>Vendor</th><th>#</th><th>Date</th><th>Due</th><th>Status</th><th className="text-right">Total</th><th className="text-right">Outstanding</th></tr>
      </thead>
      <tbody>
        {d.bills.map((b) => (
          <tr key={b.id}>
            <td className="font-medium">{b.vendor.name}</td>
            <td className="text-xs text-gray-500 font-mono">{b.billNumber ?? "—"}</td>
            <td className="text-sm text-gray-500">{new Date(b.date).toLocaleDateString()}</td>
            <td className="text-sm text-gray-500">{new Date(b.dueDate).toLocaleDateString()}</td>
            <td><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{b.status}</span></td>
            <td className="text-right text-sm">{fmt(b.total)}</td>
            <td className="text-right font-medium">{fmt(b.amountDue)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-gray-400 font-bold">
          <td colSpan={5}>Total ({d.billCount} bills)</td>
          <td className="text-right">{fmt(d.totalBilledCents)}</td>
          <td className="text-right text-red-600">{fmt(d.totalOutstandingCents)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function DataTable({ intent, data }: { intent: QueryIntent; data: unknown }) {
  if (!data) return null
  switch (intent.type) {
    case "pl": return <PLTable data={data} />
    case "balance_sheet": return <BalanceSheetTable data={data} />
    case "account_balance": return <AccountBalanceTable data={data} />
    case "cash_position": return <CashPositionTable data={data} />
    case "vendor_spend": return <VendorSpendTable data={data} />
    case "top_vendors": return <TopVendorsTable data={data} />
    case "ar_summary": return <ARSummaryTable data={data} />
    case "ap_summary": return <APSummaryTable data={data} />
    default: return null
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  "What did we spend this month?",
  "What's our cash balance?",
  "Show top vendors this year",
  "What's our net income year to date?",
  "Show accounts receivable summary",
  "What are our outstanding bills?",
]

interface Props {
  entityId: string
  entityName: string
  entities: Entity[]
}

export function AskPage({ entityId, entityName }: Props) {
  const [question, setQuestion] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AskResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function submit(q: string) {
    const trimmed = q.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, entityId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "An error occurred. Please try again.")
      } else {
        setResult(json as AskResponse)
      }
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit(question)
    }
  }

  function usePrompt(prompt: string) {
    setQuestion(prompt)
    inputRef.current?.focus()
  }

  async function copyAnswer() {
    if (!result?.answer) return
    await navigator.clipboard.writeText(result.answer)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ask About Your Books</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ask any question about your accounting data in plain English.
        </p>
      </div>

      {/* Entity scope indicator */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg">
        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
        Querying: <span className="font-semibold text-gray-800">{entityName}</span>
        <span className="text-gray-400 text-xs">(scoped to active entity)</span>
      </div>

      {/* Input card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your books…"
            rows={3}
            className="w-full px-4 py-3 pr-14 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
          />
          <button
            onClick={() => submit(question)}
            disabled={loading || !question.trim()}
            className="absolute right-3 bottom-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Submit question"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Example prompts */}
        <div className="space-y-1">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => usePrompt(prompt)}
                className="px-3 py-1.5 text-sm bg-gray-50 text-gray-600 border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span>Analyzing your question and retrieving data…</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Could not answer your question</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Answer box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-gray-800 leading-relaxed flex-1">{result.answer}</p>
              <button
                onClick={copyAnswer}
                className="flex-shrink-0 p-1.5 text-blue-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-100"
                aria-label="Copy answer"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {result.intent && (
              <div className="mt-3 pt-3 border-t border-blue-200 flex flex-wrap gap-x-4 gap-y-1 text-xs text-blue-500">
                <span>Type: <span className="font-medium text-blue-700">{result.intent.type.replace(/_/g, " ")}</span></span>
                <span>Period: <span className="font-medium text-blue-700">{result.intent.dateStart} – {result.intent.dateEnd}</span></span>
                {result.intent.consolidated && (
                  <span className="font-medium text-blue-700">Consolidated</span>
                )}
              </div>
            )}
          </div>

          {/* Supporting data table */}
          {Boolean(result.data) && result.intent && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">Supporting Data</h2>
              </div>
              <div className="overflow-x-auto">
                <DataTable intent={result.intent} data={result.data} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
