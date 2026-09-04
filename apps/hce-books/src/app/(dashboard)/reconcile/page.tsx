import Link from "next/link"
import { FileText, CheckCircle, CreditCard } from "lucide-react"
import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { EmptyCard } from "@/components/ui/EmptyState"

export const dynamic = "force-dynamic"

function fmt(cents: number) {
  return (Math.abs(cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export default async function ReconcilePage() {
  const { tenantId, entityId } = await getEntityContext()

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { tenantId, entityId, isActive: true },
  })

  const unmatchedTxns = await prisma.bankTransaction.findMany({
    where: { tenantId, entityId, isMatched: false },
    orderBy: { date: "desc" },
    take: 50,
    include: { bankAccount: { select: { name: true } } },
  })

  const accounts = await prisma.account.findMany({
    where: { tenantId, entityId, isActive: true },
    orderBy: { code: "asc" },
  })

  return (
    <div className="p-6 max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reconciliation</h1>
          <p className="page-subtitle">
            {unmatchedTxns.length > 0
              ? `${unmatchedTxns.length} unmatched transaction${unmatchedTxns.length !== 1 ? "s" : ""}`
              : "All transactions matched"}
          </p>
        </div>
        <Link href="/reconcile/statement" className="btn-secondary">
          <FileText className="w-3.5 h-3.5" /> Statement Scan
        </Link>
      </div>

      {bankAccounts.length === 0 && (
        <div className="card">
          <EmptyCard
            icon={CreditCard}
            title="No bank accounts connected"
            description="Link a bank account first, then return here to reconcile imported transactions against your books."
            actions={[{ label: "Link Account", href: "/banking/link" }]}
          />
        </div>
      )}

      {unmatchedTxns.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-header-title">Unmatched Transactions</span>
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>Categorize each to post to the ledger</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Bank Account</th>
                <th className="num">Amount</th>
                <th>Category</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {unmatchedTxns.map((txn) => (
                <tr key={txn.id}>
                  <td className="fin text-slate-500">{txn.date.toISOString().slice(0, 10)}</td>
                  <td className="font-medium">{txn.name}</td>
                  <td className="text-slate-400 text-xs">{txn.bankAccount.name}</td>
                  <td className={`num fin ${txn.amount > 0 ? "text-red-600" : "text-green-600"}`}>
                    {txn.amount > 0 ? `-${fmt(txn.amount)}` : `+${fmt(Math.abs(txn.amount))}`}
                  </td>
                  <td>
                    <select className="field-input" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", width: "10rem" }}>
                      <option value="">Select account…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="text-xs font-medium" style={{ color: "var(--accent)" }}>Categorize</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unmatchedTxns.length === 0 && bankAccounts.length > 0 && (
        <div className="card p-10 text-center">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-3" />
          <p className="font-semibold text-sm" style={{ color: "var(--text-base)" }}>All transactions are matched</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>Your books are in sync with your bank</p>
        </div>
      )}
    </div>
  )
}
