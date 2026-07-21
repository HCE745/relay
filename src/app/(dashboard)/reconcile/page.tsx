import Link from "next/link"
import { FileText } from "lucide-react"
import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function ReconcilePage() {
  const { tenantId, entityId } = await getEntityContext()

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { tenantId, entityId, isActive: true },
  })

  const unmatchedTxns = await prisma.bankTransaction.findMany({
    where: { tenantId, entityId, isMatched: false },
    orderBy: { date: "desc" },
    take: 50,
    include: { bankAccount: true },
  })

  const accounts = await prisma.account.findMany({
    where: { tenantId, entityId, isActive: true },
    orderBy: { code: "asc" },
  })

  function fmt(cents: number) {
    return (Math.abs(cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reconciliation</h1>
          <p className="text-sm text-gray-500">{unmatchedTxns.length} unmatched transactions</p>
        </div>
        <Link
          href="/reconcile/statement"
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Statement Scan
        </Link>
      </div>

      {bankAccounts.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No bank accounts connected. Link a bank account first.
        </div>
      )}

      {unmatchedTxns.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Unmatched Transactions</h2>
            <p className="text-xs text-gray-400 mt-0.5">Categorize or match each transaction to a journal entry</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th><th>Description</th><th>Bank Account</th>
                <th className="text-right">Amount</th><th>Category</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {unmatchedTxns.map((txn) => (
                <tr key={txn.id}>
                  <td className="text-gray-500 text-xs">{txn.date.toISOString().slice(0, 10)}</td>
                  <td className="font-medium">{txn.name}</td>
                  <td className="text-gray-400 text-xs">{txn.bankAccount.name}</td>
                  <td className={`text-right font-mono ${txn.amount > 0 ? "text-red-600" : "text-green-600"}`}>
                    {txn.amount > 0 ? `-${fmt(txn.amount)}` : `+${fmt(Math.abs(txn.amount))}`}
                  </td>
                  <td>
                    <select className="text-xs border border-gray-200 rounded px-2 py-1 w-40">
                      <option value="">Select account…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">Categorize</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unmatchedTxns.length === 0 && bankAccounts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-green-600 text-2xl mb-2">✓</div>
          <p className="text-gray-700 font-medium">All transactions are matched</p>
          <p className="text-sm text-gray-400 mt-1">Your books are in sync with your bank</p>
        </div>
      )}
    </div>
  )
}
