import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { NewPOForm } from "./NewPOForm"

export const dynamic = "force-dynamic"

export default async function NewPOPage() {
  const { tenantId, entityId } = await getEntityContext()

  const [vendors, expenseAccounts] = await Promise.all([
    prisma.vendor.findMany({
      where: { tenantId, entityId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.account.findMany({
      where: { tenantId, entityId, type: "EXPENSE", isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ])

  return <NewPOForm entityId={entityId} vendors={vendors} expenseAccounts={expenseAccounts} />
}
