import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { getSelectedEntityId } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import type { BudgetPeriodType } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get("entityId") ?? (await getSelectedEntityId())
  const deny = assertAccess(session, entityId, "read"); if (deny) return deny

  const budgets = await prisma.budget.findMany({
    where: { tenantId: session.tenantId, entityId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(budgets)
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()

  const { name, fiscalYear, periodType, entityId } = body as {
    name: string
    fiscalYear: number
    periodType: BudgetPeriodType
    entityId: string
  }

  if (!name || !fiscalYear || !periodType || !entityId) {
    return NextResponse.json({ error: "name, fiscalYear, periodType, and entityId are required" }, { status: 400 })
  }

  const budget = await prisma.budget.create({
    data: {
      tenantId: session.tenantId,
      entityId,
      name,
      fiscalYear: Number(fiscalYear),
      periodType,
    },
  })

  return NextResponse.json(budget, { status: 201 })
}
