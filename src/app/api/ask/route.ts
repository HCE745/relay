import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { getSelectedEntityId } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { getPL } from "@/lib/reports"
import { getAccountBalance } from "@/lib/ledger"
import { getBalanceSheet } from "@/lib/reports"
import Anthropic from "@anthropic-ai/sdk"

// Local shape types for Prisma select results
type AccountMeta = { id: string; code: string; name: string; type: string }
type EntityMeta = { id: string; name: string; isConsolidationParent: boolean }
type BalanceRow = { code: string; name: string; type: string; balanceCents: number }
type CashRow = { code: string; name: string; balanceCents: number }
type BillRow = { id: string; date: Date; total: number; amountPaid: number; amountDue: number; status: string; vendor: { id: string; name: string } }
type BillSummaryRow = { total: number; vendor: { id: string; name: string } }
type InvoiceRow = { id: string; invoiceNumber: string; date: Date; dueDate: Date; total: number; amountPaid: number; amountDue: number; status: string; customer: { id: string; name: string } }
type BillAPRow = { id: string; billNumber: string | null; date: Date; dueDate: Date; total: number; amountPaid: number; amountDue: number; status: string; vendor: { id: string; name: string } }

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type QueryIntentType =
  | "pl"
  | "balance_sheet"
  | "account_balance"
  | "vendor_spend"
  | "top_vendors"
  | "cash_position"
  | "ar_summary"
  | "ap_summary"
  | "affordability"
  | "profit_drop"
  | "tax_estimate"
  | "cash_recommendation"

interface QueryIntent {
  type: QueryIntentType
  entityId: string
  consolidated: boolean
  dateStart: string
  dateEnd: string
  accountCodes: string[] | null
  topN: number | null
  canAnswer: boolean
  cantAnswerReason: string | null
  // CFO-question fields
  affordabilityAmountCents: number | null   // annual cost in cents for hire/purchase
  affordabilityType: "hire" | "purchase" | null
  compareDateStart: string | null           // prior-period start for profit_drop
  compareDateEnd: string | null             // prior-period end
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

async function getCurrentCash(tenantId: string, entityId: string): Promise<number> {
  const cashAccounts = await prisma.account.findMany({
    where: {
      tenantId, entityId, type: "ASSET",
      OR: [
        { name: { contains: "cash", mode: "insensitive" } },
        { code: { in: ["1000", "1010"] } },
      ],
    },
    select: { id: true, code: true, name: true },
  })
  let total = 0
  for (const acc of cashAccounts) {
    total += await getAccountBalance(tenantId, entityId, acc.id)
  }
  return total
}

async function getAvgMonthlyBurn(tenantId: string, entityId: string, months = 3): Promise<number> {
  const now = new Date()
  let total = 0
  for (let i = 1; i <= months; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const pl = await getPL(tenantId, entityId, { start, end })
    total += -(pl.netIncome) // burn = negative net income; 0 if profitable
  }
  const avgBurn = total / months
  return avgBurn // positive = burning cash; negative = building cash
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const { tenantId } = session

  let body: { question?: string; entityId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { question } = body
  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json({ error: "question is required" }, { status: 400 })
  }

  const sessionEntityId = await getSelectedEntityId()

  const [accountsMeta, entitiesMeta] = (await Promise.all([
    prisma.account.findMany({
      where: { tenantId, entityId: sessionEntityId },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { code: "asc" },
    }),
    prisma.entity.findMany({
      where: { tenantId },
      select: { id: true, name: true, isConsolidationParent: true },
      orderBy: { name: "asc" },
    }),
  ])) as [AccountMeta[], EntityMeta[]]

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const year = now.getFullYear()
  const monthStart = new Date(year, now.getMonth(), 1).toISOString().slice(0, 10)
  const monthEnd = new Date(year, now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const priorMonthStart = new Date(year, now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const priorMonthEnd = new Date(year, now.getMonth(), 0).toISOString().slice(0, 10)
  const ytdStart = new Date(year, 0, 1).toISOString().slice(0, 10)

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `You are an accounting query parser. Given a user's question about their books, return a JSON QueryIntent object.

ENTITIES available:
${entitiesMeta.map((e: EntityMeta) => `  ${e.id}: ${e.name}${e.isConsolidationParent ? " (consolidation parent)" : ""}`).join("\n")}

ACCOUNTS available:
${accountsMeta.map((a: AccountMeta) => `  ${a.code} ${a.name} (${a.type})`).join("\n")}

TODAY: ${today}
CURRENT_YEAR: ${year}
CURRENT_MONTH_START: ${monthStart}
CURRENT_MONTH_END: ${monthEnd}
PRIOR_MONTH_START: ${priorMonthStart}
PRIOR_MONTH_END: ${priorMonthEnd}
YTD_START: ${ytdStart}

Return exactly this JSON (no prose, no markdown fences):
{
  "type": "pl" | "balance_sheet" | "account_balance" | "vendor_spend" | "top_vendors" | "cash_position" | "ar_summary" | "ap_summary" | "affordability" | "profit_drop" | "tax_estimate" | "cash_recommendation",
  "entityId": string (must be one of the entity IDs above, or "current" to use the active entity),
  "consolidated": boolean,
  "dateStart": "YYYY-MM-DD",
  "dateEnd": "YYYY-MM-DD",
  "accountCodes": string[] | null,
  "topN": number | null,
  "canAnswer": boolean,
  "cantAnswerReason": string | null,
  "affordabilityAmountCents": number | null,
  "affordabilityType": "hire" | "purchase" | null,
  "compareDateStart": "YYYY-MM-DD" | null,
  "compareDateEnd": "YYYY-MM-DD" | null
}

Intent types and when to use them:
- pl: profit/loss, revenue, expenses, net income questions
- balance_sheet: assets, liabilities, equity questions
- account_balance: balance of a specific account
- vendor_spend: spending with a vendor
- top_vendors: top vendors by spend
- cash_position: current cash/bank balance
- ar_summary: accounts receivable, outstanding invoices
- ap_summary: accounts payable, outstanding bills
- affordability: "can we afford", "can we hire", "can we buy", "do we have enough cash for"
  → set affordabilityAmountCents to the ANNUAL dollar amount * 100 (e.g. "$60k salary" = 6000000)
  → set affordabilityType to "hire" or "purchase"
  → dateStart/dateEnd = current month
- profit_drop: "why did profit drop/change", "explain the profit change", "what drove the variance"
  → dateStart/dateEnd = current month (the "current" period)
  → compareDateStart/compareDateEnd = prior month (the comparison period)
- tax_estimate: "what is our tax bill", "estimated taxes", "how much do we owe in taxes"
  → dateStart/dateEnd = YTD
- cash_recommendation: "how much cash should we keep", "what is the right cash reserve"
  → dateStart/dateEnd = current month

Rules:
- entityId must be one of the known entity IDs listed above, or "current"
- dateStart/dateEnd must be actual calendar dates from context above
- consolidated should only be true if the chosen entity is a consolidation parent
- If the question cannot be mapped, set canAnswer=false
- Never invent account codes or entity IDs not in the lists above
- For affordability: extract the dollar amount explicitly mentioned (e.g. "60k" = 60000, "$120,000" = 120000); multiply by 100 for cents`

  let intent: QueryIntent
  try {
    const parseResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: question.trim() }],
    })

    const rawText = parseResponse.content[0].type === "text" ? parseResponse.content[0].text : ""
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    intent = JSON.parse(cleaned) as QueryIntent
  } catch {
    return NextResponse.json(
      { error: "Failed to parse question into a structured query. Please rephrase your question." },
      { status: 422 },
    )
  }

  if (!intent.canAnswer) {
    return NextResponse.json({
      answer: intent.cantAnswerReason ?? "I can only answer questions about your accounting data.",
      data: null,
      intent,
    })
  }

  // Resolve entity
  let resolvedEntityId: string
  if (intent.entityId === "current" || !intent.entityId) {
    resolvedEntityId = sessionEntityId
  } else {
    const found = entitiesMeta.find((e: EntityMeta) => e.id === intent.entityId)
    resolvedEntityId = found ? found.id : sessionEntityId
    if (!found) intent.entityId = sessionEntityId
  }

  const start = new Date(intent.dateStart)
  const end = new Date(intent.dateEnd)
  const period = { start, end }

  let rawData: unknown
  try {
    switch (intent.type) {
      case "pl": {
        rawData = await getPL(tenantId, resolvedEntityId, period, { consolidated: intent.consolidated })
        break
      }

      case "balance_sheet": {
        rawData = await getBalanceSheet(tenantId, resolvedEntityId, end, { consolidated: intent.consolidated })
        break
      }

      case "account_balance": {
        const codes = intent.accountCodes ?? []
        const accounts = (await prisma.account.findMany({
          where: { tenantId, entityId: resolvedEntityId, code: { in: codes } },
          select: { id: true, code: true, name: true, type: true },
        })) as AccountMeta[]
        const balances: BalanceRow[] = await Promise.all(
          accounts.map(async (acc: AccountMeta) => {
            const balance = await getAccountBalance(tenantId, resolvedEntityId, acc.id, {
              periodStart: start,
              periodEnd: end,
            })
            return { code: acc.code, name: acc.name, type: acc.type, balanceCents: balance }
          }),
        )
        rawData = { accounts: balances, totalBalanceCents: balances.reduce((s: number, b: BalanceRow) => s + b.balanceCents, 0) }
        break
      }

      case "cash_position": {
        const codes = intent.accountCodes ?? []
        const cashAccounts = (await prisma.account.findMany({
          where: {
            tenantId, entityId: resolvedEntityId,
            OR: [
              codes.length > 0 ? { code: { in: codes } } : {},
              { code: { in: ["1000", "1010"] } },
              { name: { contains: "cash", mode: "insensitive" } },
            ],
          },
          select: { id: true, code: true, name: true, type: true },
        })) as AccountMeta[]
        const balances: CashRow[] = await Promise.all(
          cashAccounts.map(async (acc: AccountMeta) => {
            const balance = await getAccountBalance(tenantId, resolvedEntityId, acc.id, { periodEnd: end })
            return { code: acc.code, name: acc.name, balanceCents: balance }
          }),
        )
        rawData = { cashAccounts: balances, totalCashCents: balances.reduce((s: number, b: CashRow) => s + b.balanceCents, 0) }
        break
      }

      case "vendor_spend": {
        const bills = (await prisma.bill.findMany({
          where: { tenantId, entityId: resolvedEntityId, date: { gte: start, lte: end } },
          select: { id: true, date: true, total: true, amountPaid: true, amountDue: true, status: true, vendor: { select: { id: true, name: true } } },
          orderBy: { date: "desc" },
        })) as BillRow[]
        rawData = { bills, totalSpendCents: bills.reduce((s: number, b: BillRow) => s + b.total, 0), billCount: bills.length }
        break
      }

      case "top_vendors": {
        const topN = intent.topN ?? 10
        const bills = (await prisma.bill.findMany({
          where: { tenantId, entityId: resolvedEntityId, date: { gte: start, lte: end } },
          select: { total: true, vendor: { select: { id: true, name: true } } },
        })) as BillSummaryRow[]
        const byVendor = new Map<string, { vendorId: string; vendorName: string; totalCents: number; billCount: number }>()
        for (const bill of bills) {
          const key = bill.vendor.id
          const ex = byVendor.get(key)
          if (ex) { ex.totalCents += bill.total; ex.billCount++ }
          else byVendor.set(key, { vendorId: bill.vendor.id, vendorName: bill.vendor.name, totalCents: bill.total, billCount: 1 })
        }
        const sorted = Array.from(byVendor.values()).sort((a, b) => b.totalCents - a.totalCents).slice(0, topN)
        rawData = { topVendors: sorted, totalVendors: byVendor.size }
        break
      }

      case "ar_summary": {
        const invoices = (await prisma.invoice.findMany({
          where: { tenantId, entityId: resolvedEntityId, date: { gte: start, lte: end } },
          select: { id: true, invoiceNumber: true, date: true, dueDate: true, total: true, amountPaid: true, amountDue: true, status: true, customer: { select: { id: true, name: true } } },
          orderBy: { date: "desc" },
        })) as InvoiceRow[]
        rawData = {
          invoices, invoiceCount: invoices.length,
          totalInvoicedCents: invoices.reduce((s: number, i: InvoiceRow) => s + i.total, 0),
          totalOutstandingCents: invoices.reduce((s: number, i: InvoiceRow) => s + i.amountDue, 0),
        }
        break
      }

      case "ap_summary": {
        const bills = (await prisma.bill.findMany({
          where: { tenantId, entityId: resolvedEntityId, date: { gte: start, lte: end } },
          select: { id: true, billNumber: true, date: true, dueDate: true, total: true, amountPaid: true, amountDue: true, status: true, vendor: { select: { id: true, name: true } } },
          orderBy: { date: "desc" },
        })) as BillAPRow[]
        rawData = {
          bills, billCount: bills.length,
          totalBilledCents: bills.reduce((s: number, b: BillAPRow) => s + b.total, 0),
          totalOutstandingCents: bills.reduce((s: number, b: BillAPRow) => s + b.amountDue, 0),
        }
        break
      }

      // ── CFO Decision Intents ─────────────────────────────────────────────────

      case "affordability": {
        const annualCostCents = intent.affordabilityAmountCents ?? 0
        const monthlyCostCents = Math.round(annualCostCents / 12)
        const type = intent.affordabilityType ?? "hire"

        const [currentCash, avgBurn] = await Promise.all([
          getCurrentCash(tenantId, resolvedEntityId),
          getAvgMonthlyBurn(tenantId, resolvedEntityId),
        ])

        // Reserve = 3 months of historical avg expenses
        const now2 = new Date()
        let expensesSum = 0
        for (let i = 1; i <= 3; i++) {
          const s = new Date(now2.getFullYear(), now2.getMonth() - i, 1)
          const e = new Date(now2.getFullYear(), now2.getMonth() - i + 1, 0, 23, 59, 59, 999)
          const pl = await getPL(tenantId, resolvedEntityId, { start: s, end: e })
          expensesSum += pl.totalExpenses + pl.totalCogs
        }
        const avgMonthlyExpenses = Math.round(expensesSum / 3)
        const recommendedReserveCents = avgMonthlyExpenses * 3

        const surplusAboveReserve = currentCash - recommendedReserveCents
        const benefitsMultiplier = type === "hire" ? 1.25 : 1.0 // 25% benefits/taxes for hires
        const fullyLoadedMonthlyCents = Math.round(monthlyCostCents * benefitsMultiplier)

        const newMonthlyBurn = avgBurn + fullyLoadedMonthlyCents
        const oldRunway = avgBurn > 0 ? Math.round((currentCash / avgBurn) * 10) / 10 : null
        const newRunway = newMonthlyBurn > 0 ? Math.round((currentCash / newMonthlyBurn) * 10) / 10 : null

        // Breakeven: additional revenue needed to cover the new cost at current margin
        const now3 = new Date()
        const mtdPL = await getPL(tenantId, resolvedEntityId, {
          start: new Date(now3.getFullYear(), now3.getMonth(), 1),
          end: now3,
        })
        const marginPct = mtdPL.totalRevenue > 0 ? mtdPL.grossProfit / mtdPL.totalRevenue : null
        const breakevenRevenueCents = marginPct && marginPct > 0
          ? Math.round(fullyLoadedMonthlyCents / marginPct)
          : null

        rawData = {
          question: question.trim(),
          type,
          annualCostCents,
          monthlyCostCents,
          fullyLoadedMonthlyCents,
          benefitsMultiplier,
          currentCashCents: currentCash,
          avgMonthlyExpensesCents: avgMonthlyExpenses,
          recommendedReserveCents,
          surplusAboveReserveCents: surplusAboveReserve,
          avgMonthlyBurnCents: avgBurn,
          newMonthlyBurnCents: newMonthlyBurn,
          currentRunwayMonths: oldRunway,
          newRunwayMonths: newRunway,
          breakevenRevenueNeededCents: breakevenRevenueCents,
          canAfford: surplusAboveReserve >= fullyLoadedMonthlyCents * 3, // 3-month buffer
          breakdown: [
            { label: "Annual cost asked about", amountCents: annualCostCents },
            { label: `Monthly cost (${type === "hire" ? "salary" : "payment"})`, amountCents: monthlyCostCents },
            ...(type === "hire" ? [{ label: "Fully-loaded (×1.25 for benefits/taxes)", amountCents: fullyLoadedMonthlyCents }] : []),
            { label: "Current cash", amountCents: currentCash },
            { label: "Recommended 3-month reserve", amountCents: -recommendedReserveCents },
            { label: "Cash available above reserve", amountCents: surplusAboveReserve },
          ],
        }
        break
      }

      case "profit_drop": {
        const compareStart = intent.compareDateStart
          ? new Date(intent.compareDateStart)
          : new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const compareEnd = intent.compareDateEnd
          ? new Date(intent.compareDateEnd)
          : new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

        const [plCurrent, plPrior] = await Promise.all([
          getPL(tenantId, resolvedEntityId, period, { consolidated: intent.consolidated }),
          getPL(tenantId, resolvedEntityId, { start: compareStart, end: compareEnd }, { consolidated: intent.consolidated }),
        ])

        const netIncomeDelta = plCurrent.netIncome - plPrior.netIncome

        // Find account-level drivers: merge both periods into a map
        type PeriodEntry = { account: string; current: number; prior: number; delta: number }
        const accountMap = new Map<string, PeriodEntry>()
        const addLines = (lines: { code: string; name: string; amount: number }[], period: "current" | "prior") => {
          for (const l of lines) {
            const key = `${l.code}|${l.name}`
            const ex = accountMap.get(key) ?? { account: `${l.code} ${l.name}`, current: 0, prior: 0, delta: 0 }
            if (period === "current") ex.current = l.amount
            else ex.prior = l.amount
            accountMap.set(key, ex)
          }
        }
        addLines(plCurrent.revenue, "current"); addLines(plPrior.revenue, "prior")
        addLines(plCurrent.cogs, "current"); addLines(plPrior.cogs, "prior")
        addLines(plCurrent.expenses, "current"); addLines(plPrior.expenses, "prior")
        for (const [k, v] of accountMap) {
          v.delta = v.current - v.prior
          accountMap.set(k, v)
        }
        const drivers = Array.from(accountMap.values())
          .filter((v) => Math.abs(v.delta) > 0)
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 8)

        rawData = {
          currentPeriod: { start: intent.dateStart, end: intent.dateEnd },
          priorPeriod: { start: compareStart.toISOString().slice(0, 10), end: compareEnd.toISOString().slice(0, 10) },
          plCurrent: { totalRevenue: plCurrent.totalRevenue, totalExpenses: plCurrent.totalExpenses, totalCogs: plCurrent.totalCogs, netIncome: plCurrent.netIncome },
          plPrior: { totalRevenue: plPrior.totalRevenue, totalExpenses: plPrior.totalExpenses, totalCogs: plPrior.totalCogs, netIncome: plPrior.netIncome },
          netIncomeDelta,
          revenueDelta: plCurrent.totalRevenue - plPrior.totalRevenue,
          expensesDelta: plCurrent.totalExpenses - plPrior.totalExpenses,
          cogsDelta: plCurrent.totalCogs - plPrior.totalCogs,
          topDrivers: drivers,
        }
        break
      }

      case "tax_estimate": {
        const ytdPL = await getPL(tenantId, resolvedEntityId, period, { consolidated: intent.consolidated })
        // Placeholder rate — clearly labeled as estimate
        const estimateRatePct = 21 // U.S. corp rate placeholder
        const taxEstimateCents = Math.max(0, Math.round(ytdPL.netIncome * estimateRatePct / 100))
        rawData = {
          ytdNetIncomeCents: ytdPL.netIncome,
          ytdRevenueCents: ytdPL.totalRevenue,
          ytdExpensesCents: ytdPL.totalExpenses,
          estimateRatePct,
          taxEstimateCents,
          disclaimer: "TAX MODULE NOT YET BUILT. This is a rough placeholder using a flat rate applied to net income. It does NOT account for deductions, credits, entity type, or jurisdiction-specific rules. Consult a tax professional for any actual tax planning.",
          period: { start: intent.dateStart, end: intent.dateEnd },
        }
        break
      }

      case "cash_recommendation": {
        const now4 = new Date()
        let expTotal = 0
        for (let i = 1; i <= 3; i++) {
          const s = new Date(now4.getFullYear(), now4.getMonth() - i, 1)
          const e = new Date(now4.getFullYear(), now4.getMonth() - i + 1, 0, 23, 59, 59, 999)
          const pl = await getPL(tenantId, resolvedEntityId, { start: s, end: e })
          expTotal += pl.totalExpenses + pl.totalCogs
        }
        const avgMonthlyExpenses = Math.round(expTotal / 3)

        const [currentCash2] = await Promise.all([getCurrentCash(tenantId, resolvedEntityId)])

        const apDue30 = await prisma.bill.aggregate({
          where: {
            tenantId, entityId: resolvedEntityId,
            status: { in: ["ENTERED", "PARTIAL"] },
            dueDate: { lte: new Date(now4.getTime() + 30 * 24 * 60 * 60 * 1000) },
          },
          _sum: { amountDue: true },
        })

        rawData = {
          currentCashCents: currentCash2,
          avgMonthlyExpensesCents: avgMonthlyExpenses,
          minimumReserveCents: avgMonthlyExpenses * 3,
          recommendedReserveCents: avgMonthlyExpenses * 6,
          apDue30Cents: apDue30._sum.amountDue ?? 0,
          surplusShortfall3mo: currentCash2 - avgMonthlyExpenses * 3,
          surplusShortfall6mo: currentCash2 - avgMonthlyExpenses * 6,
          recommendation: currentCash2 >= avgMonthlyExpenses * 6
            ? "above_recommended"
            : currentCash2 >= avgMonthlyExpenses * 3
            ? "at_minimum"
            : "below_minimum",
        }
        break
      }

      default: {
        return NextResponse.json({ error: "Unsupported query type" }, { status: 422 })
      }
    }
  } catch {
    return NextResponse.json({ error: "Failed to retrieve data. Please try again." }, { status: 500 })
  }

  // Step 4 — Format answer using AI (narrates computed data; never invents)
  const entityName = entitiesMeta.find((e: EntityMeta) => e.id === resolvedEntityId)?.name ?? resolvedEntityId

  const formatPrompt = intent.type === "affordability"
    ? buildAffordabilityPrompt(question, entityName, rawData)
    : intent.type === "profit_drop"
    ? buildProfitDropPrompt(question, entityName, rawData)
    : intent.type === "tax_estimate"
    ? buildTaxPrompt(question, entityName, rawData)
    : intent.type === "cash_recommendation"
    ? buildCashRecoPrompt(question, entityName, rawData)
    : `You are an accounting assistant for a business. The user asked: "${question.trim()}"

Entity: ${entityName}
Period: ${intent.dateStart} to ${intent.dateEnd}
Data (all monetary amounts are in cents; divide by 100 for dollars):
${JSON.stringify(rawData, null, 2)}

Give a clear, concise answer in 1-3 sentences summarizing what the data shows. Then list the key numbers formatted as dollars. Do not include any data not present above. Do not make assumptions beyond the data provided.`

  let answer: string
  try {
    const formatResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{ role: "user", content: formatPrompt }],
    })
    answer = formatResponse.content[0].type === "text" ? formatResponse.content[0].text : "Data retrieved. See the supporting data below."
  } catch {
    answer = "Data retrieved successfully. See the supporting data below."
  }

  return NextResponse.json({ answer, data: rawData, intent })
}

// ─── Specialized prompt builders ──────────────────────────────────────────────

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function buildAffordabilityPrompt(question: string, entityName: string, d: unknown): string {
  const data = d as Record<string, unknown>
  return `You are the AI CFO advisor for ${entityName}. The user asked: "${question}"

Here are the REAL computed numbers (do NOT invent any figures not listed here):

Annual cost in question: ${fmt(data.annualCostCents as number)}
Monthly cost: ${fmt(data.monthlyCostCents as number)}
Fully-loaded monthly (×${data.benefitsMultiplier} for ${data.type === "hire" ? "benefits/taxes" : "N/A"}): ${fmt(data.fullyLoadedMonthlyCents as number)}
Current cash: ${fmt(data.currentCashCents as number)}
Avg monthly operating expenses: ${fmt(data.avgMonthlyExpensesCents as number)}
Recommended 3-month reserve: ${fmt(data.recommendedReserveCents as number)}
Cash above reserve: ${fmt(data.surplusAboveReserveCents as number)}
Current monthly burn rate: ${fmt(data.avgMonthlyBurnCents as number)}
New monthly burn with this cost: ${fmt(data.newMonthlyBurnCents as number)}
Current runway: ${data.currentRunwayMonths ?? "N/A"} months
New runway with this cost: ${data.newRunwayMonths ?? "N/A"} months
${data.breakevenRevenueNeededCents ? `Additional monthly revenue needed to break even: ${fmt(data.breakevenRevenueNeededCents as number)}` : ""}
Affordability assessment (cash above reserve ≥ 3× monthly cost): ${data.canAfford ? "YES" : "NO"}

Write a 2-3 paragraph CFO advisory response:
1. Direct answer: can the business afford this?
2. The numbers: cash position, reserve status, impact on runway
3. Recommendation or caution grounded in the numbers above

DO NOT compute, estimate, or state any numbers not listed above. Narrate only what the data shows.`
}

function buildProfitDropPrompt(question: string, entityName: string, d: unknown): string {
  const data = d as Record<string, unknown>
  const drivers = data.topDrivers as { account: string; current: number; prior: number; delta: number }[]
  const driverLines = drivers.map((dr) =>
    `  ${dr.account}: ${fmt(dr.prior)} → ${fmt(dr.current)} (change: ${fmt(dr.delta)})`
  ).join("\n")

  return `You are the AI CFO advisor for ${entityName}. The user asked: "${question}"

REAL computed numbers — do NOT invent any figures not listed here:

Comparison periods:
  Current: ${(data.currentPeriod as { start: string; end: string }).start} to ${(data.currentPeriod as { start: string; end: string }).end}
  Prior:   ${(data.priorPeriod as { start: string; end: string }).start} to ${(data.priorPeriod as { start: string; end: string }).end}

P&L Summary:
  Revenue:  ${fmt((data.plPrior as Record<string, number>).totalRevenue)} → ${fmt((data.plCurrent as Record<string, number>).totalRevenue)} (change: ${fmt(data.revenueDelta as number)})
  COGS:     ${fmt((data.plPrior as Record<string, number>).totalCogs)} → ${fmt((data.plCurrent as Record<string, number>).totalCogs)} (change: ${fmt(data.cogsDelta as number)})
  Expenses: ${fmt((data.plPrior as Record<string, number>).totalExpenses)} → ${fmt((data.plCurrent as Record<string, number>).totalExpenses)} (change: ${fmt(data.expensesDelta as number)})
  Net Income: ${fmt((data.plPrior as Record<string, number>).netIncome)} → ${fmt((data.plCurrent as Record<string, number>).netIncome)} (change: ${fmt(data.netIncomeDelta as number)})

Top account-level drivers (sorted by size of change):
${driverLines || "  No account-level data available."}

Write a 2-3 paragraph analysis:
1. Summary: how much did profit change and in what direction?
2. Account-level drivers: which specific accounts drove the change (use the names above, not generic descriptions)?
3. Brief interpretation of what these account movements likely mean

DO NOT compute, estimate, or state any numbers not listed above. Narrate only what the data shows.`
}

function buildTaxPrompt(question: string, entityName: string, d: unknown): string {
  const data = d as Record<string, unknown>
  return `You are the AI CFO advisor for ${entityName}. The user asked: "${question}"

REAL computed numbers:

YTD Revenue: ${fmt(data.ytdRevenueCents as number)}
YTD Expenses: ${fmt(data.ytdExpensesCents as number)}
YTD Net Income: ${fmt(data.ytdNetIncomeCents as number)}
Placeholder estimate rate: ${data.estimateRatePct}% (flat rate, NOT authoritative)
Rough tax estimate at that rate: ${fmt(data.taxEstimateCents as number)}
Period: ${(data.period as { start: string }).start} to ${(data.period as { end: string }).end}

IMPORTANT DISCLAIMER TO INCLUDE VERBATIM: "${data.disclaimer}"

Write a response that:
1. States the YTD net income clearly
2. Gives the rough estimate clearly labeled as a PLACEHOLDER ESTIMATE
3. Repeats the disclaimer so the user understands this is not tax advice

DO NOT compute any number not listed above.`
}

function buildCashRecoPrompt(question: string, entityName: string, d: unknown): string {
  const data = d as Record<string, unknown>
  const recStr = data.recommendation === "above_recommended" ? "above the recommended level"
    : data.recommendation === "at_minimum" ? "at the minimum but below the recommended level"
    : "below the minimum recommended level"

  return `You are the AI CFO advisor for ${entityName}. The user asked: "${question}"

REAL computed numbers:

Current cash: ${fmt(data.currentCashCents as number)}
Avg monthly operating expenses (last 3 months): ${fmt(data.avgMonthlyExpensesCents as number)}
Minimum reserve (3 months expenses): ${fmt(data.minimumReserveCents as number)}
Recommended reserve (6 months expenses): ${fmt(data.recommendedReserveCents as number)}
AP due next 30 days: ${fmt(data.apDue30Cents as number)}
Cash vs 3-month reserve: ${fmt(data.surplusShortfall3mo as number)} ${(data.surplusShortfall3mo as number) >= 0 ? "surplus" : "shortfall"}
Cash vs 6-month reserve: ${fmt(data.surplusShortfall6mo as number)} ${(data.surplusShortfall6mo as number) >= 0 ? "surplus" : "shortfall"}
Status: ${recStr}

Write a 2-3 paragraph advisory:
1. What the data shows about the current cash position vs the two reserve benchmarks
2. Concrete recommendation (minimum of 3 months, ideally 6 months of expenses)
3. Any near-term consideration given AP obligations

DO NOT compute, estimate, or state any numbers not listed above.`
}
