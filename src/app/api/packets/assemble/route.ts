import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import {
  getPL, getBalanceSheet, getCashFlow, getTrialBalance,
  type PLReport, type BSReport, type CashFlowReport, type TrialBalanceLine,
} from "@/lib/reports"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function getDescendantIds(tenantId: string, entityId: string): Promise<string[]> {
  const all = await prisma.entity.findMany({ where: { tenantId } })
  const result = [entityId]
  const walk = (id: string) => {
    for (const e of all) if (e.parentEntityId === id) { result.push(e.id); walk(e.id) }
  }
  walk(entityId)
  return result
}

async function getCashPosition(tenantId: string, entityIds: string[]): Promise<number> {
  const agg = await prisma.journalLine.aggregate({
    where: {
      journalEntry: { tenantId, entityId: { in: entityIds }, status: "POSTED" },
      account: { type: "ASSET", OR: [
        { name: { contains: "cash", mode: "insensitive" } },
        { code: { in: ["1000", "1001", "1010", "1011", "1020"] } },
      ]},
    },
    _sum: { debit: true, credit: true },
  })
  return (agg._sum.debit ?? 0) - (agg._sum.credit ?? 0)
}

async function get3MoAvgBurn(tenantId: string, entityId: string, consolidated: boolean, asOf: Date): Promise<number> {
  const start = new Date(asOf.getFullYear(), asOf.getMonth() - 3, 1)
  const pl = await getPL(tenantId, entityId, { start, end: asOf }, consolidated ? { consolidated: true } : undefined)
  return Math.round((pl.totalCogs + pl.totalExpenses) / 3)
}

// ─── Monthly packet ───────────────────────────────────────────────────────────

async function assembleMonthly(
  tenantId: string, entityId: string, year: number, month: number, consolidated: boolean,
) {
  const entity = await prisma.entity.findFirst({ where: { id: entityId, tenantId } })
  if (!entity) throw new Error("Entity not found")

  const entityIds = consolidated && entity.isConsolidationParent
    ? await getDescendantIds(tenantId, entityId)
    : [entityId]
  const plOpts = consolidated ? { consolidated: true } : undefined

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999)
  const ytdStart   = new Date(year, 0, 1)
  const priorStart = new Date(year, month - 2, 1)
  const priorEnd   = new Date(year, month - 1, 0, 23, 59, 59, 999)

  const [pl, plYTD, plPrior, bs, cf, anomalies, cashPosition] = await Promise.all([
    getPL(tenantId, entityId, { start: monthStart, end: monthEnd }, plOpts),
    getPL(tenantId, entityId, { start: ytdStart, end: monthEnd }, plOpts),
    getPL(tenantId, entityId, { start: priorStart, end: priorEnd }, plOpts),
    getBalanceSheet(tenantId, entityId, monthEnd, plOpts),
    getCashFlow(tenantId, entityId, { start: monthStart, end: monthEnd }),
    prisma.anomalyFlag.findMany({
      where: { tenantId, entityId: { in: entityIds }, status: "OPEN",
        createdAt: { gte: monthStart, lte: monthEnd } },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    }),
    getCashPosition(tenantId, entityIds),
  ])

  // Budget vs actual
  const budgets = await prisma.budget.findMany({
    where: { tenantId, entityId, fiscalYear: year, periodType: "MONTHLY" },
    include: {
      lines: {
        where: { period: month },
        include: { account: { select: { code: true, name: true, type: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  })
  const budget = budgets[0]

  const budgetVariances: {
    accountCode: string; accountName: string; type: string
    budgetedCents: number; actualCents: number
    varianceCents: number; variancePct: number | null
  }[] = []

  if (budget) {
    // Map actuals by account code
    const actualMap = new Map<string, number>()
    for (const line of [...pl.revenue, ...pl.cogs, ...pl.expenses]) {
      actualMap.set(line.code, line.amount)
    }
    for (const bLine of budget.lines) {
      const actual = actualMap.get(bLine.account.code) ?? 0
      const budgeted = bLine.amountCents
      const variance = actual - budgeted
      const variancePct = budgeted !== 0 ? Math.round((variance / Math.abs(budgeted)) * 1000) / 10 : null
      budgetVariances.push({
        accountCode: bLine.account.code,
        accountName: bLine.account.name,
        type: bLine.account.type,
        budgetedCents: budgeted,
        actualCents: actual,
        varianceCents: variance,
        variancePct,
      })
    }
    budgetVariances.sort((a, b) => Math.abs(b.varianceCents) - Math.abs(a.varianceCents))
  }

  // KPIs
  const grossMarginPct = pl.totalRevenue > 0 ? (pl.grossProfit / pl.totalRevenue) * 100 : null
  const netMarginPct = pl.totalRevenue > 0 ? (pl.netIncome / pl.totalRevenue) * 100 : null
  const revGrowthPct = plPrior.totalRevenue > 0
    ? ((pl.totalRevenue - plPrior.totalRevenue) / plPrior.totalRevenue) * 100
    : null

  // Current ratio from balance sheet
  const currentAssets = bs.assets.filter((a) => a.code.startsWith("1")).reduce((s, a) => s + a.amount, 0)
  const currentLiabilities = bs.liabilities.filter((l) => l.code.startsWith("2")).reduce((s, l) => s + l.amount, 0)
  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : null

  const monthlyBurn = (pl.totalCogs + pl.totalExpenses) || 1
  const cashRunwayMonths = monthlyBurn > 0 ? Math.round((cashPosition / monthlyBurn) * 10) / 10 : null

  return {
    type: "monthly" as const,
    entity: { id: entity.id, name: entity.name },
    period: { year, month, label: `${new Date(year, month - 1).toLocaleString("en-US", { month: "long" })} ${year}` },
    consolidated,
    generatedAt: new Date().toISOString(),
    pl,
    plYTD,
    balanceSheet: bs,
    cashFlow: cf,
    budgetVariances,
    hasBudget: !!budget,
    budgetName: budget?.name ?? null,
    kpis: { grossMarginPct, netMarginPct, currentRatio, cashRunwayMonths, revGrowthPct },
    cashPositionCents: cashPosition,
    priorMonthRevenueCents: plPrior.totalRevenue,
    anomalies: anomalies.map((a) => ({
      id: a.id, severity: a.severity, reason: a.reason, sourceType: a.sourceType, ruleType: a.ruleType,
    })),
  }
}

// ─── Tax packet ───────────────────────────────────────────────────────────────

async function assembleTax(
  tenantId: string, entityId: string, fiscalYear: number, consolidated: boolean,
) {
  const entity = await prisma.entity.findFirst({ where: { id: entityId, tenantId } })
  if (!entity) throw new Error("Entity not found")

  const entityIds = consolidated && entity.isConsolidationParent
    ? await getDescendantIds(tenantId, entityId)
    : [entityId]
  const plOpts = consolidated ? { consolidated: true } : undefined

  const yearStart = new Date(fiscalYear, 0, 1)
  const yearEnd   = new Date(fiscalYear, 11, 31, 23, 59, 59, 999)

  const [pl, bs, tb] = await Promise.all([
    getPL(tenantId, entityId, { start: yearStart, end: yearEnd }, plOpts),
    getBalanceSheet(tenantId, entityId, yearEnd, plOpts),
    getTrialBalance(tenantId, entityId, { start: yearStart, end: yearEnd }),
  ])

  // Fixed assets with depreciation for the year
  const fixedAssets = await prisma.fixedAsset.findMany({
    where: { tenantId, entityId: { in: entityIds }, status: "ACTIVE" },
    include: {
      depreciationEntries: {
        where: { periodDate: { gte: yearStart, lte: yearEnd }, status: "POSTED" },
      },
    },
    orderBy: { acquisitionDate: "asc" },
  })

  const fasSummary = fixedAssets.map((fa) => ({
    name: fa.name,
    category: fa.category,
    acquisitionDate: fa.acquisitionDate.toISOString().slice(0, 10),
    costCents: fa.costCents,
    salvageValueCents: fa.salvageValueCents,
    depreciationMethod: fa.depreciationMethod,
    usefulLifeMonths: fa.usefulLifeMonths,
    depreciationYearCents: fa.depreciationEntries.reduce((s, e) => s + e.amountCents, 0),
    status: fa.status,
  }))

  // Vendor payments for 1099 prep
  const bills = await prisma.bill.findMany({
    where: { tenantId, entityId: { in: entityIds } },
    include: {
      vendor: { select: { id: true, name: true } },
      payments: {
        where: { date: { gte: yearStart, lte: yearEnd } },
        select: { amount: true, date: true },
      },
    },
  })

  const vendorMap = new Map<string, { vendorName: string; totalPaidCents: number }>()
  for (const bill of bills) {
    const paid = bill.payments.reduce((s, p) => s + p.amount, 0)
    if (paid > 0) {
      const existing = vendorMap.get(bill.vendorId) ?? { vendorName: bill.vendor.name, totalPaidCents: 0 }
      existing.totalPaidCents += paid
      vendorMap.set(bill.vendorId, existing)
    }
  }

  const vendorPayments = Array.from(vendorMap.values())
    .sort((a, b) => b.totalPaidCents - a.totalPaidCents)
    .map((v) => ({
      vendorName: v.vendorName,
      totalPaidCents: v.totalPaidCents,
      note1099: v.totalPaidCents >= 60000 ? "Review for 1099-NEC (≥$600)" : "",
    }))

  return {
    type: "tax" as const,
    entity: { id: entity.id, name: entity.name },
    fiscalYear,
    consolidated,
    generatedAt: new Date().toISOString(),
    pl,
    balanceSheet: bs,
    trialBalance: tb,
    fixedAssets: fasSummary,
    totalFixedAssetDeprYear: fasSummary.reduce((s, f) => s + f.depreciationYearCents, 0),
    vendorPayments,
    disclaimer: "For CPA preparation — not a tax filing. Verify all figures with source documents.",
  }
}

// ─── Investor packet ──────────────────────────────────────────────────────────

async function assembleInvestor(tenantId: string, entityId: string, consolidated: boolean) {
  const entity = await prisma.entity.findFirst({ where: { id: entityId, tenantId } })
  if (!entity) throw new Error("Entity not found")

  const entityIds = consolidated && entity.isConsolidationParent
    ? await getDescendantIds(tenantId, entityId)
    : [entityId]
  const plOpts = consolidated ? { consolidated: true } : undefined

  const now  = new Date()
  const year = now.getFullYear()

  // 3 years of P&L
  const years = [year - 2, year - 1, year]
  const historicalPL = await Promise.all(
    years.map(async (y) => {
      const start = new Date(y, 0, 1)
      const end   = y === year ? now : new Date(y, 11, 31, 23, 59, 59, 999)
      const pl    = await getPL(tenantId, entityId, { start, end }, plOpts)
      return { year: y, isPartialYear: y === year, pl }
    }),
  )

  // TTM (trailing 12 months)
  const ttmStart = new Date(year - 1, now.getMonth(), now.getDate() + 1)
  const [plTTM, bs, cf, cashPosition, monthlyBurn] = await Promise.all([
    getPL(tenantId, entityId, { start: ttmStart, end: now }, plOpts),
    getBalanceSheet(tenantId, entityId, now, plOpts),
    getCashFlow(tenantId, entityId, { start: ttmStart, end: now }),
    getCashPosition(tenantId, entityIds),
    get3MoAvgBurn(tenantId, entityId, consolidated, now),
  ])

  // Year-over-year growth (last full year vs prior full year)
  const revCY  = historicalPL[1].pl.totalRevenue  // last full year
  const revPY  = historicalPL[0].pl.totalRevenue  // year before
  const revGrowthPct = revPY > 0 ? ((revCY - revPY) / revPY) * 100 : null

  const grossMarginPct  = plTTM.totalRevenue > 0 ? (plTTM.grossProfit / plTTM.totalRevenue) * 100 : null
  const netMarginPct    = plTTM.totalRevenue > 0 ? (plTTM.netIncome / plTTM.totalRevenue) * 100 : null
  const runwayMonths    = monthlyBurn > 0 ? Math.round((cashPosition / monthlyBurn) * 10) / 10 : null

  // Simple indicative valuation using revenue multiple (4x base, industry-neutral)
  // Point users to the Valuation module for detailed analysis
  const ttmRevenue = plTTM.totalRevenue
  const valuationLow  = Math.round(ttmRevenue * 0.8)
  const valuationBase = Math.round(ttmRevenue * 1.5)
  const valuationHigh = Math.round(ttmRevenue * 2.5)
  const ebitdaCents   = plTTM.netIncome  // simplified (no D&A adjustment here)

  return {
    type: "investor" as const,
    entity: { id: entity.id, name: entity.name },
    consolidated,
    generatedAt: new Date().toISOString(),
    currentYear: year,
    ttmPeriod: { start: ttmStart.toISOString(), end: now.toISOString() },
    historicalPL,
    plTTM,
    balanceSheet: bs,
    cashFlow: cf,
    cashPositionCents: cashPosition,
    monthlyBurnCents: monthlyBurn,
    runwayMonths,
    revenueGrowthPct: revGrowthPct,
    grossMarginPct,
    netMarginPct,
    ebitdaCents,
    valuationNote: "Indicative revenue-multiple range (0.8x–2.5x TTM). Use the Valuation module for a full analysis.",
    valuationLow,
    valuationBase,
    valuationHigh,
    disclaimer: "Prepared for discussion purposes only. Not a solicitation. Past performance does not guarantee future results.",
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()
  const deny = assertAccess(session, body.entityId, "read"); if (deny) return deny
  const { type, entityId, consolidated = false, year, month, fiscalYear } = body

  try {
    if (type === "monthly") {
      if (!year || !month) return NextResponse.json({ error: "year and month required" }, { status: 400 })
      const data = await assembleMonthly(session.tenantId, entityId, +year, +month, !!consolidated)
      return NextResponse.json(data)
    }
    if (type === "tax") {
      if (!fiscalYear) return NextResponse.json({ error: "fiscalYear required" }, { status: 400 })
      const data = await assembleTax(session.tenantId, entityId, +fiscalYear, !!consolidated)
      return NextResponse.json(data)
    }
    if (type === "investor") {
      const data = await assembleInvestor(session.tenantId, entityId, !!consolidated)
      return NextResponse.json(data)
    }
    return NextResponse.json({ error: "type must be monthly | tax | investor" }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
