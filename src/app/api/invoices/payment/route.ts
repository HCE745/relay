import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { recordInvoicePayment } from "@/lib/ar"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()

  // Resolve entity from the invoice so accounts match regardless of selected entity
  const inv = await prisma.invoice.findUnique({
    where: { id: body.invoiceId },
    select: { tenantId: true, entityId: true },
  })
  if (!inv || inv.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const [arAccount, cashAccount] = await Promise.all([
    prisma.account.findFirst({ where: { tenantId: inv.tenantId, entityId: inv.entityId, code: "1100" } }),
    prisma.account.findFirst({ where: { tenantId: inv.tenantId, entityId: inv.entityId, code: "1010" } }),
  ])
  if (!arAccount || !cashAccount) {
    return NextResponse.json({ error: "AR (1100) or cash (1010) account not found for this entity" }, { status: 400 })
  }

  try {
    const result = await recordInvoicePayment({
      invoiceId: body.invoiceId,
      amountCents: body.amountCents,
      date: new Date(body.date),
      cashAccountId: cashAccount.id,
      arAccountId: arAccount.id,
      memo: body.memo,
      createdByUserId: session.userId,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
