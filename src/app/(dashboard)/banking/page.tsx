import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, RefreshCw } from "lucide-react"

export default async function BankingPage() {
  const { tenantId, entityId } = await getEntityContext()

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { tenantId, entityId, isActive: true },
    include: { _count: { select: { transactions: true } } },
  })

  const recentTxns = await prisma.bankTransaction.findMany({
    where: { tenantId, entityId },
    orderBy: { date: "desc" },
    take: 20,
    include: { bankAccount: true },
  })

  function fmt(cents: number) {
    const sign = cents < 0 ? "" : "-"
    return sign + "$" + (Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Banking</h1>
        <div className="flex gap-2">
          <Link href="/banking/link" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Link Bank Account
          </Link>
        </div>
      </div>

      {/* Bank accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bankAccounts.map((acct) => (
          <div key={acct.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900">{acct.name}</span>
              <button className="text-gray-400 hover:text-blue-600 transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-gray-400">
              {acct._count.transactions} transactions
              {acct.lastSyncedAt && ` · synced ${acct.lastSyncedAt.toISOString().slice(0, 10)}`}
            </div>
            {acct.plaidAccountId && (
              <div className="mt-2 text-xs text-green-600 font-medium">● Plaid connected</div>
            )}
          </div>
        ))}
        {bankAccounts.length === 0 && (
          <div className="col-span-3 bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">No bank accounts linked. Connect via Plaid to start syncing.</p>
          </div>
        )}
      </div>

      {/* Transactions feed */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Recent Transactions</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Description</th><th>Account</th>
              <th className="text-right">Amount</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentTxns.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No transactions</td></tr>
            )}
            {recentTxns.map((txn) => (
              <tr key={txn.id}>
                <td className="text-gray-500">{txn.date.toISOString().slice(0, 10)}</td>
                <td className="font-medium">{txn.name}</td>
                <td className="text-gray-400 text-xs">{txn.bankAccount.name}</td>
                <td className="text-right font-mono">{fmt(txn.amount)}</td>
                <td>
                  {txn.isMatched ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Matched</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Unmatched</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
