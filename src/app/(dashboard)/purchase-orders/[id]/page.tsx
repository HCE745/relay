import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { PODetail } from "./PODetail"

export const dynamic = "force-dynamic"

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, entityId } = await getEntityContext()

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      receipts: { orderBy: { receivedAt: "desc" } },
    },
  })

  if (!po || po.tenantId !== tenantId) notFound()

  // Load matched bills
  const bills = await prisma.bill.findMany({
    where: { tenantId, poId: id },
    include: {
      vendor: { select: { id: true, name: true } },
      lines: { orderBy: { id: "asc" } },
    },
    orderBy: { date: "desc" },
  })

  // Serialize dates for client
  const serializedPo = {
    ...po,
    date: po.date.toISOString(),
    expectedDate: po.expectedDate?.toISOString() ?? null,
    createdAt: po.createdAt.toISOString(),
    updatedAt: po.updatedAt.toISOString(),
    lines: po.lines.map((l) => ({ ...l })),
    receipts: po.receipts.map((r) => ({
      ...r,
      receivedAt: r.receivedAt.toISOString(),
      lines: r.lines as { poLineId: string; qtyReceived: number }[],
    })),
  }

  const serializedBills = bills.map((b) => ({
    ...b,
    date: b.date.toISOString(),
    dueDate: b.dueDate.toISOString(),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    lines: b.lines.map((l) => ({ ...l })),
    vendor: b.vendor,
  }))

  return <PODetail po={serializedPo} bills={serializedBills} entityId={entityId} />
}
