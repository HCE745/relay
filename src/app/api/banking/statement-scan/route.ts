import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createHash } from "crypto"
import { getEntityContext } from "@/lib/entity-context"
import { assertAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_FILE_BYTES = 20 * 1024 * 1024

const SYSTEM_PROMPT = `You are a bank and credit card statement parser. Extract ALL transactions from this statement document.
Return ONLY valid JSON — no prose, no markdown fences, no explanation.

Return exactly this JSON shape:
{
  "accountName": string or null,
  "statementPeriodStart": "YYYY-MM-DD" or null,
  "statementPeriodEnd": "YYYY-MM-DD" or null,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": string,
      "amountCents": integer
    }
  ]
}

Rules:
- amountCents: positive = charge/debit (money spent), negative = credit/refund. All amounts in cents (integer).
- Include every single transaction on the statement — do not summarize or skip any.
- For date, use the transaction date (not posting date) when both are shown.
- description: use the merchant/payee name as it appears on the statement.
- For multi-page PDFs, combine all pages into one result.
- Return ONLY the JSON object — nothing before or after it.`

type RawTransaction = {
  date: string
  description: string
  amountCents: number
}

type ParsedStatement = {
  accountName: string | null
  statementPeriodStart: string | null
  statementPeriodEnd: string | null
  transactions: RawTransaction[]
}

export type StatementLine = {
  date: string
  description: string
  amountCents: number
  matchType: "bill" | "journal" | "amortization" | null
  matchedId: string | null
  matchedLabel: string | null
}

export type StatementScanResponse = {
  alreadyProcessed: boolean
  processedAt: string | null
  accountName: string | null
  periodStart: string | null
  periodEnd: string | null
  lines: StatementLine[]
}

function fuzzyDescriptionMatch(stmtDesc: string, candidate: string): boolean {
  if (!stmtDesc || !candidate) return false
  const a = stmtDesc.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter((w) => w.length > 3)
  const b = candidate.toLowerCase()
  return a.some((word) => b.includes(word))
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 })
  }

  let tenantId: string, entityId: string, session: Awaited<ReturnType<typeof getEntityContext>>["session"]
  try {
    const ctx = await getEntityContext()
    tenantId = ctx.tenantId
    entityId = ctx.entityId
    session = ctx.session
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const denied = assertAccess(session, entityId, "read")
  if (denied) return denied

  let fileBuffer: Buffer
  try {
    const contentType = req.headers.get("content-type") ?? ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 })
    }
    const form = await req.formData()
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted for statement scanning" }, { status: 415 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File too large — maximum 20 MB" }, { status: 413 })
    }
    fileBuffer = Buffer.from(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const fileHash = createHash("sha256").update(fileBuffer).digest("hex")

  // Check for duplicate processing
  const existing = await prisma.statementScan.findUnique({
    where: { tenantId_entityId_fileHash: { tenantId, entityId, fileHash } },
  })

  // Call Anthropic to extract transactions
  const client = new Anthropic({ apiKey })
  let parsed: ParsedStatement
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: fileBuffer.toString("base64") },
            },
            { type: "text", text: "Extract all transactions from this statement and return the JSON." },
          ],
        },
      ],
    })
    const block = message.content[0]
    if (block.type !== "text") throw new Error("Unexpected response type")
    const cleaned = block.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()
    parsed = JSON.parse(cleaned)
  } catch (e) {
    return NextResponse.json({ error: `Statement parsing failed: ${(e as Error).message}` }, { status: 502 })
  }

  const txns = Array.isArray(parsed.transactions) ? parsed.transactions : []
  if (txns.length === 0) {
    return NextResponse.json({ error: "No transactions found in the document" }, { status: 422 })
  }

  // Determine date range from statement lines
  const dates = txns.map((t) => t.date).filter(Boolean).sort()
  const startDate = new Date(dates[0] + "T00:00:00Z")
  const endDate = new Date(dates[dates.length - 1] + "T00:00:00Z")
  // Expand window ±10 days for matching
  const windowStart = new Date(startDate.getTime() - 10 * 86400000)
  const windowEnd = new Date(endDate.getTime() + 10 * 86400000)

  // Load bills and journal entries in the date window
  const [bills, journalEntries] = await Promise.all([
    prisma.bill.findMany({
      where: { tenantId, entityId, date: { gte: windowStart, lte: windowEnd } },
      select: {
        id: true, date: true, total: true,
        vendor: { select: { name: true } },
      },
    }),
    prisma.journalEntry.findMany({
      where: {
        tenantId, entityId,
        date: { gte: windowStart, lte: windowEnd },
        source: { in: ["AMORTIZATION", "BILL", "PAYMENT"] },
      },
      select: {
        id: true, date: true, memo: true, source: true,
        lines: { select: { debit: true, credit: true } },
      },
    }),
  ])

  // Match each statement line against existing records
  const lines: StatementLine[] = txns.map((txn): StatementLine => {
    const txnDate = new Date(txn.date + "T00:00:00Z")
    const absAmount = Math.abs(txn.amountCents)
    const dateLo = new Date(txnDate.getTime() - 10 * 86400000)
    const dateHi = new Date(txnDate.getTime() + 10 * 86400000)

    // Try bills first
    for (const bill of bills) {
      if (bill.date < dateLo || bill.date > dateHi) continue
      const billTotal = bill.total
      const amountClose = Math.abs(billTotal - absAmount) <= Math.max(100, billTotal * 0.01)
      if (!amountClose) continue
      const vendorName = bill.vendor?.name ?? ""
      if (fuzzyDescriptionMatch(txn.description, vendorName)) {
        return {
          date: txn.date,
          description: txn.description,
          amountCents: txn.amountCents,
          matchType: "bill",
          matchedId: bill.id,
          matchedLabel: `Bill — ${vendorName} ($${(billTotal / 100).toFixed(2)})`,
        }
      }
    }

    // Try journal entries (amortization / payment)
    for (const je of journalEntries) {
      if (je.date < dateLo || je.date > dateHi) continue
      const jeTotal = je.lines.reduce((s, l) => s + Math.max(l.debit, l.credit), 0) / 2
      const amountClose = Math.abs(jeTotal - absAmount) <= Math.max(100, jeTotal * 0.01)
      if (!amountClose) continue
      const memoMatch = je.memo ? fuzzyDescriptionMatch(txn.description, je.memo) : false
      if (memoMatch || je.source === "AMORTIZATION") {
        return {
          date: txn.date,
          description: txn.description,
          amountCents: txn.amountCents,
          matchType: je.source === "AMORTIZATION" ? "amortization" : "journal",
          matchedId: je.id,
          matchedLabel: `${je.source} entry${je.memo ? ` — ${je.memo}` : ""} ($${(jeTotal / 100).toFixed(2)})`,
        }
      }
    }

    return {
      date: txn.date,
      description: txn.description,
      amountCents: txn.amountCents,
      matchType: null,
      matchedId: null,
      matchedLabel: null,
    }
  })

  const matchedCount = lines.filter((l) => l.matchType !== null).length

  // Store/update scan record for dedup tracking
  await prisma.statementScan.upsert({
    where: { tenantId_entityId_fileHash: { tenantId, entityId, fileHash } },
    create: { tenantId, entityId, fileHash, lineCount: txns.length, matchedCount },
    update: { processedAt: new Date(), lineCount: txns.length, matchedCount },
  })

  const response: StatementScanResponse = {
    alreadyProcessed: !!existing,
    processedAt: existing?.processedAt?.toISOString() ?? null,
    accountName: parsed.accountName ?? null,
    periodStart: parsed.statementPeriodStart ?? null,
    periodEnd: parsed.statementPeriodEnd ?? null,
    lines,
  }

  return NextResponse.json(response)
}
