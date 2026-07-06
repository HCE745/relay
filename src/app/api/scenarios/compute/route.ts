import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { getSelectedEntityId } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { getPL } from "@/lib/reports"
import { getAccountBalance } from "@/lib/ledger"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ─── PMT formula (standard loan amortization) ─────────────────────────────────
// Returns monthly payment in CENTS given principal in cents, annual rate %, term in months
function pmt(principalCents: number, annualRatePct: number, termMonths: number): number {
  if (annualRatePct === 0) return Math.round(principalCents / termMonths)
  const r = annualRatePct / 100 / 12
  const payment = principalCents * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1)
  return Math.round(payment)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentCash(tenantId: string, entityId: string): Promise<number> {
  const cashAccounts = await prisma.account.findMany({
    where: {
      tenantId, entityId, type: "ASSET",
      OR: [
        { name: { contains: "cash", mode: "insensitive" } },
        { code: { in: ["1000", "1010"] } },
      ],
    },
    select: { id: true },
  })
  let total = 0
  for (const acc of cashAccounts) {
    total += await getAccountBalance(tenantId, entityId, acc.id)
  }
  return total
}

async function getAvgMonthlyData(tenantId: string, entityId: string, months = 3) {
  const now = new Date()
  let expenseSum = 0, revenueSum = 0, burnSum = 0
  for (let i = 1; i <= months; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const pl = await getPL(tenantId, entityId, { start, end })
    expenseSum += pl.totalExpenses + pl.totalCogs
    revenueSum += pl.totalRevenue
    burnSum += Math.max(0, -(pl.netIncome)) // only count negative months for burn
  }
  return {
    avgMonthlyExpensesCents: Math.round(expenseSum / months),
    avgMonthlyRevenueCents: Math.round(revenueSum / months),
    avgMonthlyBurnCents: Math.round(burnSum / months), // avg burn (0 if profitable)
  }
}

function fmtCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const { tenantId } = session
  const body = await req.json()
  const deny = assertAccess(session, body.entityId, "read"); if (deny) return deny

  const entityId: string = body.entityId ?? (await getSelectedEntityId())
  const entity = await prisma.entity.findFirst({ where: { id: entityId, tenantId } })
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 })

  const scenarioType: string = body.type
  const withAI: boolean = body.withAI === true
  const inputs = body.inputs as Record<string, unknown>

  const [currentCash, monthly] = await Promise.all([
    getCurrentCash(tenantId, entityId),
    getAvgMonthlyData(tenantId, entityId),
  ])

  const { avgMonthlyExpensesCents, avgMonthlyRevenueCents, avgMonthlyBurnCents } = monthly
  const recommendedReserveCents = avgMonthlyExpensesCents * 3

  const before = {
    cashCents: currentCash,
    monthlyExpensesCents: avgMonthlyExpensesCents,
    monthlyRevenueCents: avgMonthlyRevenueCents,
    monthlyBurnCents: avgMonthlyBurnCents,
    runwayMonths: avgMonthlyBurnCents > 0
      ? Math.round((currentCash / avgMonthlyBurnCents) * 10) / 10
      : null,
    recommendedReserveCents,
  }

  let result: Record<string, unknown>
  let aiPrompt: string

  // ── HIRING ────────────────────────────────────────────────────────────────

  if (scenarioType === "HIRING") {
    const annualSalaryCents: number = (inputs.annualSalaryCents as number) ?? 0
    const benefitsPct: number = (inputs.benefitsPct as number) ?? 25
    const oneTimeCostsCents: number = (inputs.oneTimeCostsCents as number) ?? 0
    const startDate: string = (inputs.startDate as string) ?? new Date().toISOString().slice(0, 10)

    const baseMonthlyCents = Math.round(annualSalaryCents / 12)
    const fullyLoadedMonthlyCents = Math.round(baseMonthlyCents * (1 + benefitsPct / 100))
    const newMonthlyBurnCents = avgMonthlyBurnCents + fullyLoadedMonthlyCents
    const cashAfterOnetime = currentCash - oneTimeCostsCents
    const newRunway = newMonthlyBurnCents > 0
      ? Math.round((cashAfterOnetime / newMonthlyBurnCents) * 10) / 10
      : null

    const breakevenRevenueCents = avgMonthlyRevenueCents > 0 && avgMonthlyExpensesCents > 0
      ? Math.round(fullyLoadedMonthlyCents * (avgMonthlyRevenueCents / Math.max(avgMonthlyRevenueCents - avgMonthlyExpensesCents, 1)))
      : null

    result = {
      type: "HIRING",
      inputs: { annualSalaryCents, benefitsPct, oneTimeCostsCents, startDate },
      before,
      after: {
        cashCents: cashAfterOnetime,
        monthlyCostCents: fullyLoadedMonthlyCents,
        monthlyBurnCents: newMonthlyBurnCents,
        runwayMonths: newRunway,
        cashAfterOneMonth: cashAfterOnetime - newMonthlyBurnCents,
        cashAfterThreeMonths: cashAfterOnetime - newMonthlyBurnCents * 3,
        cashAfterTwelveMonths: cashAfterOnetime - newMonthlyBurnCents * 12,
      },
      math: {
        annualSalaryCents,
        baseMonthlyCents,
        benefitsPct,
        fullyLoadedMonthlyCents,
        oneTimeCostsCents,
        newMonthlyBurnCents,
        breakevenRevenueNeededCents: breakevenRevenueCents,
        runwayDeltaMonths: newRunway !== null && before.runwayMonths !== null
          ? Math.round((newRunway - before.runwayMonths) * 10) / 10
          : null,
      },
    }

    aiPrompt = `You are a CFO advisor for ${entity.name}. Summarize this hiring scenario in 2-3 paragraphs.

BEFORE:
  Current cash: ${fmtCents(before.cashCents)}
  Current runway: ${before.runwayMonths ?? "N/A"} months
  Avg monthly expenses: ${fmtCents(before.monthlyExpensesCents)}
  Avg monthly revenue: ${fmtCents(before.monthlyRevenueCents)}

HIRE DETAILS:
  Annual salary: ${fmtCents(annualSalaryCents)}
  Benefits/taxes (${benefitsPct}%): adds ${fmtCents(fullyLoadedMonthlyCents - baseMonthlyCents)}/mo
  Fully-loaded monthly cost: ${fmtCents(fullyLoadedMonthlyCents)}
  One-time costs (recruiting, equipment): ${fmtCents(oneTimeCostsCents)}
  Start date: ${startDate}

AFTER:
  Cash after one-time costs: ${fmtCents(cashAfterOnetime)}
  New monthly burn: ${fmtCents(newMonthlyBurnCents)}
  New runway: ${newRunway ?? "N/A"} months
  Cash after 3 months: ${fmtCents(cashAfterOnetime - newMonthlyBurnCents * 3)}
  Cash after 12 months: ${fmtCents(cashAfterOnetime - newMonthlyBurnCents * 12)}
  Breakeven additional revenue needed: ${breakevenRevenueCents ? fmtCents(breakevenRevenueCents) + "/mo" : "N/A"}

Write: (1) What this hire costs and how it changes the burn rate, (2) Cash timeline and runway impact, (3) Whether the numbers suggest this is affordable given the reserve. DO NOT state any figures not listed above.`
  }

  // ── EQUIPMENT ─────────────────────────────────────────────────────────────

  else if (scenarioType === "EQUIPMENT") {
    const costCents: number = inputs.costCents as number
    const isFinanced: boolean = inputs.isFinanced === true
    const downPaymentCents: number = (inputs.downPaymentCents as number) ?? 0
    const loanTermMonths: number = (inputs.loanTermMonths as number) ?? 60
    const annualRatePct: number = (inputs.annualRatePct as number) ?? 0
    const usefulLifeMonths: number = (inputs.usefulLifeMonths as number) ?? 60

    // Cash scenario
    const cashScenario = {
      upfrontCashCents: costCents,
      cashAfterPurchase: currentCash - costCents,
      monthlyBurnCents: avgMonthlyBurnCents,
      runwayMonths: avgMonthlyBurnCents > 0
        ? Math.round(((currentCash - costCents) / avgMonthlyBurnCents) * 10) / 10
        : null,
    }

    // Finance scenario
    const principalCents = costCents - downPaymentCents
    const monthlyPaymentCents = isFinanced ? pmt(principalCents, annualRatePct, loanTermMonths) : 0
    const totalInterestCents = isFinanced ? monthlyPaymentCents * loanTermMonths - principalCents : 0
    const financedNewBurn = avgMonthlyBurnCents + monthlyPaymentCents
    const financeScenario = {
      downPaymentCents,
      principalCents,
      monthlyPaymentCents,
      totalInterestCents,
      totalCostCents: costCents + totalInterestCents,
      cashAfterDown: currentCash - downPaymentCents,
      monthlyBurnCents: financedNewBurn,
      runwayMonths: financedNewBurn > 0
        ? Math.round(((currentCash - downPaymentCents) / financedNewBurn) * 10) / 10
        : null,
    }

    const monthlyDepreciationCents = Math.round(costCents / usefulLifeMonths)

    result = {
      type: "EQUIPMENT",
      inputs: { costCents, isFinanced, downPaymentCents, loanTermMonths, annualRatePct, usefulLifeMonths },
      before,
      cashScenario,
      financeScenario: isFinanced ? financeScenario : null,
      depreciation: {
        usefulLifeMonths,
        monthlyDepreciationCents,
        annualDepreciationCents: monthlyDepreciationCents * 12,
      },
      recommendation: !isFinanced
        ? (currentCash - costCents > recommendedReserveCents ? "cash_viable" : "cash_tight")
        : "finance_comparison_shown",
    }

    aiPrompt = `You are a CFO advisor for ${entity.name}. Summarize this equipment purchase scenario.

EQUIPMENT COST: ${fmtCents(costCents)}
BEFORE: Cash: ${fmtCents(before.cashCents)} | Runway: ${before.runwayMonths ?? "N/A"} months

CASH PURCHASE:
  Immediate cash outflow: ${fmtCents(costCents)}
  Cash remaining: ${fmtCents(cashScenario.cashAfterPurchase)}
  Runway unchanged: ${cashScenario.runwayMonths ?? "N/A"} months
  3-month reserve needed: ${fmtCents(recommendedReserveCents)}

${isFinanced ? `FINANCED:
  Down payment: ${fmtCents(downPaymentCents)}
  Loan: ${fmtCents(principalCents)} at ${annualRatePct}% for ${loanTermMonths} months
  Monthly payment: ${fmtCents(monthlyPaymentCents)}
  Total interest paid: ${fmtCents(totalInterestCents)}
  All-in cost: ${fmtCents(financeScenario.totalCostCents)}
  Cash after down payment: ${fmtCents(financeScenario.cashAfterDown)}
  New monthly burn: ${fmtCents(financeScenario.monthlyBurnCents)}
  Runway with payments: ${financeScenario.runwayMonths ?? "N/A"} months` : ""}

DEPRECIATION: ${fmtCents(monthlyDepreciationCents)}/month over ${usefulLifeMonths} months (${fmtCents(monthlyDepreciationCents * 12)}/year)

Write 2-3 paragraphs: (1) cash impact and reserve status, ${isFinanced ? "(2) cash vs finance comparison: which preserves runway better?," : ""} (3) depreciation note linking to the Fixed Assets module. DO NOT state figures not listed above.`
  }

  // ── DEBT ──────────────────────────────────────────────────────────────────

  else if (scenarioType === "DEBT") {
    const principalCents: number = inputs.principalCents as number
    const annualRatePct: number = (inputs.annualRatePct as number) ?? 0
    const termMonths: number = inputs.termMonths as number

    const monthlyPaymentCents = pmt(principalCents, annualRatePct, termMonths)
    const totalInterestCents = monthlyPaymentCents * termMonths - principalCents
    const totalCostCents = principalCents + totalInterestCents

    // Loan proceeds improve immediate cash
    const cashWithLoan = currentCash + principalCents
    const newBurn = avgMonthlyBurnCents + monthlyPaymentCents
    const newRunway = newBurn > 0
      ? Math.round((cashWithLoan / newBurn) * 10) / 10
      : null

    result = {
      type: "DEBT",
      inputs: { principalCents, annualRatePct, termMonths },
      before,
      after: {
        loanProceedsCents: principalCents,
        cashAfterFunding: cashWithLoan,
        monthlyPaymentCents,
        totalInterestCents,
        totalCostCents,
        newMonthlyBurnCents: newBurn,
        runwayMonths: newRunway,
        interestRateCost: annualRatePct > 0
          ? `${((totalInterestCents / principalCents) * 100).toFixed(1)}% total interest cost on principal`
          : "0% interest",
      },
      amortizationHighlights: {
        payment1: { principal: principalCents, interest: 0, remaining: principalCents }, // simplified
        month6Payment: monthlyPaymentCents,
        month12Payment: monthlyPaymentCents,
      },
    }

    aiPrompt = `You are a CFO advisor for ${entity.name}. Summarize this debt/loan scenario.

LOAN: ${fmtCents(principalCents)} at ${annualRatePct}% for ${termMonths} months
BEFORE: Cash: ${fmtCents(before.cashCents)} | Avg monthly burn: ${fmtCents(before.monthlyBurnCents)} | Runway: ${before.runwayMonths ?? "N/A"} months

AFTER FUNDING:
  Cash (with loan proceeds): ${fmtCents(cashWithLoan)}
  Monthly payment: ${fmtCents(monthlyPaymentCents)}
  Total interest: ${fmtCents(totalInterestCents)}
  All-in repayment: ${fmtCents(totalCostCents)}
  New monthly burn: ${fmtCents(newBurn)}
  Runway with loan: ${newRunway ?? "N/A"} months

Write 2-3 paragraphs: (1) what the loan proceeds do to the cash position, (2) the monthly payment burden and its effect on burn rate and runway, (3) total cost of the debt. DO NOT state figures not listed above.`
  }

  else {
    return NextResponse.json({ error: "Unknown scenario type. Use HIRING, EQUIPMENT, or DEBT." }, { status: 400 })
  }

  // Optional AI summary
  let aiSummary: string | null = null
  if (withAI) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        messages: [{ role: "user", content: aiPrompt! }],
      })
      aiSummary = response.content[0].type === "text" ? response.content[0].text : null
    } catch {
      aiSummary = null
    }
  }

  return NextResponse.json({ ...result, aiSummary })
}
