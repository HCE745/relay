import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, CreditCard, Wifi } from "lucide-react"
import { EmptyCard } from "@/components/ui/EmptyState"
import { StatusBadge } from "@/components/ui/StatusBadge"

export const dynamic = "force-dynamic"

function fmtAmt(cents: number) {
  const abs = (Math.abs(cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
  return cents < 0 ? abs : `-${abs}`
}

export default async function BankingPage() {
  const { tenantId, entityId } = await getEntityContext()

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { tenantId, entityId, isActive: true },
    include: { _count: { select: { transactions: true } } },
  })

  const recentTxns = await prisma.bankTransaction.findMany({
    where: { tenantId, entityId },
    orderBy: { date: "desc" },
    take: 25,
    include: { bankAccount: { select: { name: true } } },
  })

  return (
    <div className="p-6 max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Banking</h1>
          <p className="page-subtitle">
            {bankAccounts.length > 0
              ? `${bankAccounts.length} account${bankAccounts.length !== 1 ? "s" : ""} connected`
              : "Connect accounts to sync transactions automatically"}
          </p>
        </div>
        <Link href="/banking/link" className="btn-primary">
          <Plus className="w-3.5 h-3.5" /> Link Account
        </Link>
      </div>

      {/* Bank account cards */}
      {bankAccounts.length === 0 ? (
        <div className="card">
          <EmptyCard
            icon={CreditCard}
            title="No bank accounts linked"
            description="Connect your bank or credit card via Plaid to automatically import transactions. Categorize them once and your books stay current."
            actions={[{ label: "Link Account", href: "/banking/link" }]}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bankAccounts.map((acct) => (
            <div key={acct.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--text-base)" }}>{acct.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
                    {acct._count.transactions} transactions
                  </p>
                </div>
                {acct.plaidAccountId && (
                  <Wifi className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
              </div>
              {acct.lastSyncedAt && (
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                  Synced {acct.lastSyncedAt.toISOString().slice(0, 10)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Transactions */}
      <div className="card">
        <div className="card-header">
          <span className="card-header-title">Recent Transactions</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Account</th>
              <th className="num">Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentTxns.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10" style={{ color: "var(--text-faint)" }}>
                  No transactions yet — link a bank account to start importing.
                </td>
              </tr>
            ) : recentTxns.map((txn) => (
              <tr key={txn.id}>
                <td className="fin text-slate-500">{txn.date.toISOString().slice(0, 10)}</td>
                <td className="font-medium">{txn.name}</td>
                <td className="text-slate-400 text-xs">{txn.bankAccount.name}</td>
                <td className="num fin">{fmtAmt(txn.amount)}</td>
                <td>
                  <StatusBadge
                    status={txn.isMatched ? "PAID" : "ENTERED"}
                    label={txn.isMatched ? "Matched" : "Unmatched"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
