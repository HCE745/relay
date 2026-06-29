import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import nextDynamic from "next/dynamic"

// BillForm gets webpack module ID 0 in its client chunk. The Next.js 15 manifest
// plugin skips module 0 (falsy check), so a static import causes a 500 at
// RSC render time. next/dynamic bypasses the manifest lookup entirely.
const BillForm = nextDynamic(
  () => import("@/components/bills/BillForm").then((m) => ({ default: m.BillForm })),
  { loading: () => <div className="p-6 text-gray-400 text-sm">Loading…</div> }
)

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
