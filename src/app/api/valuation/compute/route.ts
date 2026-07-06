import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { getSelectedEntityId } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { getPL } from "@/lib/reports"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ─── Industry multiple defaults ───────────────────────────────────────────────

const INDUSTRY_DEFAULTS: Record<string, {
  revMultiple: [number, number, number]
  ebitdaMultiple: [number, number, number]
  sdeMultiple: [number, number, number]
}> = {
  SAAS:                  { revMultiple: [2.5, 4.5, 8.0], ebitdaMultiple: [10, 15, 22], sdeMultiple: [3.0, 4.5, 6.5] },
  PROFESSIONAL_SERVICES: { revMultiple: [0.5, 1.0, 2.0], ebitdaMultiple: [4,   6,  8 ], sdeMultiple: [2.0, 3.0, 4.0] },
  ECOMMERCE:             { revMultiple: [0.5, 1.2, 2.5], ebitdaMultiple: [5,   8, 14 ], sdeMultiple: [2.0, 3.5, 5.0] },
  RETAIL:                { revMultiple: [0.3, 0.6, 1.0], ebitdaMultiple: [3,   5,  7 ], sdeMultiple: [1.5, 2.5, 3.5] },
  MANUFACTURING:         { revMultiple: [0.5, 0.8, 1.5], ebitdaMultiple: [4,   6,  9 ], sdeMultiple: [2.0, 3.0, 4.0] },
  HEALTHCARE:            { revMultiple: [0.7, 1.2, 2.0], ebitdaMultiple: [6,   9, 13 ], sdeMultiple: [2.5, 3.5, 5.0] },
  FOOD_BEVERAGE:         { revMultiple: [0.3, 0.5, 0.8], ebitdaMultiple: [3,   5,  7 ], sdeMultiple: [1.5, 2.5, 3.5] },
  OTHER:                 { revMultiple: [0.5, 1.0, 2.0], ebitdaMultiple: [4,   7, 11 ], sdeMultiple: [2.0, 3.0, 4.5] },
}

// ─── Qualitative adjustment table (each factor, documented) ──────────────────

type QualFactor = {
  name: string
  value: string     // human-readable
  pctAdjustment: number  // signed integer, e.g. -12 or +8
  note: string
}

function computeQualAdjustments(params: {
  revenueGrowthPct: number
  grossMarginPct: number
  ownerInvolvement: "HIGH" | "MEDIUM" | "LOW"
  customerConcentrationPct: number
  recurringRevenuePct: number
}): QualFactor[] {
  const factors: QualFactor[] = []

  // Revenue growth
  if (params.revenueGrowthPct > 30) {
    factors.push({ name: "Revenue Growth", value: `+${params.revenueGrowthPct.toFixed(1)}% YoY`, pctAdjustment: 12, note: "Strong growth commands premium" })
  } else if (params.revenueGrowthPct > 15) {
    factors.push({ name: "Revenue Growth", value: `+${params.revenueGrowthPct.toFixed(1)}% YoY`, pctAdjustment: 7, note: "Healthy growth rate" })
  } else if (params.revenueGrowthPct > 5) {
    factors.push({ name: "Revenue Growth", value: `+${params.revenueGrowthPct.toFixed(1)}% YoY`, pctAdjustment: 3, note: "Modest growth" })
  } else if (params.revenueGrowthPct >= 0) {
    factors.push({ name: "Revenue Growth", value: `+${params.revenueGrowthPct.toFixed(1)}% YoY`, pctAdjustment: 0, note: "Flat revenue — neutral" })
  } else {
    factors.push({ name: "Revenue Growth", value: `${params.revenueGrowthPct.toFixed(1)}% YoY`, pctAdjustment: -10, note: "Declining revenue reduces multiple" })
  }

  // Gross margin
  if (params.grossMarginPct > 50) {
    factors.push({ name: "Gross Margin", value: `${params.grossMarginPct.toFixed(1)}%`, pctAdjustment: 6, note: "High-margin business commands premium" })
  } else if (params.grossMarginPct > 30) {
    factors.push({ name: "Gross Margin", value: `${params.grossMarginPct.toFixed(1)}%`, pctAdjustment: 0, note: "Margin in typical range" })
  } else if (params.grossMarginPct > 20) {
    factors.push({ name: "Gross Margin", value: `${params.grossMarginPct.toFixed(1)}%`, pctAdjustment: -4, note: "Below-average margin" })
  } else {
    factors.push({ name: "Gross Margin", value: `${params.grossMarginPct.toFixed(1)}%`, pctAdjustment: -9, note: "Thin margins compress multiple" })
  }

  // Owner involvement
  if (params.ownerInvolvement === "LOW") {
    factors.push({ name: "Owner Involvement", value: "Low", pctAdjustment: 8, note: "Business runs without owner — lower transfer risk" })
  } else if (params.ownerInvolvement === "MEDIUM") {
    factors.push({ name: "Owner Involvement", value: "Medium", pctAdjustment: 0, note: "Typical owner involvement" })
  } else {
    factors.push({ name: "Owner Involvement", value: "High", pctAdjustment: -12, note: "High owner dependence — key-person risk for buyer" })
  }

  // Customer concentration
  if (params.customerConcentrationPct < 10) {
    factors.push({ name: "Customer Concentration", value: `${params.customerConcentrationPct.toFixed(0)}% top customer`, pctAdjustment: 5, note: "Well-diversified customer base" })
  } else if (params.customerConcentrationPct < 25) {
    factors.push({ name: "Customer Concentration", value: `${params.customerConcentrationPct.toFixed(0)}% top customer`, pctAdjustment: 0, note: "Moderate concentration — typical" })
  } else if (params.customerConcentrationPct < 40) {
    factors.push({ name: "Customer Concentration", value: `${params.customerConcentrationPct.toFixed(0)}% top customer`, pctAdjustment: -8, note: "Notable concentration — increases buyer risk" })
  } else {
    factors.push({ name: "Customer Concentration", value: `${params.customerConcentrationPct.toFixed(0)}% top customer`, pctAdjustment: -18, note: "High concentration — significant risk factor" })
  }

  // Recurring revenue
  if (params.recurringRevenuePct > 70) {
    factors.push({ name: "Recurring Revenue", value: `${params.recurringRevenuePct.toFixed(0)}%`, pctAdjustment: 10, note: "Highly recurring — predictable cash flows command premium" })
  } else if (params.recurringRevenuePct > 40) {
    factors.push({ name: "Recurring Revenue", value: `${params.recurringRevenuePct.toFixed(0)}%`, pctAdjustment: 5, note: "Meaningful recurring revenue base" })
  } else if (params.recurringRevenuePct > 20) {
    factors.push({ name: "Recurring Revenue", value: `${params.recurringRevenuePct.toFixed(0)}%`, pctAdjustment: 0, note: "Some recurring revenue" })
  } else {
    factors.push({ name: "Recurring Revenue", value: `${params.recurringRevenuePct.toFixed(0)}%`, pctAdjustment: -5, note: "Primarily transactional — lower predictability" })
  }

  return factors
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getDescendantIds(tenantId: string, entityId: string): Promise<string[]> {
  const all = await prisma.entity.findMany({ where: { tenantId } })
  const result = [entityId]
  const walk = (id: string) => {
    for (const e of all) if (e.parentEntityId === id) { result.push(e.id); walk(e.id) }
  }
  walk(entityId)
  return result
}

async function getInterestAndTaxExpense(
  tenantId: string,
  entityIds: string[],
  start: Date,
  end: Date,
): Promise<{ interestExpenseCents: number; taxExpenseCents: number }> {
  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: {
        tenantId,
        entityId: { in: entityIds },
        status: "POSTED",
        date: { gte: start, lte: end },
      },
      account: { type: "EXPENSE" },
    },
    include: { account: { select: { name: true, code: true } } },
  })

  let interestExpenseCents = 0, taxExpenseCents = 0
  for (const line of lines) {
    const name = line.account.name.toLowerCase()
    const code = line.account.code
    if (name.includes("interest") || code.startsWith("75") || code.startsWith("76")) {
      interestExpenseCents += line.debit - line.credit
    }
    if (name.includes("tax") || name.includes("income tax") || code.startsWith("80") || code.startsWith("81")) {
      taxExpenseCents += line.debit - line.credit
    }
  }
  return {
    interestExpenseCents: Math.max(0, interestExpenseCents),
    taxExpenseCents: Math.max(0, taxExpenseCents),
  }
}

async function getDepreciationTTM(tenantId: string, entityIds: string[], start: Date, end: Date): Promise<number> {
  const result = await prisma.depreciationEntry.aggregate({
    where: {
      fixedAsset: { tenantId, entityId: { in: entityIds } },
      status: "POSTED",
      periodDate: { gte: start, lte: end },
    },
    _sum: { amountCents: true },
  })
  return result._sum.amountCents ?? 0
}

async function getAmortizationTTM(tenantId: string, entityIds: string[], start: Date, end: Date): Promise<number> {
  const entries = await prisma.amortizationEntry.findMany({
    where: {
      schedule: { tenantId, entityId: { in: entityIds } },
      posted: true,
      periodDate: { gte: start, lte: end },
    },
    select: { amountCents: true },
  })
  return entries.reduce((s, e) => s + e.amountCents, 0)
}

function applyMethods(
  revCents: number,
  ebitdaCents: number,
  sdeCents: number,
  revRange: [number, number, number],
  ebitdaRange: [number, number, number],
  sdeRange: [number, number, number],
  qualAdjPct: number,
): {
  byMethod: {
    revenue: { low: number; base: number; high: number }
    ebitda: { low: number; base: number; high: number }
    sde: { low: number; base: number; high: number }
  }
  adjusted: { low: number; base: number; high: number }
  primaryMethod: string
  primaryReason: string
} {
  const qualFactor = 1 + qualAdjPct / 100

  const rev = {
    low:  Math.round(revCents * revRange[0]),
    base: Math.round(revCents * revRange[1] * qualFactor),
    high: Math.round(revCents * revRange[2]),
  }
  const ebitda = {
    low:  ebitdaCents > 0 ? Math.round(ebitdaCents * ebitdaRange[0]) : 0,
    base: ebitdaCents > 0 ? Math.round(ebitdaCents * ebitdaRange[1] * qualFactor) : 0,
    high: ebitdaCents > 0 ? Math.round(ebitdaCents * ebitdaRange[2]) : 0,
  }
  const sde = {
    low:  sdeCents > 0 ? Math.round(sdeCents * sdeRange[0]) : 0,
    base: sdeCents > 0 ? Math.round(sdeCents * sdeRange[1] * qualFactor) : 0,
    high: sdeCents > 0 ? Math.round(sdeCents * sdeRange[2]) : 0,
  }

  // Determine primary method based on business type heuristics
  let primaryMethod = "ebitda"
  let primaryReason = "EBITDA multiple is the standard for profitable businesses."

  if (ebitdaCents <= 0 && sdeCents <= 0) {
    primaryMethod = "revenue"
    primaryReason = "Business is not yet profitable — revenue multiple is most relevant."
  } else if (sdeCents > 0 && ebitdaCents < revCents * 0.05) {
    primaryMethod = "sde"
    primaryReason = "Small owner-operated business — SDE multiple most accurately reflects earning power."
  } else if (ebitdaCents > 0) {
    primaryMethod = "ebitda"
    primaryReason = "EBITDA multiple is standard for established businesses."
  }

  // Final range: weighted blend of active methods
  const activeMethods = [
    ebitdaCents > 0 ? { w: 0.5, v: ebitda } : null,
    sdeCents > 0 ? { w: 0.3, v: sde } : null,
    { w: ebitdaCents > 0 ? 0.2 : sdeCents > 0 ? 0.3 : 1.0, v: rev },
  ].filter(Boolean) as { w: number; v: { low: number; base: number; high: number } }[]

  const totalW = activeMethods.reduce((s, m) => s + m.w, 0)
  const finalLow  = Math.round(activeMethods.reduce((s, m) => s + m.v.low  * (m.w / totalW), 0))
  const finalBase = Math.round(activeMethods.reduce((s, m) => s + m.v.base * (m.w / totalW), 0))
  const finalHigh = Math.round(activeMethods.reduce((s, m) => s + m.v.high * (m.w / totalW), 0))

  return {
    byMethod: { revenue: rev, ebitda, sde },
    adjusted: { low: finalLow, base: finalBase, high: finalHigh },
    primaryMethod,
    primaryReason,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const { tenantId } = session
  const body = await req.json()
  const deny = assertAccess(session, body.entityId, "read"); if (deny) return deny

  const entityId: string = body.entityId ?? (await getSelectedEntityId())
  const consolidated: boolean = body.consolidated === true

  const entity = await prisma.entity.findFirst({ where: { id: entityId, tenantId } })
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 })

  const entityIds = consolidated && entity.isConsolidationParent
    ? await getDescendantIds(tenantId, entityId)
    : [entityId]

  const now = new Date()
  const ttmEnd = now
  const ttmStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1)
  const priorStart = new Date(ttmStart.getFullYear() - 1, ttmStart.getMonth(), ttmStart.getDate())
  const priorEnd = new Date(ttmStart.getFullYear(), ttmStart.getMonth(), ttmStart.getDate() - 1)

  const plOpts = consolidated ? { consolidated: true } : undefined

  const [plTTM, plPrior] = await Promise.all([
    getPL(tenantId, entityId, { start: ttmStart, end: ttmEnd }, plOpts),
    getPL(tenantId, entityId, { start: priorStart, end: priorEnd }, plOpts),
  ])

  const [interestTax, depreciationCents, amortizationCents] = await Promise.all([
    getInterestAndTaxExpense(tenantId, entityIds, ttmStart, ttmEnd),
    getDepreciationTTM(tenantId, entityIds, ttmStart, ttmEnd),
    getAmortizationTTM(tenantId, entityIds, ttmStart, ttmEnd),
  ])

  // Revenue growth
  const revGrowthPct = plPrior.totalRevenue > 0
    ? ((plTTM.totalRevenue - plPrior.totalRevenue) / plPrior.totalRevenue) * 100
    : 0

  // EBITDA = net income + interest + taxes + depreciation + amortization
  const ebitdaCents = plTTM.netIncome
    + interestTax.interestExpenseCents
    + interestTax.taxExpenseCents
    + depreciationCents
    + amortizationCents

  // SDE = EBITDA + owner comp + other add-backs
  const ownerCompCents: number = body.ownerCompCents ?? 0
  const addbacksCents: number = body.addbacksCents ?? 0
  const sdeCents = ebitdaCents + ownerCompCents + addbacksCents

  const grossMarginPct = plTTM.totalRevenue > 0
    ? (plTTM.grossProfit / plTTM.totalRevenue) * 100
    : 0

  // Qualitative inputs
  const ownerInvolvement: "HIGH" | "MEDIUM" | "LOW" = body.ownerInvolvement ?? "MEDIUM"
  const customerConcentrationPct: number = body.customerConcentrationPct ?? 20
  const recurringRevenuePct: number = body.recurringRevenuePct ?? 30

  // Multiples
  const industry: string = body.industry ?? "OTHER"
  const defaults = INDUSTRY_DEFAULTS[industry] ?? INDUSTRY_DEFAULTS.OTHER

  const revMultiple: [number, number, number] = body.revMultiple ?? defaults.revMultiple
  const ebitdaMultiple: [number, number, number] = body.ebitdaMultiple ?? defaults.ebitdaMultiple
  const sdeMultiple: [number, number, number] = body.sdeMultiple ?? defaults.sdeMultiple

  // Qualitative adjustments
  const qualFactors = computeQualAdjustments({
    revenueGrowthPct: revGrowthPct,
    grossMarginPct,
    ownerInvolvement,
    customerConcentrationPct,
    recurringRevenuePct,
  })
  const totalQualAdjPct = qualFactors.reduce((s, f) => s + f.pctAdjustment, 0)

  // Valuation
  const valuation = applyMethods(
    plTTM.totalRevenue,
    ebitdaCents,
    sdeCents,
    revMultiple,
    ebitdaMultiple,
    sdeMultiple,
    totalQualAdjPct,
  )

  // Drivers and detractors
  const drivers = qualFactors.filter((f) => f.pctAdjustment > 0)
  const detractors = qualFactors.filter((f) => f.pctAdjustment < 0)
  const neutral = qualFactors.filter((f) => f.pctAdjustment === 0)

  return NextResponse.json({
    entityId,
    entityName: entity.name,
    consolidated,
    asOf: now.toISOString(),
    ttmPeriod: { start: ttmStart.toISOString(), end: ttmEnd.toISOString() },

    // Financials (all cents)
    financials: {
      revenueTTMCents: plTTM.totalRevenue,
      cogsTTMCents: plTTM.totalCogs,
      grossProfitTTMCents: plTTM.grossProfit,
      grossMarginPct,
      expensesTTMCents: plTTM.totalExpenses,
      netIncomeTTMCents: plTTM.netIncome,
      interestExpenseCents: interestTax.interestExpenseCents,
      taxExpenseCents: interestTax.taxExpenseCents,
      depreciationCents,
      amortizationCents,
      ebitdaCents,
      ownerCompCents,
      addbacksCents,
      sdeCents,
      revGrowthPct,
      priorRevenueCents: plPrior.totalRevenue,
      ebitdaMarginPct: plTTM.totalRevenue > 0 ? (ebitdaCents / plTTM.totalRevenue) * 100 : 0,
    },

    // Multiples used
    multiples: { revMultiple, ebitdaMultiple, sdeMultiple },

    // Qualitative factors
    qualFactors,
    totalQualAdjPct,

    // Valuation results
    valuation,

    // Drivers / detractors
    drivers,
    detractors,
    neutral,

    // Inputs echoed for AI narrative
    inputs: { industry, ownerInvolvement, customerConcentrationPct, recurringRevenuePct },
  })
}
