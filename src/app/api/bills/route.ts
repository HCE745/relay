import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { createAndEnterBill } from "@/lib/ap"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()
  const entityId = body.entityId

  // Resolve vendor — use existing id or create a new one from the scan result
  let vendorId: string = body.vendorId
  if (!vendorId && body.newVendorName) {
    const created = await prisma.vendor.create({
      data: { tenantId: session.tenantId, entityId, name: body.newVendorName },
    })
    vendorId = created.id
  }
  if (!vendorId) {
    return NextResponse.json({ error: "Vendor is required" }, { status: 400 })
  }

  const apAccount = await prisma.account.findFirst({
    where: { tenantId: session.tenantId, entityId, code: "2000" },
  })
  if (!apAccount) {
    return NextResponse.json({ error: "AP account not found" }, { status: 400 })
  }

  // Validate poId if provided
  let poId: string | null = body.poId ?? null
  if (poId) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, tenantId: session.tenantId, entityId },
    })
    if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 })
    if (!["OPEN", "PARTIALLY_RECEIVED"].includes(po.status)) {
      return NextResponse.json({ error: `PO is ${po.status} — cannot match bills` }, { status: 400 })
    }
  }

  let bill = await createAndEnterBill({
    tenantId: session.tenantId,
    entityId,
    vendorId,
    billNumber: body.billNumber,
    date: new Date(body.date),
    dueDate: new Date(body.dueDate),
    memo: body.memo,
    lines: body.lines,
    apAccountId: apAccount.id,
    createdByUserId: session.userId,
  })

  // Attach receipt URL and/or PO link
  const extraUpdates: Record<string, unknown> = {}
  if (body.receiptUrl) extraUpdates.receiptUrl = body.receiptUrl
  if (poId) extraUpdates.poId = poId

  if (Object.keys(extraUpdates).length > 0) {
    bill = await prisma.bill.update({ where: { id: bill.id }, data: extraUpdates })
  }

  // If linked to a PO, update PO status to PARTIALLY_RECEIVED (RECEIVED is set via receive route)
  if (poId) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
    if (po && po.status === "OPEN") {
      await prisma.purchaseOrder.update({
        where: { id: poId },
        data: { status: "PARTIALLY_RECEIVED" },
      })
    }
    const { writeAuditLog } = await import("@/lib/db")
    await writeAuditLog({
      tenantId: session.tenantId,
      entityId,
      userId: session.userId,
      action: "MATCH_BILL",
      tableName: "hce_purchase_orders",
      recordId: poId,
      after: { billId: bill.id, billTotal: bill.total },
    })
  }

  return NextResponse.json(bill)
}
