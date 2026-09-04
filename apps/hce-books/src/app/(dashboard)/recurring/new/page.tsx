import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { NewRecurringForm } from "./NewRecurringForm"

export const dynamic = "force-dynamic"

export default async function NewRecurringPage() {
  const { tenantId, entityId } = await getEntityContext()

  const [vendors, customers, accounts] = await Promise.all([
    prisma.vendor.findMany({
      where: { tenantId, entityId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      where: { tenantId, entityId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.account.findMany({
      where: { tenantId, entityId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, type: true },
    }),
  ])

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Recurring Template</h1>
      <NewRecurringForm entityId={entityId} vendors={vendors} customers={customers} accounts={accounts} />
    </div>
  )
}
