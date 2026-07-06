import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { getAccountBalance } from "@/lib/ledger"
import { getPL } from "@/lib/reports"
import { cookies } from "next/headers"
import type { BudgetPeriodType } from "@/generated/prisma/client"

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

function periodDateRange(
  fiscalYear: number,
  periodType: BudgetPeriodType,
  period: number,
): { start: Date; end: Date } {
  if (periodType === "MONTHLY") {
    return {
      start: new Date(fiscalYear, period - 1, 1),
      end: new Date(fiscalYear, period, 0, 23, 59, 59, 999),
    }
  }
  if (periodType === "QUARTERLY") {
    const sm = (period - 1) * 3
    return {
      start: new Date(fiscalYear, sm, 1),
      end: new Date(fiscalYear, sm + 3, 0, 23, 59, 59, 999),
    }
  }
  return {
    start: new Date(fiscalYear, 0, 1),
    end: new Date(fiscalYear, 11, 31, 23, 59, 59, 999),
  }
}

function currentPeriodNumber(periodType: BudgetPeriodType): number {
  const m = new Date().getMonth() + 1 // 1-12
  if (periodType === "MONTHLY") return m
  if (periodType === "QUARTERLY") return Math.ceil(m / 3)
  return 1
}

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { searchParams } = new URL(req.url)

  const entityId = searchParams.get("entityId") ?? (await getEntityIdFromCookie())
  const deny = assertAccess(session, entityId, "read"); if (deny) return deny
  const consolidated = searchParams.get("consolidated") === "true"
  const reserveMonths = parseInt(searchParams.get("reserveMonths") ?? "3")

  const entity = await prisma.entity.findFirst({ where: { id: entityId, tenantId: session.tenantId } })
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 })

  const entityIds =
    consolidated && entity.isConsolidationParent
      ? await getDescendantIds(session.tenantId, entityId)
      : [entityId]
  const plOpts = consolidated ? { consolidated: true } : undefined

  const now = new Date()
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const mtdEnd = now
  const ytdStart = new Date(now.getFullYear(), 0, 1)

  const priorMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const priorMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  // ── Parallel data fetch ───────────────────────────────────────────────────────
  const [plMTD, plYTD, plPrior, cashAccounts, openBills, anomalies] = await Promise.all([
    getPL(session.tenantId, entityId, { start: mtdStart, end: mtdEnd }, plOpts),
    getPL(session.tenantId, entityId, { start: ytdStart, end: mtdEnd }, plOpts),
    getPL(session.tenantId, entityId, { start: priorMonthStart, end: priorMonthEnd }, plOpts),
    prisma.account.findMany({
      where: {
        tenantId: session.tenantId,
        entityId: { in: entityIds },
        type: "ASSET",
        OR: [
          { name: { contains: "cash", mode: "insensitive" } },
          { code: { in: ["1000", "1010"] } },
        ],
      },
    }),
    prisma.bill.findMany({
      where: {
        tenantId: session.tenantId,
        entityId: { in: entityIds },
        status: { in: ["ENTERED", "PARTIAL"] },
        dueDate: { lte: addDays(now, 90) },
      },
      select: { amountDue: true, dueDate: true },
    }),
    prisma.anomalyFlag.findMany({
      where: { tenantId: session.tenantId, entityId, status: "OPEN" },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
  ])

  // ── Current cash ──────────────────────────────────────────────────────────────
  let currentCashCents = 0
  for (const acc of cashAccounts) {
    currentCashCents += await getAccountBalance(session.tenantId, acc.entityId, acc.id)
  }

  // ── Cash reserve calculation ──────────────────────────────────────────────────
  let totalHistoricalExpenses = 0
  for (let i = 1; i <= 3; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const pl = await getPL(session.tenantId, entityId, { start, end }, plOpts)
    totalHistoricalExpenses += pl.totalExpenses + pl.totalCogs
  }
  const avgMonthlyExpensesCents = Math.round(totalHistoricalExpenses / 3)
  const recommendedReserveCents = avgMonthlyExpensesCents * reserveMonths

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day30 = addDays(today, 30)
  const day60 = addDays(today, 60)
  let apDue30 = 0, apDue60 = 0, apDue90 = 0
  for (const bill of openBills) {
    const due = new Date(bill.dueDate)
    due.setHours(0, 0, 0, 0)
    if (due <= day30) apDue30 += bill.amountDue
    else if (due <= day60) apDue60 += bill.amountDue
    else apDue90 += bill.amountDue
  }
  const distributableCents = currentCashCents - recommendedReserveCents - apDue30

  // ── Cashflow runway ───────────────────────────────────────────────────────────
  // Use recent monthly burn (last 3 months)
  const monthlyBurns = []
  for (let i = 1; i <= 3; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const pl = await getPL(session.tenantId, entityId, { start, end }, plOpts)
    monthlyBurns.push(-pl.netIncome) // burn = negative net income
  }
  const avgBurn = monthlyBurns.filter((b) => b > 0).length > 0
    ? monthlyBurns.filter((b) => b > 0).reduce((s, b) => s + b, 0) / monthlyBurns.filter((b) => b > 0).length
    : null
  const runwayMonths = avgBurn && avgBurn > 0 && currentCashCents > 0
    ? Math.round((currentCashCents / avgBurn) * 10) / 10
    : null

  // ── Budget snapshot (current period) ─────────────────────────────────────────
  type BudgetSnapshot = {
    budgetId: string
    budgetName: string
    currentPeriod: number
    totalBudgeted: number
    totalActual: number
    topVariances: {
      accountId: string
      accountName: string
      accountCode: string
      accountType: string
      budgeted: number
      actual: number
      variance: number
      variancePct: number | null
    }[]
  }

  let budgetSnapshot: BudgetSnapshot | null = null
  try {
    const currentYear = now.getFullYear()
    const budget = await prisma.budget.findFirst({
      where: { tenantId: session.tenantId, entityId, fiscalYear: currentYear },
      orderBy: { createdAt: "desc" },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true, type: true } } },
        },
      },
    })

    if (budget) {
      const currentPeriod = currentPeriodNumber(budget.periodType)
      const { start: pStart, end: pEnd } = periodDateRange(budget.fiscalYear, budget.periodType, currentPeriod)

      const entries = await prisma.journalEntry.findMany({
        where: {
          tenantId: session.tenantId,
          entityId: { in: entityIds },
          status: "POSTED",
          date: { gte: pStart, lte: pEnd },
        },
        include: {
          lines: {
            include: { account: { select: { id: true, type: true } } },
            where: { account: { type: { in: ["INCOME", "EXPENSE"] } } },
          },
        },
      })

      const actualsByAccount = new Map<string, number>()
      for (const entry of entries) {
        for (const line of entry.lines) {
          const prev = actualsByAccount.get(line.accountId) ?? 0
          const amt = line.account.type === "INCOME" ? line.credit - line.debit : line.debit - line.credit
          actualsByAccount.set(line.accountId, prev + amt)
        }
      }

      const periodLines = budget.lines.filter((l) => l.period === currentPeriod)
      let totalBudgeted = 0, totalActual = 0
      const variances = periodLines.map((l) => {
        const actual = actualsByAccount.get(l.accountId) ?? 0
        const variance = actual - l.amountCents
        totalBudgeted += l.amountCents
        totalActual += actual
        return {
          accountId: l.accountId,
          accountName: l.account.name,
          accountCode: l.account.code,
          accountType: l.account.type,
          budgeted: l.amountCents,
          actual,
          variance,
          variancePct: l.amountCents !== 0 ? (variance / Math.abs(l.amountCents)) * 100 : null,
        }
      })

      variances.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      budgetSnapshot = {
        budgetId: budget.id,
        budgetName: budget.name,
        currentPeriod,
        totalBudgeted,
        totalActual,
        topVariances: variances.slice(0, 5),
      }
    }
  } catch {
    // Non-fatal; budget snapshot is optional
  }

  // ── Rule-based alerts ─────────────────────────────────────────────────────────
  type Alert = { type: string; title: string; message: string; severity: "HIGH" | "MEDIUM" | "LOW"; linkHref?: string }
  const alerts: Alert[] = []

  // Alert 1: Cash below recommended reserve
  if (currentCashCents < recommendedReserveCents) {
    const shortfall = recommendedReserveCents - currentCashCents
    alerts.push({
      type: "CASH_BELOW_RESERVE",
      title: "Cash Below Reserve",
      message: `Cash is $${(shortfall / 100).toFixed(0)} below the ${reserveMonths}-month operating reserve of $${(recommendedReserveCents / 100).toFixed(0)}.`,
      severity: "HIGH",
      linkHref: "/cashflow",
    })
  }

  // Alert 2: Expense spike vs prior month (threshold: 15%)
  const expenseChangePct = plPrior.totalExpenses > 0
    ? ((plMTD.totalExpenses - plPrior.totalExpenses) / plPrior.totalExpenses) * 100
    : 0
  if (expenseChangePct > 15 && plPrior.totalExpenses > 0) {
    alerts.push({
      type: "EXPENSE_SPIKE",
      title: "Expense Spike",
      message: `MTD expenses ($${(plMTD.totalExpenses / 100).toFixed(0)}) are ${expenseChangePct.toFixed(0)}% above last month ($${(plPrior.totalExpenses / 100).toFixed(0)}).`,
      severity: expenseChangePct > 30 ? "HIGH" : "MEDIUM",
      linkHref: "/reports",
    })
  }

  // Alert 3: Large AP due in 30 days (threshold: $5,000)
  if (apDue30 > 500000) {
    alerts.push({
      type: "LARGE_AP_DUE",
      title: "Large AP Due",
      message: `$${(apDue30 / 100).toFixed(0)} in bills due in the next 30 days.`,
      severity: apDue30 > 1000000 ? "HIGH" : "MEDIUM",
      linkHref: "/bills",
    })
  }

  // Alert 4: Budget overrun (threshold: 10% over on any line)
  if (budgetSnapshot) {
    const overruns = budgetSnapshot.topVariances.filter(
      (v) => v.accountType === "EXPENSE" && v.variancePct !== null && v.variancePct < -10,
    )
    if (overruns.length > 0) {
      const worst = overruns[0]
      alerts.push({
        type: "BUDGET_OVERRUN",
        title: "Budget Overrun",
        message: `${worst.accountName} is ${Math.abs(worst.variancePct ?? 0).toFixed(0)}% over budget this period.`,
        severity: "MEDIUM",
        linkHref: "/budgets",
      })
    }
  }

  // Alert 5: Low runway
  if (runwayMonths !== null && runwayMonths < 6) {
    alerts.push({
      type: "LOW_RUNWAY",
      title: "Low Cash Runway",
      message: `Estimated runway is ${runwayMonths} month${runwayMonths === 1 ? "" : "s"} based on recent burn rate.`,
      severity: runwayMonths < 3 ? "HIGH" : "MEDIUM",
      linkHref: "/cashflow",
    })
  }

  return NextResponse.json({
    entityId,
    entityName: entity.name,
    isConsolidationParent: entity.isConsolidationParent,
    asOf: now.toISOString(),

    // KPIs
    currentCashCents,
    revenueMTDCents: plMTD.totalRevenue,
    revenueYTDCents: plYTD.totalRevenue,
    expensesMTDCents: plMTD.totalExpenses,
    expensesYTDCents: plYTD.totalExpenses,
    profitMTDCents: plMTD.netIncome,
    profitYTDCents: plYTD.netIncome,
    runwayMonths,

    // Cash reserve
    avgMonthlyExpensesCents,
    reserveMonths,
    recommendedReserveCents,
    surplusOrShortfallCents: currentCashCents - recommendedReserveCents,
    apDue30Cents: apDue30,
    apDue60Cents: apDue60,
    apDue90Cents: apDue90,
    distributableCents,

    // Budget snapshot
    budgetSnapshot,

    // Anomalies (top 10 open)
    anomalies: anomalies.map((a) => ({
      id: a.id,
      reason: a.reason,
      severity: a.severity,
      sourceType: a.sourceType,
      sourceId: a.sourceId,
      createdAt: a.createdAt.toISOString(),
    })),

    // Rule-based alerts
    alerts,
  })
}
