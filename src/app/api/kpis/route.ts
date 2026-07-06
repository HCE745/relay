import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { getPL, getBalanceSheet } from "@/lib/reports"
import { getAccountBalance } from "@/lib/ledger"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { start, end }
}

function priorMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

function safe(num: number, den: number): number | null {
  return den === 0 ? null : Math.round((num / den) * 100) / 100
}

function pct(num: number, den: number): number | null {
  return den === 0 ? null : Math.round((num / den) * 10000) / 100
}

async function getDescendantEntityIds(tenantId: string, parentId: string): Promise<string[]> {
  const all = await prisma.entity.findMany({ where: { tenantId } })
  const result = [parentId]
  const walk = (id: string) => {
    for (const e of all.filter((x) => x.parentEntityId === id)) {
      result.push(e.id)
      walk(e.id)
    }
  }
  walk(parentId)
  return result
}

async function computeKPIs(tenantId: string, entityId: string, year: number, month: number, consolidated: boolean) {
  const { start: periodStart, end: asOf } = monthBounds(year, month)
  const entityIds = consolidated ? await getDescendantEntityIds(tenantId, entityId) : [entityId]

  // ── Balance-sheet aggregates (cumulative to asOf) ──────────────────────────
  const [caAgg, clAgg, invAgg, arAgg, apAgg] = await Promise.all([
    // Current Assets (ASSET, isCurrent=true)
    prisma.journalLine.aggregate({
      where: {
        journalEntry: { tenantId, entityId: { in: entityIds }, status: "POSTED", date: { lte: asOf } },
        account: { type: "ASSET", isCurrent: true },
      },
      _sum: { debit: true, credit: true },
    }),
    // Current Liabilities (LIABILITY, isCurrent=true)
    prisma.journalLine.aggregate({
      where: {
        journalEntry: { tenantId, entityId: { in: entityIds }, status: "POSTED", date: { lte: asOf } },
        account: { type: "LIABILITY", isCurrent: true },
      },
      _sum: { debit: true, credit: true },
    }),
    // Inventory (ASSET, subtype=INVENTORY)
    prisma.journalLine.aggregate({
      where: {
        journalEntry: { tenantId, entityId: { in: entityIds }, status: "POSTED", date: { lte: asOf } },
        account: { type: "ASSET", subtype: "INVENTORY" },
      },
      _sum: { debit: true, credit: true },
    }),
    // AR (ASSET with name/code suggesting receivable)
    prisma.journalLine.aggregate({
      where: {
        journalEntry: { tenantId, entityId: { in: entityIds }, status: "POSTED", date: { lte: asOf } },
        account: { type: "ASSET", OR: [{ subtype: "AR" }, { name: { contains: "receivable", mode: "insensitive" } }] },
      },
      _sum: { debit: true, credit: true },
    }),
    // AP (LIABILITY with name/code suggesting payable)
    prisma.journalLine.aggregate({
      where: {
        journalEntry: { tenantId, entityId: { in: entityIds }, status: "POSTED", date: { lte: asOf } },
        account: { type: "LIABILITY", OR: [{ subtype: "AP" }, { name: { contains: "payable", mode: "insensitive" } }] },
      },
      _sum: { debit: true, credit: true },
    }),
  ])

  const currentAssets = (caAgg._sum.debit ?? 0) - (caAgg._sum.credit ?? 0)
  const currentLiabilities = (clAgg._sum.credit ?? 0) - (clAgg._sum.debit ?? 0)
  const inventory = (invAgg._sum.debit ?? 0) - (invAgg._sum.credit ?? 0)
  const arBalance = (arAgg._sum.debit ?? 0) - (arAgg._sum.credit ?? 0)
  const apBalance = (apAgg._sum.credit ?? 0) - (apAgg._sum.debit ?? 0)

  // ── Full balance sheet for total liabilities + equity ────────────────────
  const bs = await getBalanceSheet(tenantId, entityId, asOf, consolidated ? { consolidated: true } : undefined)

  // ── P&L for current period ────────────────────────────────────────────────
  const pl = await getPL(tenantId, entityId, { start: periodStart, end: asOf }, consolidated ? { consolidated: true } : undefined)

  // ── Cash position ─────────────────────────────────────────────────────────
  const cashAccounts = await prisma.account.findMany({
    where: {
      tenantId, entityId,
      type: "ASSET",
      OR: [
        { code: { in: ["1000", "1010"] } },
        { name: { contains: "cash", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  })
  let cashCents = 0
  for (const acc of cashAccounts) {
    cashCents += await getAccountBalance(tenantId, entityId, acc.id, { periodEnd: asOf })
  }

  // ── Days in period ────────────────────────────────────────────────────────
  const daysInPeriod = Math.max(1, Math.round((asOf.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)))

  // ── Ratios ────────────────────────────────────────────────────────────────
  const quickAssets = currentAssets - inventory
  const currentRatio = safe(currentAssets, currentLiabilities)
  const quickRatio = safe(quickAssets, currentLiabilities)
  const workingCapitalCents = currentAssets - currentLiabilities

  const dso = arBalance > 0 && pl.totalRevenue > 0
    ? Math.round((arBalance / pl.totalRevenue) * daysInPeriod * 10) / 10
    : 0
  const totalCost = pl.totalCogs + pl.totalExpenses
  const dpo = apBalance > 0 && totalCost > 0
    ? Math.round((apBalance / totalCost) * daysInPeriod * 10) / 10
    : 0

  const grossMarginPct = pct(pl.grossProfit, pl.totalRevenue)
  const netMarginPct = pct(pl.netIncome, pl.totalRevenue)
  const operatingMarginPct = pct(pl.grossProfit - pl.totalExpenses, pl.totalRevenue)

  const debtToEquity = safe(bs.totalLiabilities, bs.totalEquity)

  return {
    currentRatio,
    quickRatio,
    workingCapitalCents,
    dso,
    dpo,
    cashConversionCycle: dso && dpo ? Math.round((dso - dpo) * 10) / 10 : null,
    grossMarginPct,
    netMarginPct,
    operatingMarginPct,
    cashCents,
    debtToEquity,
    totalRevenue: pl.totalRevenue,
    netIncome: pl.netIncome,
    grossProfit: pl.grossProfit,
    totalExpenses: pl.totalExpenses,
    // for burn calculation
    _netIncome: pl.netIncome,
  }
}

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { searchParams } = new URL(req.url)

  let entityId = searchParams.get("entityId") ?? ""
  if (!entityId) {
    const cookieStore = await cookies()
    entityId = cookieStore.get("hce-entity")?.value ?? ""
  }
  if (!entityId) return NextResponse.json({ error: "entityId required" }, { status: 400 })

  const entity = await prisma.entity.findFirst({
    where: { id: entityId, tenantId: session.tenantId },
    select: { id: true, name: true, isConsolidationParent: true },
  })
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 })

  const now = new Date()
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10)
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1), 10)
  const consolidated = searchParams.get("consolidated") === "true" && entity.isConsolidationParent

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 })
  }

  try {
    const current = await computeKPIs(session.tenantId, entityId, year, month, consolidated)

    // Trend: 6 prior months (including current)
    const trendMonths: string[] = []
    const trendNetMargin: (number | null)[] = []
    const trendCurrentRatio: (number | null)[] = []
    const trendGrossMargin: (number | null)[] = []

    for (let i = 5; i >= 0; i--) {
      let y = year, m = month
      for (let j = 0; j < i; j++) {
        const p = priorMonth(y, m); y = p.year; m = p.month
      }
      trendMonths.push(`${MONTH_NAMES[m - 1]} ${y}`)
      try {
        const t = await computeKPIs(session.tenantId, entityId, y, m, consolidated)
        trendNetMargin.push(t.netMarginPct)
        trendCurrentRatio.push(t.currentRatio)
        trendGrossMargin.push(t.grossMarginPct)
      } catch {
        trendNetMargin.push(null)
        trendCurrentRatio.push(null)
        trendGrossMargin.push(null)
      }
    }

    // Monthly burn = average of last 3 months' net loss (positive = burning cash)
    let monthlyBurnCents: number | null = null
    let runwayMonths: number | null = null
    try {
      const burnData: number[] = []
      let by = year, bm = month
      for (let i = 0; i < 3; i++) {
        const p = priorMonth(by, bm); by = p.year; bm = p.month
        const t = await computeKPIs(session.tenantId, entityId, by, bm, consolidated)
        burnData.push(-t._netIncome) // negative netIncome = cash burn
      }
      const avgBurn = burnData.reduce((a, b) => a + b, 0) / burnData.length
      if (avgBurn > 0) {
        monthlyBurnCents = Math.round(avgBurn)
        runwayMonths = Math.round((current.cashCents / monthlyBurnCents) * 10) / 10
      }
    } catch {
      // burn data unavailable
    }

    const { start: periodStart, end: asOf } = monthBounds(year, month)

    return NextResponse.json({
      asOf: asOf.toISOString(),
      period: `${MONTH_NAMES[month - 1]} ${year}`,
      entity: entity.name,
      liquidity: {
        currentRatio: current.currentRatio,
        quickRatio: current.quickRatio,
        workingCapitalCents: current.workingCapitalCents,
      },
      efficiency: {
        dso: current.dso,
        dpo: current.dpo,
        cashConversionCycle: current.cashConversionCycle,
      },
      profitability: {
        grossMarginPct: current.grossMarginPct,
        operatingMarginPct: current.operatingMarginPct,
        netMarginPct: current.netMarginPct,
      },
      cash: {
        cashCents: current.cashCents,
        monthlyBurnCents,
        runwayMonths,
      },
      leverage: {
        debtToEquity: current.debtToEquity,
      },
      trend: {
        months: trendMonths,
        netMarginPct: trendNetMargin,
        currentRatio: trendCurrentRatio,
        grossMarginPct: trendGrossMargin,
      },
      sources: {
        currentRatio: {
          num: "Current Assets: ASSET accounts with isCurrent=true, cumulative balance as of period end",
          den: "Current Liabilities: LIABILITY accounts with isCurrent=true, cumulative balance as of period end",
        },
        quickRatio: {
          num: "Current Assets minus Inventory (ASSET accounts with subtype=INVENTORY)",
          den: "Current Liabilities: same as Current Ratio denominator",
        },
        grossMarginPct: {
          num: "Gross Profit from P&L (Revenue − COGS) for the period",
          den: "Total Revenue from P&L for the period",
        },
        netMarginPct: {
          num: "Net Income from P&L (Gross Profit − Operating Expenses) for the period",
          den: "Total Revenue from P&L for the period",
        },
        dso: {
          formula: "AR Balance ÷ Revenue × Days in Period",
          note: "AR = ASSET accounts with subtype=AR or name containing 'receivable'",
        },
        dpo: {
          formula: "AP Balance ÷ (COGS + Expenses) × Days in Period",
          note: "AP = LIABILITY accounts with subtype=AP or name containing 'payable'",
        },
      },
    })
  } catch (err) {
    console.error("[/api/kpis]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
