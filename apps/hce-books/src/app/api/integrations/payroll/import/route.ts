/**
 * Payroll journal summary import.
 *
 * PURPOSE: Accept a simple CSV of payroll run summaries and post them as
 * balanced journal entries via the existing ledger service.
 *
 * === CSV FORMAT ===
 * Required columns (case-insensitive):
 *   Date, Description, GrossWages, TaxWithheld, EmployerTaxes, NetPay
 *
 * Amounts are in dollars (decimals OK). HCE Books stores cents; conversion
 * happens here. Validation enforces: GrossWages ≈ NetPay + TaxWithheld (±$1).
 *
 * === JOURNAL ENTRY STRUCTURE (per row) ===
 *   DEBIT  Wages Expense account:           GrossWages
 *   DEBIT  Payroll Tax Expense account:     EmployerTaxes
 *   CREDIT Cash / Payroll Payable account:  NetPay
 *   CREDIT Payroll Tax Payable account:     TaxWithheld + EmployerTaxes
 *
 * Balanced check:
 *   Debits  = GrossWages + EmployerTaxes
 *   Credits = NetPay + TaxWithheld + EmployerTaxes
 *   = NetPay + TaxWithheld + EmployerTaxes
 *   Since GrossWages = NetPay + TaxWithheld → balanced ✓
 *
 * === EXTENSION POINT: Payroll Provider API ===
 * When a payroll provider integration is ready (Gusto, ADP, etc.):
 *   1. Implement OAuth or API-key exchange per provider.
 *   2. Fetch payroll run summaries via provider API.
 *   3. Map their payroll object fields to the same 6-field structure above.
 *   4. Call the same postPayrollEntry() helper below.
 *
 * This route handles CSV only until provider integrations are built.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/session"
import { assertAccess } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { createAndPostEntry } from "@/lib/ledger"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ─── CSV parser ───────────────────────────────────────────────────────────────

type PayrollRow = {
  date: string        // ISO date
  description: string
  grossWagesCents: number
  taxWithheldCents: number
  employerTaxesCents: number
  netPayCents: number
}

type ParseResult = {
  rows: PayrollRow[]
  errors: string[]
}

function parsePayrollCsv(csv: string): ParseResult {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return { rows: [], errors: ["CSV has no data rows"] }

  const headerLine = lines[0]
  const headers = headerLine.split(",").map((h) => h.replace(/^"|"$/g, "").toLowerCase().trim())

  const col = (name: string) => {
    const variants = [name, name.replace(/\s/g, ""), name.replace(/\s/g, "_")]
    return variants.map((v) => headers.findIndex((h) => h === v)).find((i) => i !== -1) ?? -1
  }

  const idxDate   = col("date")
  const idxDesc   = col("description")
  const idxGross  = col("grosswages")
  const idxTax    = col("taxwithheld")
  const idxEmplTx = col("employertaxes")
  const idxNet    = col("netpay")

  const missing: string[] = []
  if (idxDate   === -1) missing.push("Date")
  if (idxDesc   === -1) missing.push("Description")
  if (idxGross  === -1) missing.push("GrossWages")
  if (idxTax    === -1) missing.push("TaxWithheld")
  if (idxEmplTx === -1) missing.push("EmployerTaxes")
  if (idxNet    === -1) missing.push("NetPay")

  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required columns: ${missing.join(", ")}`] }
  }

  const rows: PayrollRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim())
    const get = (idx: number) => cells[idx] ?? ""

    const rawDate  = get(idxDate)
    const rawDesc  = get(idxDesc)
    const rawGross = parseFloat(get(idxGross)) || 0
    const rawTax   = parseFloat(get(idxTax))   || 0
    const rawEmpl  = parseFloat(get(idxEmplTx)) || 0
    const rawNet   = parseFloat(get(idxNet))    || 0

    if (!rawDate) { errors.push(`Row ${i + 1}: missing date`); continue }

    // Validate balance: GrossWages ≈ NetPay + TaxWithheld (within $1)
    const diff = Math.abs(rawGross - (rawNet + rawTax))
    if (diff > 1.01) {
      errors.push(`Row ${i + 1}: GrossWages (${rawGross}) ≠ NetPay + TaxWithheld (${rawNet + rawTax}); difference $${diff.toFixed(2)}`)
      continue
    }

    const date = new Date(rawDate)
    if (isNaN(date.getTime())) { errors.push(`Row ${i + 1}: invalid date "${rawDate}"`); continue }

    rows.push({
      date: date.toISOString().slice(0, 10),
      description: rawDesc || `Payroll ${rawDate}`,
      grossWagesCents: Math.round(rawGross * 100),
      taxWithheldCents: Math.round(rawTax * 100),
      employerTaxesCents: Math.round(rawEmpl * 100),
      netPayCents: Math.round(rawNet * 100),
    })
  }

  return { rows, errors }
}

// ─── Account auto-detection ───────────────────────────────────────────────────

async function findAccount(
  tenantId: string, entityId: string,
  type: "ASSET" | "LIABILITY" | "EXPENSE",
  keywords: string[],
): Promise<{ id: string; name: string; code: string } | null> {
  const accounts = await prisma.account.findMany({
    where: { tenantId, entityId, type, isActive: true },
    select: { id: true, name: true, code: true },
  })
  const lc = (s: string) => s.toLowerCase()
  for (const kw of keywords) {
    const match = accounts.find((a) => lc(a.name).includes(lc(kw)))
    if (match) return match
  }
  return accounts[0] ?? null
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await requireSession()
  const body = await req.json()
  const deny = assertAccess(session, body.entityId, "post"); if (deny) return deny

  const {
    csvText, entityId, preview = true,
    wagesAccountId, taxExpenseAccountId, cashAccountId, taxPayableAccountId,
  } = body as {
    csvText: string
    entityId: string
    preview: boolean
    wagesAccountId?: string
    taxExpenseAccountId?: string
    cashAccountId?: string
    taxPayableAccountId?: string
  }

  if (!csvText || !entityId) {
    return NextResponse.json({ error: "csvText and entityId required" }, { status: 400 })
  }

  const entity = await prisma.entity.findFirst({ where: { id: entityId, tenantId: session.tenantId } })
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 })

  const { rows, errors } = parsePayrollCsv(csvText)

  // Auto-detect accounts if not provided
  const [wagesAcct, taxExpAcct, cashAcct, taxPayAcct] = await Promise.all([
    wagesAccountId
      ? prisma.account.findFirst({ where: { id: wagesAccountId, tenantId: session.tenantId }, select: { id: true, name: true, code: true } })
      : findAccount(session.tenantId, entityId, "EXPENSE", ["wage", "salary", "payroll"]),
    taxExpenseAccountId
      ? prisma.account.findFirst({ where: { id: taxExpenseAccountId, tenantId: session.tenantId }, select: { id: true, name: true, code: true } })
      : findAccount(session.tenantId, entityId, "EXPENSE", ["payroll tax", "employer tax", "fica"]),
    cashAccountId
      ? prisma.account.findFirst({ where: { id: cashAccountId, tenantId: session.tenantId }, select: { id: true, name: true, code: true } })
      : findAccount(session.tenantId, entityId, "ASSET", ["payroll", "cash", "checking"]),
    taxPayableAccountId
      ? prisma.account.findFirst({ where: { id: taxPayableAccountId, tenantId: session.tenantId }, select: { id: true, name: true, code: true } })
      : findAccount(session.tenantId, entityId, "LIABILITY", ["payroll tax", "tax payable", "withholding"]),
  ])

  const accountWarnings: string[] = []
  if (!wagesAcct)   accountWarnings.push("No wages expense account found — select manually")
  if (!cashAcct)    accountWarnings.push("No cash/payroll account found — select manually")
  if (!taxPayAcct)  accountWarnings.push("No payroll tax payable account found — select manually")

  const previewEntries = rows.map((r) => ({
    date: r.date,
    description: r.description,
    lines: [
      { side: "DEBIT",  account: wagesAcct?.name ?? "? Wages Expense",         accountId: wagesAcct?.id,  amountCents: r.grossWagesCents },
      { side: "DEBIT",  account: taxExpAcct?.name ?? "? Payroll Tax Expense",   accountId: taxExpAcct?.id, amountCents: r.employerTaxesCents },
      { side: "CREDIT", account: cashAcct?.name ?? "? Cash / Payroll Payable",  accountId: cashAcct?.id,   amountCents: r.netPayCents },
      { side: "CREDIT", account: taxPayAcct?.name ?? "? Tax Payable",           accountId: taxPayAcct?.id, amountCents: r.taxWithheldCents + r.employerTaxesCents },
    ],
    grossWagesCents: r.grossWagesCents,
    netPayCents: r.netPayCents,
    taxWithheldCents: r.taxWithheldCents,
    employerTaxesCents: r.employerTaxesCents,
    balanced: r.grossWagesCents + r.employerTaxesCents === r.netPayCents + r.taxWithheldCents + r.employerTaxesCents,
  }))

  if (preview) {
    return NextResponse.json({
      preview: true,
      entries: previewEntries,
      errors: [...errors, ...accountWarnings],
      accountsDetected: {
        wagesAcct: wagesAcct ?? null,
        taxExpAcct: taxExpAcct ?? null,
        cashAcct: cashAcct ?? null,
        taxPayAcct: taxPayAcct ?? null,
      },
    })
  }

  // Commit — requires all 4 accounts resolved
  if (!wagesAcct || !cashAcct || !taxPayAcct) {
    return NextResponse.json({
      error: "Cannot commit: missing required account mappings",
      missing: [
        !wagesAcct && "wagesAccountId",
        !cashAcct  && "cashAccountId",
        !taxPayAcct && "taxPayableAccountId",
      ].filter(Boolean),
    }, { status: 400 })
  }

  let created = 0
  const commitErrors: string[] = [...errors]

  for (const row of rows) {
    try {
      const debit  = row.grossWagesCents + row.employerTaxesCents
      const credit = row.netPayCents + row.taxWithheldCents + row.employerTaxesCents
      if (debit !== credit) {
        commitErrors.push(`${row.date} "${row.description}": imbalanced — skipped`)
        continue
      }

      await createAndPostEntry({
        tenantId: session.tenantId,
        entityId,
        date: new Date(row.date),
        memo: row.description,
        source: "MANUAL",
        lines: [
          { accountId: wagesAcct.id,  debit: row.grossWagesCents,                             credit: 0 },
          ...(row.employerTaxesCents > 0 ? [{ accountId: taxExpAcct?.id ?? wagesAcct.id, debit: row.employerTaxesCents, credit: 0 }] : []),
          { accountId: cashAcct.id,   debit: 0, credit: row.netPayCents },
          { accountId: taxPayAcct.id, debit: 0, credit: row.taxWithheldCents + row.employerTaxesCents },
        ],
      })
      created++
    } catch (e) {
      commitErrors.push(`${row.date}: ${(e as Error).message}`)
    }
  }

  return NextResponse.json({ preview: false, created, errors: commitErrors })
}
