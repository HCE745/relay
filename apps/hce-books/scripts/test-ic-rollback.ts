/**
 * Atomicity rollback test.
 *
 * Proves that if the SECOND createAndPostEntry (Relay side) fails, the FIRST
 * (HCE side) is also rolled back — no orphaned IC entry remains.
 *
 * Strategy: pass a non-existent account ID for the Relay cash account.
 * Prisma will throw a FK constraint error when it tries to insert that JournalLine,
 * which causes the whole $transaction to roll back.
 *
 * Run with: npx tsx --conditions react-server scripts/test-ic-rollback.ts
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { createIntercompanyTransaction } from "../src/lib/intercompany"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 })
const prisma = new PrismaClient({ adapter })

async function main() {
  // ── Look up real accounts to use on the HCE side (must be valid) ──────────
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: "hce-tenant" } })
  const hce = await prisma.entity.findUniqueOrThrow({ where: { id: "hce-entity" } })
  const relay = await prisma.entity.findUniqueOrThrow({ where: { id: "relay-entity" } })

  const hceCash = await prisma.account.findFirstOrThrow({
    where: { tenantId: tenant.id, entityId: hce.id, code: "1010" },
  })
  const hceICReceivable = await prisma.account.findFirstOrThrow({
    where: { tenantId: tenant.id, entityId: hce.id, code: "1800" },
  })
  const relayICPayable = await prisma.account.findFirstOrThrow({
    where: { tenantId: tenant.id, entityId: relay.id, code: "2800" },
  })

  // ── Count rows before ──────────────────────────────────────────────────────
  const countBefore = await prisma.journalEntry.count()
  console.log(`JournalEntry rows before: ${countBefore}`)

  // ── Fire the IC transaction with a deliberately bad Relay cash account ─────
  // toCashAccountId is a bogus ID — FK constraint will fire on JournalLine insert.
  const BAD_ACCOUNT_ID = "does-not-exist-00000000000000"
  console.log("Attempting IC transaction with invalid Relay cash account...")
  try {
    await createIntercompanyTransaction({
      tenantId: tenant.id,
      fromEntityId: hce.id,
      toEntityId: relay.id,
      amountCents: 99_99, // $99.99 — distinct from seed-ic-test amount
      date: new Date(),
      memo: "ROLLBACK TEST — must not persist",
      accounts: {
        fromReceivableAccountId: hceICReceivable.id, // valid
        fromCashAccountId: hceCash.id,               // valid
        toPayableAccountId: relayICPayable.id,        // valid
        toCashAccountId: BAD_ACCOUNT_ID,              // INVALID — triggers FK error
      },
    })
    // If we reach here the transaction succeeded when it should have failed.
    console.error("ERROR: IC transaction succeeded — it should have thrown!")
    process.exitCode = 1
    return
  } catch (err) {
    console.log(`Caught expected error: ${(err as Error).message?.slice(0, 120)}`)
  }

  // ── Count rows after ───────────────────────────────────────────────────────
  const countAfter = await prisma.journalEntry.count()
  console.log(`JournalEntry rows after:  ${countAfter}`)

  // ── Assert ─────────────────────────────────────────────────────────────────
  if (countAfter === countBefore) {
    console.log("\nPASS — row count unchanged; HCE entry was rolled back atomically")
  } else {
    const orphaned = countAfter - countBefore
    console.error(`\nFAIL — ${orphaned} orphaned row(s) remain after the failed IC transaction`)
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error("\nFatal:", err.message ?? err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
