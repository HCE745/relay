import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { getPL } from "@/lib/reports"
import { getAccountBalance } from "@/lib/ledger"
import Anthropic from "@anthropic-ai/sdk"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function getEntityIdFromCookie(): Promise<string> {
  const cookieStore = await cookies()
  return cookieStore.get("hce-entity")?.value ?? ""
}

function fmt(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()
  const deny = assertAccess(session, body.entityId, "read"); if (deny) return deny

  const entityId = body.entityId ?? (await getEntityIdFromCookie())
  const consolidated = body.consolidated === true
  const reserveMonths = body.reserveMonths ?? 3

  const entity = await prisma.entity.findFirst({ where: { id: entityId, tenantId: session.tenantId } })
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 })

  const plOpts = consolidated ? { consolidated: true } : undefined
  const now = new Date()
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const ytdStart = new Date(now.getFullYear(), 0, 1)
  const priorMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const priorMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  // Gather all numbers fresh — AI gets ONLY pre-computed values
  const [plMTD, plYTD, plPrior] = await Promise.all([
    getPL(session.tenantId, entityId, { start: mtdStart, end: now }, plOpts),
    getPL(session.tenantId, entityId, { start: ytdStart, end: now }, plOpts),
    getPL(session.tenantId, entityId, { start: priorMonthStart, end: priorMonthEnd }, plOpts),
  ])

  const cashAccounts = await prisma.account.findMany({
    where: {
      tenantId: session.tenantId,
      entityId,
      type: "ASSET",
      OR: [
        { name: { contains: "cash", mode: "insensitive" } },
        { code: { in: ["1000", "1010"] } },
      ],
    },
  })
  let currentCashCents = 0
  for (const acc of cashAccounts) {
    currentCashCents += await getAccountBalance(session.tenantId, entityId, acc.id)
  }

  // Cash reserve
  let totalHistoricalExpenses = 0
  for (let i = 1; i <= 3; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const pl = await getPL(session.tenantId, entityId, { start, end }, plOpts)
    totalHistoricalExpenses += pl.totalExpenses + pl.totalCogs
  }
  const avgMonthlyExpenses = Math.round(totalHistoricalExpenses / 3)
  const recommendedReserve = avgMonthlyExpenses * reserveMonths

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const openBills = await prisma.bill.findMany({
    where: {
      tenantId: session.tenantId,
      entityId,
      status: { in: ["ENTERED", "PARTIAL"] },
      dueDate: { lte: addDays(today, 90) },
    },
    select: { amountDue: true, dueDate: true },
  })
  let apDue30 = 0, apDue60 = 0
  for (const bill of openBills) {
    const due = new Date(bill.dueDate); due.setHours(0, 0, 0, 0)
    if (due <= addDays(today, 30)) apDue30 += bill.amountDue
    else if (due <= addDays(today, 60)) apDue60 += bill.amountDue
  }

  // Anomaly count
  const anomalyCount = await prisma.anomalyFlag.count({
    where: { tenantId: session.tenantId, entityId, status: "OPEN" },
  })

  // Budget variances for current period
  type Variance = { accountName: string; accountType: string; budgeted: number; actual: number; variance: number; variancePct: number | null }
  let topVariances: Variance[] = []
  try {
    const currentYear = now.getFullYear()
    const budget = await prisma.budget.findFirst({
      where: { tenantId: session.tenantId, entityId, fiscalYear: currentYear },
      orderBy: { createdAt: "desc" },
      include: {
        lines: {
          include: { account: { select: { id: true, name: true, type: true } } },
        },
      },
    })
    if (budget) {
      const currentPeriod = budget.periodType === "MONTHLY" ? now.getMonth() + 1 : budget.periodType === "QUARTERLY" ? Math.ceil((now.getMonth() + 1) / 3) : 1
      const pStart = budget.periodType === "MONTHLY"
        ? new Date(currentYear, currentPeriod - 1, 1)
        : new Date(currentYear, (currentPeriod - 1) * 3, 1)
      const pEnd = budget.periodType === "MONTHLY"
        ? new Date(currentYear, currentPeriod, 0, 23, 59, 59, 999)
        : new Date(currentYear, currentPeriod * 3, 0, 23, 59, 59, 999)

      const entries = await prisma.journalEntry.findMany({
        where: {
          tenantId: session.tenantId,
          entityId,
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

      const actuals = new Map<string, number>()
      for (const e of entries) {
        for (const l of e.lines) {
          const prev = actuals.get(l.accountId) ?? 0
          actuals.set(l.accountId, prev + (l.account.type === "INCOME" ? l.credit - l.debit : l.debit - l.credit))
        }
      }

      topVariances = budget.lines
        .filter((l) => l.period === currentPeriod)
        .map((l) => {
          const actual = actuals.get(l.accountId) ?? 0
          const variance = actual - l.amountCents
          return {
            accountName: l.account.name,
            accountType: l.account.type,
            budgeted: l.amountCents,
            actual,
            variance,
            variancePct: l.amountCents !== 0 ? (variance / Math.abs(l.amountCents)) * 100 : null,
          }
        })
        .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
        .slice(0, 3)
    }
  } catch {
    // Budget data not required for briefing
  }

  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const varianceSection = topVariances.length > 0
    ? topVariances.map((v) =>
        `- ${v.accountName} (${v.accountType}): Budget ${fmt(v.budgeted)}, Actual ${fmt(v.actual)}, Variance ${fmt(v.variance)} (${v.variancePct != null ? v.variancePct.toFixed(1) + "%" : "N/A"})`
      ).join("\n")
    : "No budget data available."

  const reserveStatus = currentCashCents >= recommendedReserve
    ? `surplus of ${fmt(currentCashCents - recommendedReserve)}`
    : `shortfall of ${fmt(recommendedReserve - currentCashCents)}`

  const prompt = `You are the AI controller for ${entity.name}. Today is ${dateLabel}.
Write a concise daily financial briefing (3-4 paragraphs) based ONLY on the numbers below.
DO NOT compute, estimate, or invent any figures. Narrate exactly what the numbers show.
Include a variance explanation section: for each budget variance listed, explain in 1-2 sentences what likely drove it based on the account name and direction.

=== MTD PERFORMANCE (month-to-date, ${monthLabel}) ===
Revenue MTD: ${fmt(plMTD.totalRevenue)}
COGS MTD: ${fmt(plMTD.totalCogs)}
Gross Profit MTD: ${fmt(plMTD.grossProfit)}
Operating Expenses MTD: ${fmt(plMTD.totalExpenses)}
Net Income MTD: ${fmt(plMTD.netIncome)}
Prior month expenses: ${fmt(plPrior.totalExpenses)}
Expense change vs prior month: ${plPrior.totalExpenses > 0 ? (((plMTD.totalExpenses - plPrior.totalExpenses) / plPrior.totalExpenses) * 100).toFixed(1) + "%" : "N/A"}

=== YTD PERFORMANCE (year-to-date) ===
Revenue YTD: ${fmt(plYTD.totalRevenue)}
Expenses YTD: ${fmt(plYTD.totalExpenses)}
Net Income YTD: ${fmt(plYTD.netIncome)}

=== CASH POSITION ===
Current cash: ${fmt(currentCashCents)}
Recommended reserve (${reserveMonths} months × avg monthly expenses ${fmt(avgMonthlyExpenses)}): ${fmt(recommendedReserve)}
Cash vs reserve: ${reserveStatus}
AP due next 30 days: ${fmt(apDue30)}
AP due 31–60 days: ${fmt(apDue60)}
Safe to distribute (after reserve + 30-day AP): ${fmt(currentCashCents - recommendedReserve - apDue30)}

=== BUDGET VARIANCES (current period top 3) ===
${varianceSection}

=== FLAGS ===
Open anomaly flags: ${anomalyCount}

Write the briefing now. Structure: (1) Revenue & expenses performance, (2) Cash position and reserve status, (3) Budget variance explanations for the items above, (4) Any items needing attention. Be professional and direct.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  })

  const briefing = response.content[0].type === "text" ? response.content[0].text : ""

  return NextResponse.json({ briefing, asOf: now.toISOString() })
}
