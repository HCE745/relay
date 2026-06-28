import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { getAccountBalance } from "@/lib/ledger"
import Link from "next/link"
import { Plus } from "lucide-react"

export const dynamic = "force-dynamic"

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
    })),
  )

  const groupedByType = withBalances.reduce(
    (acc, acct) => {
      if (!acc[acct.type]) acc[acct.type] = []
      acc[acct.type].push(acct)
      return acc
    },
    {} as Record<string, typeof withBalances>,
  )

  const typeOrder = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]
  const typeLabels: Record<string, string> = {
    ASSET: "Assets", LIABILITY: "Liabilities", EQUITY: "Equity",
    INCOME: "Income", EXPENSE: "Expenses",
  }

  function fmtBalance(cents: number, normalBalance: string) {
    const display = normalBalance === "DEBIT" ? cents : -cents
    const s = (Math.abs(display) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
    return display < 0 ? `(${s})` : s
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
        <Link
          href="/accounts/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Account
        </Link>
      </div>

      {typeOrder.map((type) => {
        const accts = groupedByType[type] ?? []
        if (accts.length === 0) return null
        return (
          <div key={type} className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{typeLabels[type]}</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Subtype</th><th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accts.map((acct) => (
                  <tr key={acct.id}>
                    <td className="font-mono text-gray-500">{acct.code}</td>
                    <td className="font-medium">{acct.name}</td>
                    <td className="text-gray-400 text-xs">{acct.subtype ?? "—"}</td>
                    <td className="text-right font-mono text-sm">{fmtBalance(acct.balance, acct.normalBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
