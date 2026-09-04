import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, BarChart3 } from "lucide-react"
import { EmptyState } from "@/components/ui/EmptyState"

export const dynamic = "force-dynamic"

export default async function BudgetsPage() {
  const { tenantId, entityId } = await getEntityContext()

  const budgets = await prisma.budget.findMany({
    where: { tenantId, entityId },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="p-6 max-w-7xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Budgets</h1>
          <p className="page-subtitle">
            {budgets.length > 0
              ? `${budgets.length} budget${budgets.length !== 1 ? "s" : ""}`
              : "Plan and track spending against targets"}
          </p>
        </div>
        <Link href="/budgets/new" className="btn-primary">
          <Plus className="w-3.5 h-3.5" /> New Budget
        </Link>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Fiscal Year</th>
              <th>Period Type</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {budgets.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No budgets yet"
                description="Create a budget to track actual spending vs. targets by period. Budget vs. actual comparisons appear in your financial reports."
                actions={[{ label: "New Budget", href: "/budgets/new" }]}
              />
            ) : budgets.map((b) => (
              <tr key={b.id}>
                <td className="font-medium">{b.name}</td>
                <td className="fin text-slate-500">{b.fiscalYear}</td>
                <td className="text-slate-600 capitalize">
                  {b.periodType.charAt(0) + b.periodType.slice(1).toLowerCase()}
                </td>
                <td className="fin text-slate-500">{b.createdAt.toISOString().slice(0, 10)}</td>
                <td>
                  <Link href={`/budgets/${b.id}`} className="text-sm font-medium text-blue-700 hover:text-blue-800">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
