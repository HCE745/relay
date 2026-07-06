import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertEntityAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function getBudgetOrFail(id: string, tenantId: string) {
  const budget = await prisma.budget.findUnique({ where: { id } })
  if (!budget || budget.tenantId !== tenantId) return null
  return budget
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params

  const budget = await getBudgetOrFail(id, session.tenantId)
  if (!budget) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const entityDeny = assertEntityAccess(session, budget.entityId); if (entityDeny) return entityDeny

  const lines = await prisma.budgetLine.findMany({
    where: { budgetId: id },
    include: { account: { select: { id: true, code: true, name: true, type: true } } },
    orderBy: [{ account: { code: "asc" } }, { period: "asc" }],
  })

  return NextResponse.json(lines)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params

  const budget = await getBudgetOrFail(id, session.tenantId)
  if (!budget) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json()
  const lines = body.lines as { accountId: string; period: number; amountCents: number }[]

  if (!Array.isArray(lines)) {
    return NextResponse.json({ error: "lines must be an array" }, { status: 400 })
  }

  // Separate zero-amount rows (delete) from non-zero (upsert)
  const toDelete = lines.filter((l) => l.amountCents === 0)
  const toUpsert = lines.filter((l) => l.amountCents !== 0)

  await prisma.$transaction([
    // Delete zero-amount lines
    ...toDelete.map((l) =>
      prisma.budgetLine.deleteMany({
        where: { budgetId: id, accountId: l.accountId, period: l.period },
      }),
    ),
    // Upsert non-zero lines
    ...toUpsert.map((l) =>
      prisma.budgetLine.upsert({
        where: { budgetId_accountId_period: { budgetId: id, accountId: l.accountId, period: l.period } },
        create: { budgetId: id, accountId: l.accountId, period: l.period, amountCents: l.amountCents },
        update: { amountCents: l.amountCents },
      }),
    ),
  ])

  return NextResponse.json({ ok: true })
}
