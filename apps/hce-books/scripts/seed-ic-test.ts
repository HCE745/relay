/**
 * Seed intercompany test transaction.
 *
 * Posts a $10,000 (1,000,000 cents) intercompany transfer from HCE → Relay
 * using createIntercompanyTransaction from src/lib/intercompany.ts.
 *
 * Run with: npx tsx --conditions react-server scripts/seed-ic-test.ts
 * (--conditions react-server resolves server-only to the empty module)
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { createIntercompanyTransaction } from "../src/lib/intercompany"

// Separate client for lookups — createIntercompanyTransaction uses its own
// singleton from src/lib/prisma.ts which also reads DATABASE_URL
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 })
const prisma = new PrismaClient({ adapter })

async function main() {
  // ── Look up tenant ─────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: "hce-tenant" } })
  console.log("Tenant:", tenant.name, `(id: ${tenant.id})`)

  // ── Look up entities ───────────────────────────────────────────────────────
  const hce = await prisma.entity.findUniqueOrThrow({ where: { id: "hce-entity" } })
  const relay = await prisma.entity.findUniqueOrThrow({ where: { id: "relay-entity" } })
  console.log("From entity:", hce.name, `(id: ${hce.id})`)
  console.log("To entity:  ", relay.name, `(id: ${relay.id})`)

  // ── Look up accounts by code ───────────────────────────────────────────────
  // HCE side: Checking Account (cash) + IC Receivable – Relay Software
  const hceCash = await prisma.account.findFirstOrThrow({
    where: { tenantId: tenant.id, entityId: hce.id, code: "1010" },
  })
  const hceICReceivable = await prisma.account.findFirstOrThrow({
    where: { tenantId: tenant.id, entityId: hce.id, code: "1800" },
  })

  // Relay side: Checking Account (cash) + IC Payable – HCE
  const relayCash = await prisma.account.findFirstOrThrow({
    where: { tenantId: tenant.id, entityId: relay.id, code: "1010" },
  })
  const relayICPayable = await prisma.account.findFirstOrThrow({
    where: { tenantId: tenant.id, entityId: relay.id, code: "2800" },
  })

  console.log("\nAccounts resolved:")
  console.log(`  HCE  fromCash       : ${hceCash.code}  ${hceCash.name}`)
  console.log(`  HCE  fromReceivable : ${hceICReceivable.code}  ${hceICReceivable.name}`)
  console.log(`  Relay toCash        : ${relayCash.code}  ${relayCash.name}`)
  console.log(`  Relay toPayable     : ${relayICPayable.code}  ${relayICPayable.name}`)

  // ── Post the intercompany transaction ──────────────────────────────────────
  const AMOUNT_CENTS = 1_000_000 // $10,000.00
  console.log(`\nPosting intercompany transfer: $${(AMOUNT_CENTS / 100).toFixed(2)}`)
  console.log("  HCE   → DR IC-Receivable–Relay / CR Checking")
  console.log("  Relay → DR Checking / CR IC-Payable–HCE")
  console.log("  (atomic via createIntercompanyTransaction)")

  const result = await createIntercompanyTransaction({
    tenantId: tenant.id,
    fromEntityId: hce.id,
    toEntityId: relay.id,
    amountCents: AMOUNT_CENTS,
    date: new Date(),
    memo: "Test IC transfer: HCE funds Relay ($10,000)",
    accounts: {
      fromReceivableAccountId: hceICReceivable.id,
      fromCashAccountId: hceCash.id,
      toPayableAccountId: relayICPayable.id,
      toCashAccountId: relayCash.id,
    },
  })

  // ── Print result ───────────────────────────────────────────────────────────
  console.log("\n✓ Transaction posted")
  console.log(`  intercompanyGroupId : ${result.intercompanyGroupId}`)
  console.log(`  HCE   entry         : ${result.fromEntry.id}  status=${result.fromEntry.status}`)
  console.log(`  Relay entry         : ${result.toEntry.id}  status=${result.toEntry.status}`)

  console.log("\nHCE journal lines:")
  for (const l of result.fromEntry.lines) {
    const drStr = l.debit > 0 ? `DR ${(l.debit / 100).toFixed(2)}` : "          "
    const crStr = l.credit > 0 ? `CR ${(l.credit / 100).toFixed(2)}` : ""
    console.log(`  account ${l.accountId.slice(0, 12)}…  ${drStr}  ${crStr}`)
  }
  const hceDR = result.fromEntry.lines.reduce((s, l) => s + l.debit, 0)
  const hceCR = result.fromEntry.lines.reduce((s, l) => s + l.credit, 0)
  console.log(`  Total: DR ${(hceDR / 100).toFixed(2)}  CR ${(hceCR / 100).toFixed(2)}  ${hceDR === hceCR ? "✓ balanced" : "✗ UNBALANCED"}`)

  console.log("\nRelay journal lines:")
  for (const l of result.toEntry.lines) {
    const drStr = l.debit > 0 ? `DR ${(l.debit / 100).toFixed(2)}` : "          "
    const crStr = l.credit > 0 ? `CR ${(l.credit / 100).toFixed(2)}` : ""
    console.log(`  account ${l.accountId.slice(0, 12)}…  ${drStr}  ${crStr}`)
  }
  const relayDR = result.toEntry.lines.reduce((s, l) => s + l.debit, 0)
  const relayCR = result.toEntry.lines.reduce((s, l) => s + l.credit, 0)
  console.log(`  Total: DR ${(relayDR / 100).toFixed(2)}  CR ${(relayCR / 100).toFixed(2)}  ${relayDR === relayCR ? "✓ balanced" : "✗ UNBALANCED"}`)
}

main()
  .catch((err) => {
    console.error("\nError:", err.message ?? err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
