import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { payBill } from "@/lib/ap"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()

  // Resolve entity from the bill so accounts always match
  const bill = await prisma.bill.findUnique({
    where: { id: body.billId },
    select: { tenantId: true, entityId: true },
  })
  if (!bill || bill.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 })
  }
  const deny = assertAccess(session, bill.entityId, "post"); if (deny) return deny

  const [apAccount, cashAccount] = await Promise.all([
    prisma.account.findFirst({ where: { tenantId: bill.tenantId, entityId: bill.entityId, code: "2000" } }),
    prisma.account.findFirst({ where: { tenantId: bill.tenantId, entityId: bill.entityId, code: "1010" } }),
  ])
  if (!apAccount || !cashAccount) {
    return NextResponse.json({ error: "AP (2000) or cash (1010) account not found for this entity" }, { status: 400 })
  }

  try {
    const result = await payBill({
      billId: body.billId,
      amountCents: body.amountCents,
      date: new Date(body.date),
      cashAccountId: cashAccount.id,
      apAccountId: apAccount.id,
      memo: body.memo,
      createdByUserId: session.userId,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
