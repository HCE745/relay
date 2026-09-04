import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import type { RecurringType, RecurringFrequency } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get("entityId") ?? ""
  const deny = assertAccess(session, entityId, "read"); if (deny) return deny

  const templates = await prisma.recurringTemplate.findMany({
    where: { tenantId: session.tenantId, entityId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()

  const { name, type, frequency, startDate, endDate, payload, entityId } = body as {
    name: string
    type: RecurringType
    frequency: RecurringFrequency
    startDate: string
    endDate?: string
    entityId: string
    payload: {
      vendorId?: string
      customerId?: string
      apAccountId?: string
      arAccountId?: string
      lines: { accountId: string; description?: string; amount: number; debit?: number; credit?: number }[]
      memo?: string
    }
  }

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })
  if (!type) return NextResponse.json({ error: "type is required" }, { status: 400 })
  if (!frequency) return NextResponse.json({ error: "frequency is required" }, { status: 400 })
  if (!startDate) return NextResponse.json({ error: "startDate is required" }, { status: 400 })
  if (!entityId) return NextResponse.json({ error: "entityId is required" }, { status: 400 })
  if (!payload?.lines?.length) return NextResponse.json({ error: "At least one line is required" }, { status: 400 })

  if (type === "BILL") {
    if (!payload.vendorId) return NextResponse.json({ error: "vendorId required for BILL" }, { status: 400 })
    if (!payload.apAccountId) return NextResponse.json({ error: "apAccountId required for BILL" }, { status: 400 })
  }
  if (type === "INVOICE") {
    if (!payload.customerId) return NextResponse.json({ error: "customerId required for INVOICE" }, { status: 400 })
    if (!payload.arAccountId) return NextResponse.json({ error: "arAccountId required for INVOICE" }, { status: 400 })
  }

  const template = await prisma.recurringTemplate.create({
    data: {
      tenantId: session.tenantId,
      entityId,
      name,
      type,
      frequency,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      nextRunDate: new Date(startDate),
      active: true,
      payload,
    },
  })

  return NextResponse.json(template, { status: 201 })
}
