import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { NewAmortizationForm } from "./NewAmortizationForm"

export const dynamic = "force-dynamic"

export default async function NewAmortizationPage() {
  const { tenantId, entityId } = await getEntityContext()

  const accounts = await prisma.account.findMany({
    where: { tenantId, entityId, isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, type: true },
  })

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Amortization Schedule</h1>
      <NewAmortizationForm entityId={entityId} accounts={accounts} />
    </div>
  )
}
