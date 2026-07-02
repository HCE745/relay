import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { getSelectedEntityId } from "@/lib/entity-context"
import { prisma } from "@/lib/prisma"
import { getPL, getBalanceSheet } from "@/lib/reports"
import { getAccountBalance } from "@/lib/ledger"
import Anthropic from "@anthropic-ai/sdk"

// Local shape types for Prisma select results (avoids implicit-any when generated client is absent)
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

  // Get session entity (from cookie or body override that's validated below)
  const sessionEntityId = await getSelectedEntityId()

  // Step 1 — Build metadata context (no raw financial data sent to model)
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

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Step 2 — Parse question into QueryIntent (model never sees data)
  const systemPrompt = `You are an accounting query parser. Given a user's question about their books, return a JSON QueryIntent object.

ENTITIES available:
${entitiesMeta.map((e: EntityMeta) => `  ${e.id}: ${e.name}${e.isConsolidationParent ? " (consolidation parent)" : ""}`).join("\n")}

ACCOUNTS available:
${accountsMeta.map((a: AccountMeta) => `  ${a.code} ${a.name} (${a.type})`).join("\n")}

TODAY: ${today}
CURRENT_YEAR: ${year}
CURRENT_MONTH_START: ${monthStart}
CURRENT_MONTH_END: ${monthEnd}

Return exactly this JSON (no prose, no markdown fences):
{
  "type": "pl" | "balance_sheet" | "account_balance" | "vendor_spend" | "top_vendors" | "cash_position" | "ar_summary" | "ap_summary",
  "entityId": string (must be one of the entity IDs above, or "current" to use the active entity),
  "consolidated": boolean,
  "dateStart": "YYYY-MM-DD",
  "dateEnd": "YYYY-MM-DD",
  "accountCodes": string[] | null,
  "topN": number | null,
  "canAnswer": boolean,
  "cantAnswerReason": string | null
}

Rules:
- entityId must be one of the known entity IDs listed above, or "current"
- dateStart/dateEnd must be actual calendar dates you can determine from context
- consolidated should only be true if the chosen entity is a consolidation parent
- For cash_position, accountCodes should include cash account codes (1000, 1010, etc.) if present
- For account_balance, set accountCodes to the relevant account codes
- If the question asks about something you cannot map to the available data (personal finance, external market data, future predictions), set canAnswer=false and explain in cantAnswerReason
- Never invent account codes or entity IDs not in the lists above`

  let intent: QueryIntent
  try {
    const parseResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: question.trim() }],
    })

    const rawText = parseResponse.content[0].type === "text" ? parseResponse.content[0].text : ""
    // Strip markdown code fences if model adds them
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    intent = JSON.parse(cleaned) as QueryIntent
  } catch {
    return NextResponse.json(
      { error: "Failed to parse question into a structured query. Please rephrase your question." },
      { status: 422 },
    )
  }

  // Early return if model says it cannot answer
  if (!intent.canAnswer) {
    return NextResponse.json({
      answer: intent.cantAnswerReason ?? "I can only answer questions about your accounting data.",
      data: null,
      intent,
    })
  }

  // Step 3 — Resolve and validate entity ID (security: must belong to this tenant)
  let resolvedEntityId: string
  if (intent.entityId === "current" || !intent.entityId) {
    resolvedEntityId = sessionEntityId
  } else {
    const found = entitiesMeta.find((e: EntityMeta) => e.id === intent.entityId)
    if (!found) {
      // Fall back to session entity if model hallucinated an unknown ID
      resolvedEntityId = sessionEntityId
      intent.entityId = sessionEntityId
    } else {
      resolvedEntityId = found.id
    }
  }

  const start = new Date(intent.dateStart)
  const end = new Date(intent.dateEnd)
  const period = { start, end }

  // Step 3 — Execute intent with safe, tenant+entity scoped functions (no raw SQL)
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
        // Look for cash accounts (code 1000 or 1010, or type ASSET with "cash" in name)
        const codes = intent.accountCodes ?? []
        const cashAccounts = (await prisma.account.findMany({
          where: {
            tenantId,
            entityId: resolvedEntityId,
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
            const balance = await getAccountBalance(tenantId, resolvedEntityId, acc.id, {
              periodEnd: end,
            })
            return { code: acc.code, name: acc.name, balanceCents: balance }
          }),
        )
        rawData = { cashAccounts: balances, totalCashCents: balances.reduce((s: number, b: CashRow) => s + b.balanceCents, 0) }
        break
      }

      case "vendor_spend": {
        const bills = (await prisma.bill.findMany({
          where: {
            tenantId,
            entityId: resolvedEntityId,
            date: { gte: start, lte: end },
          },
          select: {
            id: true,
            date: true,
            total: true,
            amountPaid: true,
            amountDue: true,
            status: true,
            vendor: { select: { id: true, name: true } },
          },
          orderBy: { date: "desc" },
        })) as BillRow[]
        const totalCents = bills.reduce((s: number, b: BillRow) => s + b.total, 0)
        rawData = { bills, totalSpendCents: totalCents, billCount: bills.length }
        break
      }

      case "top_vendors": {
        const topN = intent.topN ?? 10
        const bills = (await prisma.bill.findMany({
          where: {
            tenantId,
            entityId: resolvedEntityId,
            date: { gte: start, lte: end },
          },
          select: {
            total: true,
            vendor: { select: { id: true, name: true } },
          },
        })) as BillSummaryRow[]
        // Group by vendor
        const byVendor = new Map<string, { vendorId: string; vendorName: string; totalCents: number; billCount: number }>()
        for (const bill of bills) {
          const key = bill.vendor.id
          const existing = byVendor.get(key)
          if (existing) {
            existing.totalCents += bill.total
            existing.billCount += 1
          } else {
            byVendor.set(key, { vendorId: bill.vendor.id, vendorName: bill.vendor.name, totalCents: bill.total, billCount: 1 })
          }
        }
        const sorted = Array.from(byVendor.values())
          .sort((a, b) => b.totalCents - a.totalCents)
          .slice(0, topN)
        rawData = { topVendors: sorted, totalVendors: byVendor.size }
        break
      }

      case "ar_summary": {
        const invoices = (await prisma.invoice.findMany({
          where: {
            tenantId,
            entityId: resolvedEntityId,
            date: { gte: start, lte: end },
          },
          select: {
            id: true,
            invoiceNumber: true,
            date: true,
            dueDate: true,
            total: true,
            amountPaid: true,
            amountDue: true,
            status: true,
            customer: { select: { id: true, name: true } },
          },
          orderBy: { date: "desc" },
        })) as InvoiceRow[]
        const totalInvoicedCents = invoices.reduce((s: number, i: InvoiceRow) => s + i.total, 0)
        const totalOutstandingCents = invoices.reduce((s: number, i: InvoiceRow) => s + i.amountDue, 0)
        rawData = { invoices, totalInvoicedCents, totalOutstandingCents, invoiceCount: invoices.length }
        break
      }

      case "ap_summary": {
        const bills = (await prisma.bill.findMany({
          where: {
            tenantId,
            entityId: resolvedEntityId,
            date: { gte: start, lte: end },
          },
          select: {
            id: true,
            billNumber: true,
            date: true,
            dueDate: true,
            total: true,
            amountPaid: true,
            amountDue: true,
            status: true,
            vendor: { select: { id: true, name: true } },
          },
          orderBy: { date: "desc" },
        })) as BillAPRow[]
        const totalBilledCents = bills.reduce((s: number, b: BillAPRow) => s + b.total, 0)
        const totalOutstandingCents = bills.reduce((s: number, b: BillAPRow) => s + b.amountDue, 0)
        rawData = { bills, totalBilledCents, totalOutstandingCents, billCount: bills.length }
        break
      }

      default: {
        return NextResponse.json({ error: "Unsupported query type" }, { status: 422 })
      }
    }
  } catch {
    return NextResponse.json({ error: "Failed to retrieve data. Please try again." }, { status: 500 })
  }

  // Step 4 — Format answer using Anthropic (model sees data but cannot act on it)
  const entityName = entitiesMeta.find((e: EntityMeta) => e.id === resolvedEntityId)?.name ?? resolvedEntityId
  const formatPrompt = `You are an accounting assistant for a business. The user asked: "${question.trim()}"

Entity: ${entityName}
Period: ${intent.dateStart} to ${intent.dateEnd}
Data (all monetary amounts are in cents; divide by 100 for dollars):
${JSON.stringify(rawData, null, 2)}

Give a clear, concise answer in 1-3 sentences summarizing what the data shows. Then list the key numbers formatted as dollars. Do not include any data not present above. Do not make assumptions beyond the data provided.`

  let answer: string
  try {
    const formatResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: formatPrompt }],
    })
    answer =
      formatResponse.content[0].type === "text"
        ? formatResponse.content[0].text
        : "Unable to generate a summary."
  } catch {
    answer = "Data retrieved successfully. See the supporting data below."
  }

  return NextResponse.json({ answer, data: rawData, intent })
}
