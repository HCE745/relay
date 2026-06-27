import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { createAndEnterBill } from "@/lib/ap"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()
  const entityId = body.entityId

  const apAccount = await prisma.account.findFirst({
    where: { tenantId: session.tenantId, entityId, code: "2000" },
  })
  if (!apAccount) {
    return NextResponse.json({ error: "AP account not found" }, { status: 400 })
  }

  const bill = await createAndEnterBill({
    tenantId: session.tenantId,
    entityId,
    vendorId: body.vendorId,
    billNumber: body.billNumber,
    date: new Date(body.date),
    dueDate: new Date(body.dueDate),
    memo: body.memo,
    lines: body.lines,
    apAccountId: apAccount.id,
    createdByUserId: session.userId,
  })

  return NextResponse.json(bill)
}
