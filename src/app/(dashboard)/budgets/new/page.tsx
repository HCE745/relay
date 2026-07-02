import { getEntityContext } from "@/lib/entity-context"
import { NewBudgetForm } from "@/components/budgets/NewBudgetForm"

export const dynamic = "force-dynamic"

export default async function NewBudgetPage() {
  const { entityId } = await getEntityContext()
  const currentYear = new Date().getFullYear()

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Budget</h1>
      <NewBudgetForm entityId={entityId} defaultYear={currentYear} />
    </div>
  )
}
