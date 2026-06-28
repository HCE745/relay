import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { createInvoice, sendInvoice } from "@/lib/ar"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get("entityId") ?? ""
  const status = searchParams.get("status")

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId: session.tenantId,
      entityId,
      ...(status ? { status: status as never } : {}),
    },
    include: { customer: true, lines: true },
    orderBy: { date: "desc" },
    take: 100,
  })

  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()

  const invoice = await createInvoice({
    tenantId: session.tenantId,
    entityId: body.entityId,
    customerId: body.customerId,
    invoiceNumber: body.invoiceNumber,
    date: new Date(body.date),
    dueDate: new Date(body.dueDate),
    memo: body.memo,
    taxRate: body.taxRate,
    lines: body.lines,
    createdByUserId: session.userId,
  })

  return NextResponse.json(invoice)
}
