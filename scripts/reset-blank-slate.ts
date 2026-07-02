/**
 * reset-blank-slate.ts
 *
 * Deletes ALL transactional data from the HCE Books database while preserving
 * the foundational structure (tenant, entities, chart of accounts, users,
 * accounting periods, classes, departments).
 *
 * Usage:
 *   npx tsx scripts/reset-blank-slate.ts            # dry-run: prints counts only
 *   npx tsx scripts/reset-blank-slate.ts --confirm  # executes deletion
 *
 * Tables deleted (FK-safe order):
 *   AuditLog, JournalLine, CreditMemo, InvoicePayment, InvoiceLine,
 *   VendorCredit, BillPayment, BillLine, JournalEntry, Invoice, Bill,
 *   BankTransaction, BankAccount, BankRule, Customer, Vendor, Product
 *
 * Tables preserved:
 *   Tenant, Entity, HceUser, EntityAccess, Account, AccountingPeriod,
 *   Class, Department
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { execSync } from "child_process"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 })
const prisma = new PrismaClient({ adapter })

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEP = "═".repeat(62)
const sep = "─".repeat(62)

type CountMap = Record<string, number>

async function getTransactionalCounts(): Promise<CountMap> {
  const [
    auditLogs,
    journalLines, journalEntries,
    creditMemos, invoicePayments, invoiceLines, invoices,
    vendorCredits, billPayments, billLines, bills,
    bankTransactions, bankAccounts, bankRules,
    customers, vendors, products,
  ] = await Promise.all([
    prisma.auditLog.count(),
    prisma.journalLine.count(),
    prisma.journalEntry.count(),
    prisma.creditMemo.count(),
    prisma.invoicePayment.count(),
    prisma.invoiceLine.count(),
    prisma.invoice.count(),
    prisma.vendorCredit.count(),
    prisma.billPayment.count(),
    prisma.billLine.count(),
    prisma.bill.count(),
    prisma.bankTransaction.count(),
    prisma.bankAccount.count(),
    prisma.bankRule.count(),
    prisma.customer.count(),
    prisma.vendor.count(),
    prisma.product.count(),
  ])

  return {
    "AuditLog":        auditLogs,
    "JournalLine":     journalLines,
    "JournalEntry":    journalEntries,
    "CreditMemo":      creditMemos,
    "InvoicePayment":  invoicePayments,
    "InvoiceLine":     invoiceLines,
    "Invoice":         invoices,
    "VendorCredit":    vendorCredits,
    "BillPayment":     billPayments,
    "BillLine":        billLines,
    "Bill":            bills,
    "BankTransaction": bankTransactions,
    "BankAccount":     bankAccounts,
    "BankRule":        bankRules,
    "Customer":        customers,
    "Vendor":          vendors,
    "Product":         products,
  }
}

async function getFoundationCounts() {
  const [entities, accounts, users, entityAccess, periods, classes, departments] = await Promise.all([
    prisma.entity.count(),
    prisma.account.count(),
    prisma.hceUser.count(),
    prisma.entityAccess.count(),
    prisma.accountingPeriod.count(),
    prisma.class.count(),
    prisma.department.count(),
  ])
  return { entities, accounts, users, entityAccess, periods, classes, departments }
}

function printCounts(label: string, counts: CountMap) {
  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  console.log(`\n${label}  (${total.toLocaleString()} rows total)`)
  console.log(sep)
  let anyNonZero = false
  for (const [table, count] of Object.entries(counts)) {
    if (count > 0) {
      anyNonZero = true
      console.log(`  ${table.padEnd(20)}  ${count.toLocaleString().padStart(8)} rows`)
    }
  }
  if (!anyNonZero) {
    console.log("  (all tables already empty)")
  }
}

// ── Deletion (FK-safe order) ──────────────────────────────────────────────────

async function deleteAll() {
  process.stdout.write("  Deleting AuditLog …            ")
  const al = await prisma.auditLog.deleteMany({})
  console.log(`${al.count} rows`)

  process.stdout.write("  Deleting JournalLine …         ")
  const jl = await prisma.journalLine.deleteMany({})
  console.log(`${jl.count} rows`)

  // Invoice sub-records (CreditMemo has non-cascade FK to Invoice → delete first)
  process.stdout.write("  Deleting CreditMemo …          ")
  const cm = await prisma.creditMemo.deleteMany({})
  console.log(`${cm.count} rows`)

  process.stdout.write("  Deleting InvoicePayment …      ")
  const ip = await prisma.invoicePayment.deleteMany({})
  console.log(`${ip.count} rows`)

  process.stdout.write("  Deleting InvoiceLine …         ")
  const il = await prisma.invoiceLine.deleteMany({})
  console.log(`${il.count} rows`)

  // Bill sub-records (VendorCredit has non-cascade FK to Bill → delete first)
  process.stdout.write("  Deleting VendorCredit …        ")
  const vc = await prisma.vendorCredit.deleteMany({})
  console.log(`${vc.count} rows`)

  process.stdout.write("  Deleting BillPayment …         ")
  const bp = await prisma.billPayment.deleteMany({})
  console.log(`${bp.count} rows`)

  process.stdout.write("  Deleting BillLine …            ")
  const bl = await prisma.billLine.deleteMany({})
  console.log(`${bl.count} rows`)

  // Headers
  process.stdout.write("  Deleting JournalEntry …        ")
  const je = await prisma.journalEntry.deleteMany({})
  console.log(`${je.count} rows`)

  process.stdout.write("  Deleting Invoice …             ")
  const inv = await prisma.invoice.deleteMany({})
  console.log(`${inv.count} rows`)

  process.stdout.write("  Deleting Bill …                ")
  const b = await prisma.bill.deleteMany({})
  console.log(`${b.count} rows`)

  // Banking (BankTransaction has cascade FK to BankAccount → delete txns first)
  process.stdout.write("  Deleting BankTransaction …     ")
  const bt = await prisma.bankTransaction.deleteMany({})
  console.log(`${bt.count} rows`)

  process.stdout.write("  Deleting BankAccount …         ")
  const ba = await prisma.bankAccount.deleteMany({})
  console.log(`${ba.count} rows`)

  process.stdout.write("  Deleting BankRule …            ")
  const br = await prisma.bankRule.deleteMany({})
  console.log(`${br.count} rows`)

  // AR/AP masters
  process.stdout.write("  Deleting Customer …            ")
  const cu = await prisma.customer.deleteMany({})
  console.log(`${cu.count} rows`)

  process.stdout.write("  Deleting Vendor …              ")
  const v = await prisma.vendor.deleteMany({})
  console.log(`${v.count} rows`)

  process.stdout.write("  Deleting Product …             ")
  const pr = await prisma.product.deleteMany({})
  console.log(`${pr.count} rows`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const confirm = args.includes("--confirm")

  console.log(`\n${SEP}`)
  console.log("  HCE Books — Blank Slate Reset")
  console.log(SEP)

  // ── Step 1: count what will be deleted ──────────────────────────────────────
  console.log("\nCounting transactional rows …")
  const before = await getTransactionalCounts()
  const beforeTotal = Object.values(before).reduce((s, n) => s + n, 0)
  printCounts("WILL DELETE", before)

  if (!confirm) {
    console.log(`\n⚠️  DRY RUN — nothing deleted.`)
    console.log(`   Run with --confirm to execute:\n`)
    console.log(`   npx tsx scripts/reset-blank-slate.ts --confirm\n`)
    process.exit(0)
  }

  if (beforeTotal === 0) {
    console.log("\n✅ Already a clean slate — nothing to delete.\n")
  } else {
    // ── Step 2: delete ───────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(62)}`)
    console.log("Deleting in FK-safe order …")
    console.log(sep)
    await deleteAll()
  }

  // ── Step 3: verify transactional tables are empty ───────────────────────────
  console.log(`\n${"─".repeat(62)}`)
  console.log("Verifying transactional tables …")
  console.log(sep)
  const after = await getTransactionalCounts()
  const afterTotal = Object.values(after).reduce((s, n) => s + n, 0)

  if (afterTotal > 0) {
    printCounts("❌  ROWS REMAIN (deletion incomplete)", after)
    process.exit(1)
  }
  console.log("  All transactional tables: 0 rows ✓")

  // ── Step 4: verify foundation is intact ─────────────────────────────────────
  console.log(`\n${"─".repeat(62)}`)
  console.log("Verifying foundation (must not be zero) …")
  console.log(sep)
  const found = await getFoundationCounts()
  const rows: [string, number][] = [
    ["Entities",           found.entities],
    ["Chart of accounts",  found.accounts],
    ["Users",              found.users],
    ["Entity access",      found.entityAccess],
    ["Accounting periods", found.periods],
    ["Classes",            found.classes],
    ["Departments",        found.departments],
  ]
  let foundationOk = true
  for (const [name, count] of rows) {
    const ok = name === "Classes" || name === "Departments" ? count >= 0 : count > 0
    const tag = (name === "Classes" || name === "Departments") ? "✓" : (count > 0 ? "✓" : "✗")
    if (!ok) foundationOk = false
    console.log(`  ${tag}  ${name.padEnd(22)} ${count.toLocaleString().padStart(6)} rows`)
  }
  if (!foundationOk) {
    console.error("\n❌  Foundation check failed — re-seed with: npm run seed")
    process.exit(1)
  }

  // ── Step 5: run verify.ts ───────────────────────────────────────────────────
  console.log(`\n${"─".repeat(62)}`)
  console.log("Running verify.ts (trial balance check) …")
  console.log(sep)
  try {
    execSync("npx tsx scripts/verify.ts", { stdio: "inherit" })
  } catch {
    // verify.ts already printed the failure details and exits non-zero
    process.exit(1)
  }

  console.log(`\n${SEP}`)
  console.log("  ✅  BLANK SLATE COMPLETE")
  console.log(`${SEP}\n`)
}

main()
  .catch((err) => {
    console.error("\nFatal:", err.message ?? err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
