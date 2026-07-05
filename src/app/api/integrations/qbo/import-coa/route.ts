/**
 * QuickBooks Online — Chart of Accounts CSV import.
 *
 * === QBO EXPORT FORMAT ===
 * From QBO: Reports → Chart of Accounts → Export to CSV.
 * Expected columns (in any order):
 *   Account, Type, [Detail Type], [Description], [Total]
 *
 * === EXTENSION POINT: QBO API (OAuth) ===
 * When QuickBooks Online API integration is ready, replace this CSV path with:
 *   1. OAuth 2.0 flow via QBO's developer portal (client_id, client_secret)
 *   2. Token exchange endpoint: POST https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
 *   3. GET https://quickbooks.api.intuit.com/v3/company/{realmId}/query?query=SELECT * FROM Account
 *   4. Map the returned Account objects using the same QBO_TYPE_MAP below.
 *   5. Store access_token + refresh_token encrypted per tenant (see lib/encrypt.ts).
 *
 * Until then, this route handles only CSV import.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import type { AccountType, NormalBalance } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ─── Type mapping ─────────────────────────────────────────────────────────────

type AccountDef = {
  type: AccountType
  normalBalance: NormalBalance
  subtype?: string
  isCurrent?: boolean
  codePrefix: number
}

const QBO_TYPE_MAP: Record<string, AccountDef> = {
  // Assets
  "bank":                           { type: "ASSET", normalBalance: "DEBIT", isCurrent: true,  codePrefix: 1000 },
  "accounts receivable (a/r)":      { type: "ASSET", normalBalance: "DEBIT", isCurrent: true,  codePrefix: 1200, subtype: "AR" },
  "accounts receivable":            { type: "ASSET", normalBalance: "DEBIT", isCurrent: true,  codePrefix: 1200, subtype: "AR" },
  "other current asset":            { type: "ASSET", normalBalance: "DEBIT", isCurrent: true,  codePrefix: 1400 },
  "fixed asset":                    { type: "ASSET", normalBalance: "DEBIT", isCurrent: false, codePrefix: 1500 },
  "other asset":                    { type: "ASSET", normalBalance: "DEBIT", isCurrent: false, codePrefix: 1900 },
  // Liabilities
  "accounts payable (a/p)":         { type: "LIABILITY", normalBalance: "CREDIT", isCurrent: true,  codePrefix: 2000, subtype: "AP" },
  "accounts payable":               { type: "LIABILITY", normalBalance: "CREDIT", isCurrent: true,  codePrefix: 2000, subtype: "AP" },
  "credit card":                    { type: "LIABILITY", normalBalance: "CREDIT", isCurrent: true,  codePrefix: 2100 },
  "other current liability":        { type: "LIABILITY", normalBalance: "CREDIT", isCurrent: true,  codePrefix: 2200 },
  "long term liability":            { type: "LIABILITY", normalBalance: "CREDIT", isCurrent: false, codePrefix: 2800 },
  "other liability":                { type: "LIABILITY", normalBalance: "CREDIT", isCurrent: false, codePrefix: 2900 },
  // Equity
  "equity":                         { type: "EQUITY", normalBalance: "CREDIT", codePrefix: 3000 },
  "retained earnings":              { type: "EQUITY", normalBalance: "CREDIT", codePrefix: 3100 },
  "opening balance equity":         { type: "EQUITY", normalBalance: "CREDIT", codePrefix: 3900 },
  // Income
  "income":                         { type: "INCOME", normalBalance: "CREDIT", codePrefix: 4000 },
  "other income":                   { type: "INCOME", normalBalance: "CREDIT", codePrefix: 4900 },
  // Expenses
  "cost of goods sold":             { type: "EXPENSE", normalBalance: "DEBIT", codePrefix: 5000, subtype: "COGS" },
  "expense":                        { type: "EXPENSE", normalBalance: "DEBIT", codePrefix: 6000 },
  "other expense":                  { type: "EXPENSE", normalBalance: "DEBIT", codePrefix: 6900 },
}

function mapQBOType(rawType: string): AccountDef | null {
  return QBO_TYPE_MAP[rawType.toLowerCase().trim()] ?? null
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

type ParsedRow = {
  name: string
  rawType: string
  mapped: AccountDef | null
}

function parseQBOCsv(csv: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return { rows: [], errors: ["CSV has no data rows"] }

  // Find header row
  const headerLine = lines.findIndex((l) => /account/i.test(l))
  if (headerLine === -1) return { rows: [], errors: ['No header row found. Expected columns: Account, Type'] }

  const headers = lines[headerLine].split(",").map((h) => h.replace(/^"|"$/g, "").toLowerCase().trim())
  const nameIdx = headers.findIndex((h) => h === "account" || h === "name")
  const typeIdx = headers.findIndex((h) => h === "type" || h === "account type")

  if (nameIdx === -1) return { rows: [], errors: ["No 'Account' column found in header"] }
  if (typeIdx === -1) return { rows: [], errors: ["No 'Type' column found in header"] }

  const dataLines = lines.slice(headerLine + 1)
  const rows: ParsedRow[] = []
  const errors: string[] = []

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]
    // Skip totals / section headers from QBO report format
    if (/^,+$/.test(line) || /^"?total/i.test(line)) continue

    // Handle quoted CSV values
    const cells: string[] = []
    let inQuote = false, cur = ""
    for (const ch of line + ",") {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === "," && !inQuote) { cells.push(cur.trim()); cur = "" }
      else { cur += ch }
    }

    const name = cells[nameIdx]?.replace(/^"|"$/g, "").trim()
    const rawType = cells[typeIdx]?.replace(/^"|"$/g, "").trim()

    if (!name) continue // skip blank rows
    if (!rawType) { errors.push(`Row ${i + 2}: missing Type for "${name}"`); continue }

    const mapped = mapQBOType(rawType)
    if (!mapped) errors.push(`Row ${i + 2}: unknown type "${rawType}" for "${name}" — will be skipped`)

    rows.push({ name, rawType, mapped })
  }

  return { rows, errors }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()
  const { csvText, entityId, preview = true } = body as {
    csvText: string
    entityId: string
    preview: boolean
  }

  if (!csvText || !entityId) {
    return NextResponse.json({ error: "csvText and entityId required" }, { status: 400 })
  }

  // Validate entity belongs to tenant
  const entity = await prisma.entity.findFirst({ where: { id: entityId, tenantId: session.tenantId } })
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 })

  const { rows, errors } = parseQBOCsv(csvText)
  const validRows = rows.filter((r) => r.mapped !== null)

  if (validRows.length === 0) {
    return NextResponse.json({ preview: true, rows: [], errors: [...errors, "No importable rows found"] })
  }

  // Load existing codes per type to avoid collisions
  const existing = await prisma.account.findMany({
    where: { tenantId: session.tenantId, entityId },
    select: { code: true, name: true, type: true },
  })
  const existingNames = new Set(existing.map((a) => a.name.toLowerCase()))
  const codeCounters: Record<number, number> = {}

  function nextCode(prefix: number): string {
    codeCounters[prefix] = (codeCounters[prefix] ?? prefix) + 1
    return String(codeCounters[prefix])
  }

  // Seed counters from existing codes
  for (const acc of existing) {
    const n = parseInt(acc.code)
    if (!isNaN(n)) {
      const prefix = Math.floor(n / 1000) * 1000
      codeCounters[prefix] = Math.max(codeCounters[prefix] ?? prefix, n)
    }
  }

  // Build preview rows
  const toCreate = validRows
    .filter((r) => !existingNames.has(r.name.toLowerCase()))
    .map((r) => {
      const def = r.mapped!
      return {
        name: r.name,
        rawType: r.rawType,
        type: def.type,
        normalBalance: def.normalBalance,
        subtype: def.subtype ?? null,
        isCurrent: def.isCurrent ?? true,
        code: nextCode(def.codePrefix),
      }
    })

  const skippedExisting = validRows
    .filter((r) => existingNames.has(r.name.toLowerCase()))
    .map((r) => r.name)

  if (preview) {
    return NextResponse.json({
      preview: true,
      toCreate,
      skippedExisting,
      skippedUnknownType: rows.filter((r) => !r.mapped).map((r) => `${r.name} (${r.rawType})`),
      errors,
    })
  }

  // Commit
  await prisma.account.createMany({
    data: toCreate.map((r) => ({
      tenantId: session.tenantId,
      entityId,
      code: r.code,
      name: r.name,
      type: r.type as AccountType,
      normalBalance: r.normalBalance as NormalBalance,
      subtype: r.subtype,
      isCurrent: r.isCurrent,
    })),
    skipDuplicates: true,
  })

  return NextResponse.json({
    preview: false,
    created: toCreate.length,
    skippedExisting: skippedExisting.length,
    errors,
  })
}
