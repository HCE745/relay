import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function BudgetsPage() {
  const { tenantId, entityId } = await getEntityContext()

  const budgets = await prisma.budget.findMany({
    where: { tenantId, entityId },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
        <Link
          href="/budgets/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus className="w-4 h-4" /> New Budget
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
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
            {budgets.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  No budgets yet — create one to get started.
                </td>
              </tr>
            )}
            {budgets.map((b) => (
              <tr key={b.id}>
                <td className="font-medium">{b.name}</td>
                <td>{b.fiscalYear}</td>
                <td className="capitalize text-gray-600 text-sm">
                  {b.periodType.charAt(0) + b.periodType.slice(1).toLowerCase()}
                </td>
                <td className="text-gray-500 text-sm">{b.createdAt.toISOString().slice(0, 10)}</td>
                <td>
                  <Link
                    href={`/budgets/${b.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
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
