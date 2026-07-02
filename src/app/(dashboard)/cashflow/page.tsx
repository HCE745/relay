import { getEntityContext } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { getAccountBalance } from "@/lib/ledger"
import { CashFlowDashboard } from "@/components/cashflow/CashFlowDashboard"

export const dynamic = "force-dynamic"

export default async function CashFlowPage() {
  const { tenantId, entityId, selectedEntity } = await getEntityContext()

  let initialData = null
  try {
    initialData = await fetchForecast(tenantId, entityId, "weekly", 13, false)
  } catch (e) {
    // Non-fatal: client will fetch on mount
    console.error("SSR cashflow fetch failed", e)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cash Flow Forecast</h1>
        <p className="text-sm text-gray-500 mt-1">
          {selectedEntity?.name ?? "Entity"} — projected cash position
        </p>
      </div>
      <CashFlowDashboard
        entityId={entityId}
        isConsolidationParent={selectedEntity?.isConsolidationParent ?? false}
        initialData={initialData}
      />
    </div>
  )
}

// ─── Server-side data helper ──────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

async function fetchForecast(
  tenantId: string,
  entityId: string,
  mode: "weekly" | "monthly",
  periods: number,
  consolidated: boolean,
) {
  const entity = await prisma.entity.findFirstOrThrow({ where: { id: entityId, tenantId } })

  const entityIds: string[] = [entityId]
  if (consolidated && entity.isConsolidationParent) {
    const all = await prisma.entity.findMany({ where: { tenantId } })
    const walk = (id: string) => {
      for (const e of all) {
        if (e.parentEntityId === id) {
          entityIds.push(e.id)
          walk(e.id)
        }
      }
    }
    walk(entityId)
  }

  const cashAccounts = await prisma.account.findMany({
    where: {
      tenantId,
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
    currentCash += await getAccountBalance(tenantId, acc.entityId, acc.id)
  }

  const openInvoices = await prisma.invoice.findMany({
    where: { tenantId, entityId: { in: entityIds }, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
  })
  const openBills = await prisma.bill.findMany({
    where: { tenantId, entityId: { in: entityIds }, status: { in: ["ENTERED", "PARTIAL"] } },
  })
  const today = startOfDay(new Date())
  const adjustments = await prisma.cashForecastAdjustment.findMany({
    where: { tenantId, entityId: { in: entityIds }, date: { gte: today } },
    orderBy: { date: "asc" },
  })

  const buckets: {
    label: string; start: string; end: string
    arInflows: number; apOutflows: number; adjustments: number
    netFlow: number; projectedBalance: number
  }[] = []

  let running = currentCash
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
      end = new Date(today.getFullYear(), today.getMonth() + i + 1, 0)
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
    running += netFlow
    buckets.push({
      label,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      arInflows, apOutflows, adjustments: adjNet, netFlow, projectedBalance: running,
    })
  }

  const monthlyFlows: number[] =
    mode === "monthly"
      ? buckets.map((b) => b.netFlow)
      : (() => {
          const r: number[] = []
          for (let i = 0; i < buckets.length; i += 4)
            r.push(buckets.slice(i, i + 4).reduce((s, b) => s + b.netFlow, 0))
          return r
        })()

  const neg = monthlyFlows.filter((n) => n < 0)
  const avgMonthlyBurn = neg.length ? neg.reduce((s, n) => s + n, 0) / neg.length : 0
  const runwayMonths =
    avgMonthlyBurn < 0 && currentCash > 0
      ? Math.round((currentCash / Math.abs(avgMonthlyBurn)) * 10) / 10
      : null

  return {
    currentCash,
    periods: buckets,
    avgMonthlyBurn: Math.round(avgMonthlyBurn),
    runwayMonths,
    isConsolidationParent: entity.isConsolidationParent,
  }
}
