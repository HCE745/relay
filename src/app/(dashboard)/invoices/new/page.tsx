import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { InvoiceForm } from "@/components/invoices/InvoiceForm"

export const dynamic = "force-dynamic"

export default async function NewInvoicePage() {
  const { tenantId, entityId } = await getEntityContext()

  const [customers, revenueAccounts, classes, departments] = await Promise.all([
    prisma.customer.findMany({
      where: { tenantId, entityId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.account.findMany({
      where: { tenantId, entityId, type: "INCOME", isActive: true },
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
    <InvoiceForm
      entityId={entityId}
      customers={customers}
      revenueAccounts={revenueAccounts}
      classes={classes}
      departments={departments}
    />
  )
}
