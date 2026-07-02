import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import type { AmortizationType } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get("entityId") ?? ""

  const schedules = await prisma.amortizationSchedule.findMany({
    where: { tenantId: session.tenantId, entityId },
    include: {
      entries: {
        select: { id: true, posted: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(schedules)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()

  const { name, type, totalAmountCents, startDate, months, bsAccountId, plAccountId, entityId } = body as {
    name: string
    type: AmortizationType
    totalAmountCents: number
    startDate: string
    months: number
    bsAccountId: string
    plAccountId: string
    entityId: string
  }

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })
  if (!type) return NextResponse.json({ error: "type is required" }, { status: 400 })
  if (!totalAmountCents || totalAmountCents <= 0) return NextResponse.json({ error: "totalAmountCents must be positive" }, { status: 400 })
  if (!startDate) return NextResponse.json({ error: "startDate is required" }, { status: 400 })
  if (!months || months <= 0) return NextResponse.json({ error: "months must be positive" }, { status: 400 })
  if (!bsAccountId) return NextResponse.json({ error: "bsAccountId is required" }, { status: 400 })
  if (!plAccountId) return NextResponse.json({ error: "plAccountId is required" }, { status: 400 })
  if (!entityId) return NextResponse.json({ error: "entityId is required" }, { status: 400 })

  const baseAmount = Math.floor(totalAmountCents / months)
  const remainder = totalAmountCents - baseAmount * months

  const start = new Date(startDate)

  const schedule = await prisma.amortizationSchedule.create({
    data: {
      tenantId: session.tenantId,
      entityId,
      name,
      type,
      totalAmountCents,
      startDate: start,
      months,
      bsAccountId,
      plAccountId,
      status: "ACTIVE",
      entries: {
        create: Array.from({ length: months }, (_, i) => {
          const periodDate = new Date(start)
          periodDate.setMonth(periodDate.getMonth() + i)
          const isLast = i === months - 1
          return {
            periodNumber: i + 1,
            periodDate,
            amountCents: isLast ? baseAmount + remainder : baseAmount,
            posted: false,
          }
        }),
      },
    },
    include: { entries: { orderBy: { periodNumber: "asc" } } },
  })

  return NextResponse.json(schedule, { status: 201 })
}
