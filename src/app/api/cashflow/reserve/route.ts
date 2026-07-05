import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getAccountBalance } from "@/lib/ledger"
import { getPL } from "@/lib/reports"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function getEntityIdFromCookie(): Promise<string> {
  const cookieStore = await cookies()
  return cookieStore.get("hce-entity")?.value ?? ""
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

async function getDescendantIds(tenantId: string, entityId: string): Promise<string[]> {
  const all = await prisma.entity.findMany({ where: { tenantId } })
  const result = [entityId]
  const walk = (id: string) => {
    for (const e of all) if (e.parentEntityId === id) { result.push(e.id); walk(e.id) }
  }
  walk(entityId)
  return result
}

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { searchParams } = new URL(req.url)

  const entityId = searchParams.get("entityId") ?? (await getEntityIdFromCookie())
  const reserveMonths = Math.min(12, Math.max(1, parseInt(searchParams.get("reserveMonths") ?? "3")))
  const consolidated = searchParams.get("consolidated") === "true"

  const entity = await prisma.entity.findFirst({ where: { id: entityId, tenantId: session.tenantId } })
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 })

  const entityIds =
    consolidated && entity.isConsolidationParent
      ? await getDescendantIds(session.tenantId, entityId)
      : [entityId]

  // ── Current cash balance ─────────────────────────────────────────────────────
  const cashAccounts = await prisma.account.findMany({
    where: {
      tenantId: session.tenantId,
      entityId: { in: entityIds },
      type: "ASSET",
      OR: [
        { name: { contains: "cash", mode: "insensitive" } },
        { code: { in: ["1000", "1010"] } },
      ],
    },
  })
  let currentCashCents = 0
  for (const acc of cashAccounts) {
    currentCashCents += await getAccountBalance(session.tenantId, acc.entityId, acc.id)
  }

  // ── Average monthly operating expenses (last 3 complete months) ───────────────
  const now = new Date()
  let totalExpenses = 0
  for (let i = 1; i <= 3; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const pl = await getPL(session.tenantId, entityId, { start, end }, consolidated ? { consolidated } : undefined)
    totalExpenses += pl.totalExpenses + pl.totalCogs
  }
  const avgMonthlyExpensesCents = Math.round(totalExpenses / 3)
  const recommendedReserveCents = avgMonthlyExpensesCents * reserveMonths

  // ── AP obligations by horizon ─────────────────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day30 = addDays(today, 30)
  const day60 = addDays(today, 60)
  const day90 = addDays(today, 90)

  const openBills = await prisma.bill.findMany({
    where: {
      tenantId: session.tenantId,
      entityId: { in: entityIds },
      status: { in: ["ENTERED", "PARTIAL"] },
      dueDate: { lte: day90 },
    },
    select: { amountDue: true, dueDate: true },
  })

  let apDue30 = 0, apDue60 = 0, apDue90 = 0
  for (const bill of openBills) {
    const due = new Date(bill.dueDate)
    due.setHours(0, 0, 0, 0)
    if (due <= day30) apDue30 += bill.amountDue
    else if (due <= day60) apDue60 += bill.amountDue
    else apDue90 += bill.amountDue
  }

  const distributable30 = currentCashCents - recommendedReserveCents - apDue30
  const distributable60 = currentCashCents - recommendedReserveCents - apDue30 - apDue60
  const distributable90 = currentCashCents - recommendedReserveCents - apDue30 - apDue60 - apDue90

  return NextResponse.json({
    currentCashCents,
    avgMonthlyExpensesCents,
    reserveMonths,
    recommendedReserveCents,
    surplusOrShortfallCents: currentCashCents - recommendedReserveCents,
    apDue30Cents: apDue30,
    apDue60Cents: apDue60,
    apDue90Cents: apDue90,
    distributable: {
      horizon30: distributable30,
      horizon60: distributable60,
      horizon90: distributable90,
    },
    // Explicit breakdown so UI can show the math
    breakdown30: [
      { label: "Current cash", amountCents: currentCashCents },
      { label: `Recommended reserve (${reserveMonths} months × avg expenses)`, amountCents: -recommendedReserveCents },
      { label: "AP due next 30 days", amountCents: -apDue30 },
      { label: "Safe to distribute", amountCents: distributable30, total: true },
    ],
  })
}
