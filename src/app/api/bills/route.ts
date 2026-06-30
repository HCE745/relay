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

  // Attach receipt URL if the scan uploaded one to Vercel Blob
  if (body.receiptUrl) {
    bill = await prisma.bill.update({
      where: { id: bill.id },
      data: { receiptUrl: body.receiptUrl },
    })
  }

  return NextResponse.json(bill)
}
