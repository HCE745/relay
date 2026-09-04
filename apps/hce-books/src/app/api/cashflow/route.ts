import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { getAccountBalance } from "@/lib/ledger"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ─── helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function weekLabel(start: Date): string {
  return start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

async function getDescendantEntityIds(tenantId: string, entityId: string): Promise<string[]> {
  const all = await prisma.entity.findMany({ where: { tenantId } })
  const result: string[] = [entityId]
  const walk = (id: string) => {
    for (const e of all) {
      if (e.parentEntityId === id) {
        result.push(e.id)
        walk(e.id)
      }
    }
  }
  walk(entityId)
  return result
}

/** Group weekly net flows into monthly chunks for burn averaging. */
function chunkBurns(flows: number[], chunkSize: number): number[] {
  const result: number[] = []
  for (let i = 0; i < flows.length; i += chunkSize) {
    result.push(flows.slice(i, i + chunkSize).reduce((s, n) => s + n, 0))
  }
  return result
}

// ─── GET /api/cashflow ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { searchParams } = new URL(req.url)

  const entityId = searchParams.get("entityId") ?? ""
  const deny = assertAccess(session, entityId, "read"); if (deny) return deny
  const mode = (searchParams.get("mode") ?? "weekly") as "weekly" | "monthly"
  const periods = parseInt(searchParams.get("periods") ?? (mode === "weekly" ? "13" : "12"), 10)
  const consolidated = searchParams.get("consolidated") === "true"

  // Verify entity belongs to this tenant
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, tenantId: session.tenantId },
  })
  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 })
  }

  const entityIds =
    consolidated && entity.isConsolidationParent
      ? await getDescendantEntityIds(session.tenantId, entityId)
      : [entityId]

  // 1. Current cash balance — find all ASSET accounts with cash-like names/codes
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

  let currentCash = 0
  for (const acc of cashAccounts) {
    const balance = await getAccountBalance(session.tenantId, acc.entityId, acc.id)
    currentCash += balance
  }

  // 2. Open AR invoices
  const openInvoices = await prisma.invoice.findMany({
    where: {
      tenantId: session.tenantId,
      entityId: { in: entityIds },
      status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
    },
  })

  // 3. Open AP bills
  const openBills = await prisma.bill.findMany({
    where: {
      tenantId: session.tenantId,
      entityId: { in: entityIds },
      status: { in: ["ENTERED", "PARTIAL"] },
    },
  })

  // 4. Future adjustments
  const today = startOfDay(new Date())
  const adjustments = await prisma.cashForecastAdjustment.findMany({
    where: {
      tenantId: session.tenantId,
      entityId: { in: entityIds },
      date: { gte: today },
    },
    orderBy: { date: "asc" },
  })

  // 5. Build period buckets
  type Bucket = {
    label: string
    start: Date
    end: Date
    arInflows: number
    apOutflows: number
    adjustments: number
    netFlow: number
    projectedBalance: number
  }

  const buckets: Bucket[] = []

  for (let i = 0; i < periods; i++) {
    let start: Date
    let end: Date
    let label: string

    if (mode === "weekly") {
      start = addDays(today, i * 7)
      end = addDays(start, 6)
      label = `Wk ${weekLabel(start)}`
    } else {
      start = new Date(today.getFullYear(), today.getMonth() + i, 1)
      end = new Date(today.getFullYear(), today.getMonth() + i + 1, 0) // last day of month
      label = monthLabel(start)
    }

    let arInflows = 0
    for (const inv of openInvoices) {
      const d = startOfDay(new Date(inv.dueDate))
      if (d >= start && d <= end) arInflows += inv.amountDue
    }

    let apOutflows = 0
    for (const bill of openBills) {
      const d = startOfDay(new Date(bill.dueDate))
      if (d >= start && d <= end) apOutflows += bill.amountDue
    }

    let adjNet = 0
    for (const a of adjustments) {
      const d = startOfDay(new Date(a.date))
      if (d >= start && d <= end) adjNet += a.amountCents
    }

    const netFlow = arInflows - apOutflows + adjNet
    buckets.push({ label, start, end, arInflows, apOutflows, adjustments: adjNet, netFlow, projectedBalance: 0 })
  }

  // 6. Running projected balance (cumulative)
  let running = currentCash
  for (const b of buckets) {
    running += b.netFlow
    b.projectedBalance = running
  }

  // 7. Runway calculation — compute average monthly burn from negative-only net flows
  const monthlyNetFlows =
    mode === "monthly"
      ? buckets.map((b) => b.netFlow)
      : chunkBurns(buckets.map((b) => b.netFlow), 4)

  const negativeBurns = monthlyNetFlows.filter((n) => n < 0)
  const avgMonthlyBurn =
    negativeBurns.length > 0
      ? negativeBurns.reduce((s, n) => s + n, 0) / negativeBurns.length
      : 0

  let runwayMonths: number | null = null
  if (avgMonthlyBurn < 0 && currentCash > 0) {
    runwayMonths = Math.round((currentCash / Math.abs(avgMonthlyBurn)) * 10) / 10
  }

  const serializedPeriods = buckets.map((b) => ({
    ...b,
    start: b.start.toISOString().slice(0, 10),
    end: b.end.toISOString().slice(0, 10),
  }))

  return NextResponse.json({
    currentCash,
    periods: serializedPeriods,
    avgMonthlyBurn: Math.round(avgMonthlyBurn),
    runwayMonths,
    isConsolidationParent: entity.isConsolidationParent,
  })
}
