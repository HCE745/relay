import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { BudgetTabs } from "@/components/budgets/BudgetTabs"

export const dynamic = "force-dynamic"

export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, entityId, selectedEntity } = await getEntityContext()

  const budget = await prisma.budget.findUnique({ where: { id } })

  if (!budget || budget.tenantId !== tenantId || budget.entityId !== entityId) {
    notFound()
  }

  // Load INCOME and EXPENSE accounts for the grid
  const accounts = await prisma.account.findMany({
    where: { tenantId, entityId, type: { in: ["INCOME", "EXPENSE"] }, isActive: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, type: true },
  })

  const isConsolidationParent = selectedEntity?.isConsolidationParent ?? false

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/budgets" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{budget.name}</h1>
          <p className="text-sm text-gray-500">
            FY{budget.fiscalYear} &middot;{" "}
            {budget.periodType.charAt(0) + budget.periodType.slice(1).toLowerCase()}
          </p>
        </div>
      </div>

      <BudgetTabs
        budgetId={budget.id}
        fiscalYear={budget.fiscalYear}
        periodType={budget.periodType}
        accounts={accounts}
        isConsolidationParent={isConsolidationParent}
      />
    </div>
  )
}
