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

  // Auto-generate invoice number if the caller doesn't supply one
  let invoiceNumber = body.invoiceNumber as string | undefined
  if (!invoiceNumber) {
    const count = await prisma.invoice.count({ where: { tenantId: session.tenantId } })
    invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`
  }

  const invoice = await createInvoice({
    tenantId: session.tenantId,
    entityId: body.entityId,
    customerId: body.customerId,
    invoiceNumber,
    date: new Date(body.date),
    dueDate: new Date(body.dueDate),
    memo: body.memo,
    taxRate: body.taxRate,
    lines: body.lines,
    createdByUserId: session.userId,
  })

  return NextResponse.json(invoice)
}
