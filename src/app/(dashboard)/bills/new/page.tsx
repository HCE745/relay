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

type POPrefill = {
  poId: string
  poNumber: string | null
  vendorId: string
  vendorName: string
  lines: { description: string; qty: number; unitPriceCents: number; accountId: string }[]
}

export default async function NewBillPage({
  searchParams,
}: {
  searchParams: Promise<{ poId?: string }>
}) {
  const { tenantId, entityId } = await getEntityContext()
  const { poId } = await searchParams

  // Pre-fill from PO if poId is in query string
  let poPrefill: POPrefill | null = null
  if (poId) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, tenantId, entityId },
      include: { vendor: { select: { id: true, name: true } }, lines: { orderBy: { sortOrder: "asc" } } },
    })
    if (po && ["OPEN", "PARTIALLY_RECEIVED"].includes(po.status)) {
      poPrefill = {
        poId: po.id,
        poNumber: po.poNumber,
        vendorId: po.vendorId,
        vendorName: po.vendor.name,
        lines: po.lines.map((l) => ({
          description: l.description ?? "",
          qty: l.qty,
          unitPriceCents: l.unitPriceCents,
          accountId: l.accountId ?? "",
        })),
      }
    }
  }

  const [vendors, expenseAccounts, assetAccounts, classes, departments] = await Promise.all([
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
    prisma.account.findMany({
      where: { tenantId, entityId, type: "ASSET", isActive: true },
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
      assetAccounts={assetAccounts}
      classes={classes}
      departments={departments}
      poPrefill={poPrefill}
    />
  )
}
