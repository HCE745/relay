export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
async function requireSales() {
  const s = await getSession()
  return s?.superAdmin || s?.salesUserId ? s : null
}

function isManager(session: Awaited<ReturnType<typeof requireSales>>) {
  return session?.superAdmin || session?.salesUserRole === "admin_sales"
}

// GET /api/sales/goals?period=monthly&userId=
export async function GET(req: NextRequest) {
  const session = await requireSales()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const period = searchParams.get("period") ?? undefined
  const userId = searchParams.get("userId") ?? undefined

  const where: Record<string, unknown> = {}
  if (period) where.period = period
  if (userId) {
    where.salesUserId = userId === "team" ? null : userId
  } else if (!isManager(session)) {
    // Reps see only their own goals
    where.OR = [
      { salesUserId: session.salesUserId },
      { salesUserId: null }, // team-wide goals
    ]
  }

  const goals = await prisma.salesGoal.findMany({
    where,
    include: { salesUser: { select: { id: true, name: true } } },
    orderBy: [{ period: "asc" }, { startDate: "desc" }],
  })

  return NextResponse.json({ goals })
}

// POST /api/sales/goals — create a goal (managers only)
export async function POST(req: NextRequest) {
  const session = await requireSales()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isManager(session)) return NextResponse.json({ error: "Managers only" }, { status: 403 })

  const body = await req.json() as {
    salesUserId?: string | null
    metric:       string
    period:       string
    targetValue:  number
    startDate:    string
    endDate:      string
    notes?:       string
  }

  const VALID_METRICS = ["emailsSent", "prospectsAdded", "demosLogged", "opportunitiesCreated", "revenueWon", "dealsWon", "callsMade", "prospectsContacted"]
  const VALID_PERIODS = ["daily", "weekly", "monthly", "quarterly"]

  if (!VALID_METRICS.includes(body.metric)) return NextResponse.json({ error: "Invalid metric" }, { status: 400 })
  if (!VALID_PERIODS.includes(body.period)) return NextResponse.json({ error: "Invalid period" }, { status: 400 })
  if (!body.targetValue || body.targetValue <= 0)  return NextResponse.json({ error: "targetValue must be > 0" }, { status: 400 })
  if (!body.startDate || !body.endDate) return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 })

  const goal = await prisma.salesGoal.create({
    data: {
      salesUserId:          body.salesUserId ?? null,
      metric:               body.metric,
      period:               body.period,
      targetValue:          body.targetValue,
      startDate:            new Date(body.startDate),
      endDate:              new Date(body.endDate),
      notes:                body.notes ?? null,
      createdBySalesUserId: session.salesUserId ?? null,
    },
    include: { salesUser: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ goal }, { status: 201 })
}
