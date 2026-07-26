import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { getAccountBalance } from "@/lib/ledger"
import Link from "next/link"
import { Plus, BookOpen } from "lucide-react"

export const dynamic = "force-dynamic"

const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]
const TYPE_LABELS: Record<string, string> = {
  ASSET: "Assets", LIABILITY: "Liabilities", EQUITY: "Equity",
  INCOME: "Income", EXPENSE: "Expenses",
}

function fmtBalance(cents: number, normalBalance: string) {
  const display = normalBalance === "DEBIT" ? cents : -cents
  const s = (Math.abs(display) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
  return { value: display < 0 ? `(${s})` : s, negative: display < 0 }
}

export default async function AccountsPage() {
  const { tenantId, entityId } = await getEntityContext()

  const accounts = await prisma.account.findMany({
    where: { tenantId, entityId, isActive: true },
    orderBy: { code: "asc" },
  })

  const withBalances = await Promise.all(
    accounts.map(async (acct) => ({
      ...acct,
      balance: await getAccountBalance(tenantId, entityId, acct.id),
    }))
  )

  const grouped = withBalances.reduce((acc, a) => {
    if (!acc[a.type]) acc[a.type] = []
    acc[a.type].push(a)
    return acc
  }, {} as Record<string, typeof withBalances>)

  return (
    <div className="p-6 max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Chart of Accounts</h1>
          <p className="page-subtitle">{accounts.length} account{accounts.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/accounts/new" className="btn-primary">
          <Plus className="w-3.5 h-3.5" /> Add Account
        </Link>
      </div>

      {accounts.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <BookOpen className="empty-state-icon" />
            <p className="empty-state-title">Chart of accounts is empty</p>
            <p className="empty-state-desc">
              Add accounts to categorize your transactions. Start with Assets, Liabilities, Equity, Income, and Expenses — or import from QuickBooks/Xero via Settings → Integrations.
            </p>
            <Link href="/accounts/new" className="btn-primary">Add Account</Link>
          </div>
        </div>
      )}

      {TYPE_ORDER.map((type) => {
        const accts = grouped[type]
        if (!accts || accts.length === 0) return null
        return (
          <div key={type} className="card">
            <div className="card-header">
              <span className="card-header-title">{TYPE_LABELS[type]}</span>
              <span className="text-xs text-slate-400">{accts.length} account{accts.length !== 1 ? "s" : ""}</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "6rem" }}>Code</th>
                  <th>Name</th>
                  <th>Subtype</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accts.map((acct) => {
                  const bal = fmtBalance(acct.balance, acct.normalBalance)
                  return (
                    <tr key={acct.id}>
                      <td className="fin text-slate-400 text-xs">{acct.code}</td>
                      <td className="font-medium">{acct.name}</td>
                      <td className="text-slate-400 text-xs">{acct.subtype ?? "—"}</td>
                      <td className={`num fin text-sm ${bal.negative ? "text-red-600" : ""}`}>{bal.value}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
