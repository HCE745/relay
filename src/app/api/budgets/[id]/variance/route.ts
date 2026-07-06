import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertEntityAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { toCsv } from "@/lib/reports"
import type { BudgetPeriodType } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function getPeriodCount(periodType: BudgetPeriodType): number {
  if (periodType === "MONTHLY") return 12
  if (periodType === "QUARTERLY") return 4
  return 1
}

function getPeriodLabels(periodType: BudgetPeriodType): string[] {
  if (periodType === "MONTHLY") {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  }
  if (periodType === "QUARTERLY") {
    return ["Q1", "Q2", "Q3", "Q4"]
  }
  return ["Annual"]
}

function getPeriodDateRange(fiscalYear: number, periodType: BudgetPeriodType, period: number): { start: Date; end: Date } {
  if (periodType === "MONTHLY") {
    // period is 1-based month
    const start = new Date(fiscalYear, period - 1, 1)
    const end = new Date(fiscalYear, period, 0, 23, 59, 59, 999)
    return { start, end }
  }
  if (periodType === "QUARTERLY") {
    // period is 1-based quarter (1=Q1, 2=Q2, 3=Q3, 4=Q4)
    const startMonth = (period - 1) * 3
    const start = new Date(fiscalYear, startMonth, 1)
    const end = new Date(fiscalYear, startMonth + 3, 0, 23, 59, 59, 999)
    return { start, end }
  }
  // Annual
  const start = new Date(fiscalYear, 0, 1)
  const end = new Date(fiscalYear, 11, 31, 23, 59, 59, 999)
  return { start, end }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params
  const { searchParams } = new URL(req.url)

  const consolidated = searchParams.get("consolidated") === "true"
  const format = searchParams.get("format")
  const fromPeriod = searchParams.get("fromPeriod") ? Number(searchParams.get("fromPeriod")) : null
  const toPeriod = searchParams.get("toPeriod") ? Number(searchParams.get("toPeriod")) : null

  // Load budget with all lines and account details
  const budget = await prisma.budget.findUnique({
    where: { id },
    include: {
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true, type: true } },
        },
      },
    },
  })

  if (!budget || budget.tenantId !== session.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const entityDeny = assertEntityAccess(session, budget.entityId); if (entityDeny) return entityDeny

  const totalPeriods = getPeriodCount(budget.periodType)
  const periodLabels = getPeriodLabels(budget.periodType)

  const startPeriod = fromPeriod ?? 1
  const endPeriod = toPeriod ?? totalPeriods

  // Build a map: accountId -> period -> budgeted amount
  const budgetMap = new Map<string, Map<number, number>>()
  const accountMeta = new Map<string, { code: string; name: string; type: string }>()

  for (const line of budget.lines) {
    if (!budgetMap.has(line.accountId)) {
      budgetMap.set(line.accountId, new Map())
    }
    budgetMap.get(line.accountId)!.set(line.period, line.amountCents)
    accountMeta.set(line.accountId, {
      code: line.account.code,
      name: line.account.name,
      type: line.account.type,
    })
  }

  // Resolve entity IDs for consolidated mode
  let entityIds = [budget.entityId]
  if (consolidated) {
    const all = await prisma.entity.findMany({ where: { tenantId: budget.tenantId } })
    const result = [budget.entityId]
    const walk = (id: string) => {
      for (const child of all.filter((e) => e.parentEntityId === id)) {
        result.push(child.id)
        walk(child.id)
      }
    }
    walk(budget.entityId)
    entityIds = result
  }

  // Fetch actuals using journal lines for accurate accountId mapping
  const actualsByPeriodById = new Map<number, Map<string, number>>()

  for (let p = startPeriod; p <= endPeriod; p++) {
    const dateRange = getPeriodDateRange(budget.fiscalYear, budget.periodType, p)

    const entries = await prisma.journalEntry.findMany({
      where: {
        tenantId: budget.tenantId,
        entityId: { in: entityIds },
        status: "POSTED",
        date: { gte: dateRange.start, lte: dateRange.end },
      },
      include: {
        lines: {
          include: { account: true },
          where: { account: { type: { in: ["INCOME", "EXPENSE"] } } },
        },
      },
    })

    const periodActuals = new Map<string, number>()
    for (const entry of entries) {
      for (const line of entry.lines) {
        const existing = periodActuals.get(line.accountId) ?? 0
        // Income: credit - debit; Expense: debit - credit
        const amount =
          line.account.type === "INCOME"
            ? line.credit - line.debit
            : line.debit - line.credit
        periodActuals.set(line.accountId, existing + amount)

        // Track account meta
        if (!accountMeta.has(line.accountId)) {
          accountMeta.set(line.accountId, {
            code: line.account.code,
            name: line.account.name,
            type: line.account.type,
          })
        }
      }
    }

    actualsByPeriodById.set(p, periodActuals)
  }

  // Union of all accountIds (budgeted or actual)
  const allAccountIds = new Set<string>([...budgetMap.keys()])
  for (const [, periodMap] of actualsByPeriodById) {
    for (const accountId of periodMap.keys()) {
      allAccountIds.add(accountId)
    }
  }

  // Build result rows (filter out any accountId with no metadata — shouldn't happen but guards against data races)
  const rows = Array.from(allAccountIds).flatMap((accountId) => {
    const meta = accountMeta.get(accountId)
    if (!meta) return []
    const periodRows = []

    let totalBudgeted = 0
    let totalActual = 0

    for (let p = startPeriod; p <= endPeriod; p++) {
      const budgeted = budgetMap.get(accountId)?.get(p) ?? 0
      const actual = actualsByPeriodById.get(p)?.get(accountId) ?? 0
      const variance = actual - budgeted
      const variancePct = budgeted !== 0 ? (variance / Math.abs(budgeted)) * 100 : null

      totalBudgeted += budgeted
      totalActual += actual

      periodRows.push({
        period: p,
        label: periodLabels[p - 1],
        budgeted,
        actual,
        variance,
        variancePct,
      })
    }

    const totalVariance = totalActual - totalBudgeted
    const totalVariancePct = totalBudgeted !== 0 ? (totalVariance / Math.abs(totalBudgeted)) * 100 : null

    return [{
      accountId,
      accountCode: meta.code,
      accountName: meta.name,
      accountType: meta.type,
      periods: periodRows,
      totalBudgeted,
      totalActual,
      totalVariance,
      totalVariancePct,
    }]
  })

  // Sort by type (INCOME first, then EXPENSE) then by code
  rows.sort((a, b) => {
    if (a.accountType !== b.accountType) {
      return a.accountType === "INCOME" ? -1 : 1
    }
    return a.accountCode.localeCompare(b.accountCode)
  })

  const selectedLabels = periodLabels.slice(startPeriod - 1, endPeriod)

  if (format === "csv") {
    // Flatten to CSV
    const csvRows = rows.flatMap((row) =>
      row.periods.map((p) => ({
        account_code: row.accountCode,
        account_name: row.accountName,
        account_type: row.accountType,
        period: p.label,
        budgeted: (p.budgeted / 100).toFixed(2),
        actual: (p.actual / 100).toFixed(2),
        variance: (p.variance / 100).toFixed(2),
        variance_pct: p.variancePct != null ? p.variancePct.toFixed(2) + "%" : "",
      })),
    )
    const csv = toCsv(csvRows)
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="budget-variance-${budget.name}-${budget.fiscalYear}.csv"`,
      },
    })
  }

  return NextResponse.json({
    budget: {
      id: budget.id,
      name: budget.name,
      fiscalYear: budget.fiscalYear,
      periodType: budget.periodType,
    },
    periodLabels: selectedLabels,
    fromPeriod: startPeriod,
    toPeriod: endPeriod,
    rows,
  })
}
