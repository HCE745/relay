import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { BillForm } from "@/components/bills/BillForm"

export const dynamic = "force-dynamic"

export default async function NewBillPage() {
  const { tenantId, entityId } = await getEntityContext()

  const [vendors, expenseAccounts, classes, departments] = await Promise.all([
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
    prisma.class.findMany({
      where: { tenantId, entityId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      where: { tenantId, entityId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  return (
    <BillForm
      entityId={entityId}
      vendors={vendors}
      expenseAccounts={expenseAccounts}
      classes={classes}
      departments={departments}
    />
  )
}
