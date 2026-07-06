import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { sendInvoice } from "@/lib/ar"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const { invoiceId } = await req.json()

  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { entityId: true, tenantId: true } })
  if (!inv || inv.tenantId !== session.tenantId) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const deny = assertAccess(session, inv.entityId, "post"); if (deny) return deny
  const entityId = inv.entityId

  const arAccount = await prisma.account.findFirst({
    where: { tenantId: session.tenantId, entityId, code: "1100" },
  })
  const taxAccount = await prisma.account.findFirst({
    where: { tenantId: session.tenantId, entityId, code: "2100" },
  })

  if (!arAccount) {
    return NextResponse.json({ error: "AR account not found" }, { status: 400 })
  }

  const invoice = await sendInvoice({
    invoiceId,
    arAccountId: arAccount.id,
    salesTaxPayableAccountId: taxAccount?.id,
    createdByUserId: session.userId,
  })

  return NextResponse.json(invoice)
}
