import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { sendInvoice } from "@/lib/ar"
import { prisma } from "@/lib/prisma"
import { getSelectedEntityId } from "@/lib/entity-context"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const { invoiceId } = await req.json()
  const entityId = await getSelectedEntityId()

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
