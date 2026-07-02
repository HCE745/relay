import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getPL, getBalanceSheet, getTrialBalance } from "@/lib/reports"
import { getAccountBalance } from "@/lib/ledger"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ─── Date helpers ─────────────────────────────────────────────────────────────

function monthBounds(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { start, end }
}

function priorMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

// ─── Checklist ────────────────────────────────────────────────────────────────

type ChecklistItem = {
  label: string
  status: "PASS" | "FAIL" | "WARN"
  detail: string
}

async function buildChecklist(
  tenantId: string,
  entityId: string,
  year: number,
  month: number,
): Promise<ChecklistItem[]> {
  const { start, end } = monthBounds(year, month)
  const checklist: ChecklistItem[] = []

  // 1. Trial balance
  try {
    const tb = await getTrialBalance(tenantId, entityId, { start, end })
    const tbSum = tb.reduce((s, l) => s + l.balance, 0)
    const balanced = Math.abs(tbSum) < 1 // allow <1 cent rounding
    checklist.push({
      label: "Trial Balance",
      status: balanced ? "PASS" : "FAIL",
      detail: balanced ? "Balanced" : `Out of balance by ${tbSum} cents`,
    })
  } catch {
    checklist.push({ label: "Trial Balance", status: "WARN", detail: "Could not compute" })
  }

  // 2. Unreconciled bank transactions
  try {
    const unclearedCount = await prisma.bankTransaction.count({
      where: {
        tenantId,
        entityId,
        isCleared: false,
        date: { gte: start, lte: end },
      },
    })
    checklist.push({
      label: "Unreconciled Bank Transactions",
      status: unclearedCount === 0 ? "PASS" : "WARN",
      detail: unclearedCount === 0 ? "All cleared" : `${unclearedCount} unreconciled`,
    })
  } catch {
    checklist.push({ label: "Unreconciled Bank Transactions", status: "WARN", detail: "Could not compute" })
  }

  // 3. Draft transactions (Bills with ENTERED, Invoices with DRAFT)
  try {
    const [draftBills, draftInvoices] = await Promise.all([
      prisma.bill.count({
        where: {
          tenantId,
          entityId,
          status: "ENTERED",
          date: { gte: start, lte: end },
        },
      }),
      prisma.invoice.count({
        where: {
          tenantId,
          entityId,
          status: "DRAFT",
          date: { gte: start, lte: end },
        },
      }),
    ])
    const total = draftBills + draftInvoices
    checklist.push({
      label: "Draft Transactions",
      status: total === 0 ? "PASS" : "WARN",
      detail: total === 0 ? "None pending" : `${draftBills} bills, ${draftInvoices} invoices`,
    })
  } catch {
    checklist.push({ label: "Draft Transactions", status: "WARN", detail: "Could not compute" })
  }

  // 4. Open amortization entries due by end of month
  try {
    const schedules = await prisma.amortizationSchedule.findMany({
      where: { tenantId, entityId },
      select: { id: true },
    })
    const scheduleIds = schedules.map((s) => s.id)
    const unpostedCount = scheduleIds.length > 0
      ? await prisma.amortizationEntry.count({
          where: {
            scheduleId: { in: scheduleIds },
            posted: false,
            periodDate: { lte: end },
          },
        })
      : 0
    checklist.push({
      label: "Open Amortization Entries",
      status: unpostedCount === 0 ? "PASS" : "WARN",
      detail: unpostedCount === 0 ? "None due" : `${unpostedCount} unposted`,
    })
  } catch {
    checklist.push({ label: "Open Amortization Entries", status: "WARN", detail: "Could not compute" })
  }

  // 5. Period status
  try {
    const period = await prisma.accountingPeriod.findFirst({
      where: {
        tenantId,
        entityId,
        periodStart: { lte: start },
        periodEnd: { gte: end },
      },
      select: { status: true },
    })
    const status = period?.status ?? "OPEN"
    checklist.push({
      label: "Period Status",
      status: status === "CLOSED" ? "PASS" : "WARN",
      detail: status,
    })
  } catch {
    checklist.push({ label: "Period Status", status: "WARN", detail: "Could not determine" })
  }

  return checklist
}

// ─── Numbers for briefing ─────────────────────────────────────────────────────

async function gatherNumbers(
  tenantId: string,
  entityId: string,
  year: number,
  month: number,
  consolidated: boolean,
) {
  const { start: monthStart, end: monthEnd } = monthBounds(year, month)
  const prior = priorMonth(year, month)
  const { start: priorStart, end: priorEnd } = monthBounds(prior.year, prior.month)

  const opts = consolidated ? { consolidated: true } : undefined

  const [pl, priorPl, bs] = await Promise.all([
    getPL(tenantId, entityId, { start: monthStart, end: monthEnd }, opts),
    getPL(tenantId, entityId, { start: priorStart, end: priorEnd }, opts),
    getBalanceSheet(tenantId, entityId, monthEnd, opts),
  ])

  // Cash accounts: type=ASSET and code in ['1000','1010'] or name containing 'cash'
  const cashAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      entityId,
      type: "ASSET",
      OR: [
        { code: { in: ["1000", "1010"] } },
        { name: { contains: "cash", mode: "insensitive" } },
      ],
    },
    select: { id: true, code: true, name: true },
  })

  let totalCashCents = 0
  for (const acc of cashAccounts) {
    const bal = await getAccountBalance(tenantId, entityId, acc.id, {
      periodEnd: monthEnd,
    })
    totalCashCents += bal
  }

  // Outstanding AR
  const arInvoices = await prisma.invoice.aggregate({
    where: {
      tenantId,
      entityId,
      status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
      date: { lte: monthEnd },
    },
    _count: { id: true },
    _sum: { amountDue: true },
  })

  // Outstanding AP
  const apBills = await prisma.bill.aggregate({
    where: {
      tenantId,
      entityId,
      status: { in: ["ENTERED", "PARTIAL"] },
      date: { lte: monthEnd },
    },
    _count: { id: true },
    _sum: { amountDue: true },
  })

  return {
    revenue: pl.totalRevenue,
    cogs: pl.totalCogs,
    grossProfit: pl.grossProfit,
    expenses: pl.totalExpenses,
    netIncome: pl.netIncome,
    priorRevenue: priorPl.totalRevenue,
    priorExpenses: priorPl.totalExpenses,
    priorNetIncome: priorPl.netIncome,
    totalAssets: bs.totalAssets,
    totalLiabilities: bs.totalLiabilities,
    totalEquity: bs.totalEquity,
    cashCents: totalCashCents,
    arCount: arInvoices._count.id,
    arTotalCents: arInvoices._sum.amountDue ?? 0,
    apCount: apBills._count.id,
    apTotalCents: apBills._sum.amountDue ?? 0,
  }
}

// ─── Briefing generation ──────────────────────────────────────────────────────

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

async function generateBriefing(
  entityName: string,
  monthLabel: string,
  numbers: Awaited<ReturnType<typeof gatherNumbers>>,
  checklist: ChecklistItem[],
): Promise<string> {
  const failedItems = checklist.filter((c) => c.status === "FAIL" || c.status === "WARN")
  const failedSummary = failedItems.length > 0
    ? failedItems.map((c) => `- ${c.label}: ${c.detail}`).join("\n")
    : "None"

  const revenueChange = numbers.priorRevenue > 0
    ? (((numbers.revenue - numbers.priorRevenue) / numbers.priorRevenue) * 100).toFixed(1)
    : "N/A"
  const expenseChange = numbers.priorExpenses > 0
    ? (((numbers.expenses - numbers.priorExpenses) / numbers.priorExpenses) * 100).toFixed(1)
    : "N/A"

  const prompt = `You are preparing a concise executive briefing for ${entityName} for ${monthLabel}.
Write a 3-4 paragraph narrative summary based ONLY on the numbers provided below.
Do NOT invent, compute, or estimate any figures. Simply narrate what the numbers show.

FINANCIAL NUMBERS FOR ${monthLabel}:
- Revenue: ${fmt(numbers.revenue)} (prior month: ${fmt(numbers.priorRevenue)}, change: ${revenueChange}%)
- Cost of Goods Sold: ${fmt(numbers.cogs)}
- Gross Profit: ${fmt(numbers.grossProfit)}
- Operating Expenses: ${fmt(numbers.expenses)} (prior month: ${fmt(numbers.priorExpenses)}, change: ${expenseChange}%)
- Net Income: ${fmt(numbers.netIncome)} (prior month: ${fmt(numbers.priorNetIncome)})
- Cash Position: ${fmt(numbers.cashCents)}
- Total Assets: ${fmt(numbers.totalAssets)}
- Total Liabilities: ${fmt(numbers.totalLiabilities)}
- Total Equity: ${fmt(numbers.totalEquity)}
- Outstanding AR: ${numbers.arCount} invoices totaling ${fmt(numbers.arTotalCents)}
- Outstanding AP: ${numbers.apCount} bills totaling ${fmt(numbers.apTotalCents)}

CLOSE CHECKLIST ITEMS NEEDING ATTENTION:
${failedSummary}

Write the executive briefing now. Cover: (1) revenue and expense performance vs prior month, (2) net income and profitability, (3) cash and balance sheet position, (4) any items from the checklist needing attention. Be concise and professional.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  })
  return response.content[0].type === "text" ? response.content[0].text : ""
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await requireSession()
  const { tenantId } = session

  const url = new URL(req.url)
  const yearParam = url.searchParams.get("year")
  const monthParam = url.searchParams.get("month")
  const entityIdParam = url.searchParams.get("entityId")
  const consolidatedParam = url.searchParams.get("consolidated")

  const now = new Date()
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear()
  const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 })
  }

  // Resolve entity
  let entityId = entityIdParam ?? ""
  if (!entityId) {
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    entityId = cookieStore.get("hce-entity")?.value ?? ""
  }

  if (!entityId) {
    return NextResponse.json({ error: "entityId is required" }, { status: 400 })
  }

  // Verify the entity belongs to this tenant
  const entity = await prisma.entity.findFirst({
    where: { tenantId, id: entityId },
    select: { id: true, name: true, isConsolidationParent: true },
  })
  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 })
  }

  const consolidated = consolidatedParam === "true" && entity.isConsolidationParent

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`

  try {
    const [checklist, numbers] = await Promise.all([
      buildChecklist(tenantId, entityId, year, month),
      gatherNumbers(tenantId, entityId, year, month, consolidated),
    ])

    const briefing = await generateBriefing(entity.name, monthLabel, numbers, checklist)

    return NextResponse.json({
      month: monthLabel,
      entity: entity.name,
      checklist,
      numbers,
      briefing,
    })
  } catch (err) {
    console.error("[/api/close] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    )
  }
}
