/**
 * Ledger verification script.
 *
 * Check 1 — Per-entity trial balance:
 *   For every Entity, sum all JournalLine.debit and .credit where the parent
 *   JournalEntry has entityId = that entity AND status = POSTED.
 *   PASS if sum(debits) === sum(credits).
 *
 * Check 2 — Intercompany group balance:
 *   For every distinct intercompanyGroupId (not null, status POSTED), sum
 *   debits and credits across ALL journal lines in the group (all entities).
 *   PASS if sum(debits) === sum(credits).
 *
 * Exits with code 0 if all checks pass, 1 if any fail.
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 })
const prisma = new PrismaClient({ adapter })

async function main() {
  let anyFailed = false
  let totalChecks = 0
  let passedChecks = 0

  // ── Check 1: Per-entity trial balance ──────────────────────────────────────
  console.log("\n── Check 1: Per-Entity Trial Balance ────────────────────────────────")

  const entities = await prisma.entity.findMany({ orderBy: { name: "asc" } })

  if (entities.length === 0) {
    console.log("  (no entities found)")
  }

  for (const entity of entities) {
    const agg = await prisma.journalLine.aggregate({
      where: {
        journalEntry: {
          entityId: entity.id,
          status: "POSTED",
        },
      },
      _sum: { debit: true, credit: true },
    })

    const totalDebit = agg._sum.debit ?? 0
    const totalCredit = agg._sum.credit ?? 0
    const balanced = totalDebit === totalCredit
    totalChecks++
    if (balanced) passedChecks++
    else anyFailed = true

    const tag = balanced ? "PASS ✓" : "FAIL ✗"
    const drStr = (totalDebit / 100).toFixed(2)
    const crStr = (totalCredit / 100).toFixed(2)
    console.log(`  [${tag}] ${entity.name.padEnd(24)} DR $${drStr.padStart(12)}  CR $${crStr.padStart(12)}`)
    if (!balanced) {
      const diff = totalDebit - totalCredit
      console.log(`          ↳ out of balance by ${diff > 0 ? "+" : ""}${(diff / 100).toFixed(2)} cents`)
    }
  }

  // ── Check 2: Intercompany group balance ────────────────────────────────────
  console.log("\n── Check 2: Intercompany Group Balance ──────────────────────────────")

  // Fetch all POSTED IC entries with lines
  const icEntries = await prisma.journalEntry.findMany({
    where: {
      status: "POSTED",
      intercompanyGroupId: { not: null },
    },
    include: { lines: true },
    orderBy: { intercompanyGroupId: "asc" },
  })

  // Group by intercompanyGroupId
  const groups = new Map<string, typeof icEntries>()
  for (const entry of icEntries) {
    if (!entry.intercompanyGroupId) continue
    const bucket = groups.get(entry.intercompanyGroupId) ?? []
    bucket.push(entry)
    groups.set(entry.intercompanyGroupId, bucket)
  }

  if (groups.size === 0) {
    console.log("  (no intercompany groups found)")
  }

  for (const [groupId, entries] of groups) {
    const allLines = entries.flatMap((e) => e.lines)
    const totalDebit = allLines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = allLines.reduce((s, l) => s + l.credit, 0)
    const balanced = totalDebit === totalCredit
    totalChecks++
    if (balanced) passedChecks++
    else anyFailed = true

    const tag = balanced ? "PASS ✓" : "FAIL ✗"
    const entityIds = [...new Set(entries.map((e) => e.entityId))]
    const drStr = (totalDebit / 100).toFixed(2)
    const crStr = (totalCredit / 100).toFixed(2)
    console.log(
      `  [${tag}] Group ${groupId.slice(0, 8)}…  ${entries.length} entries / ${entityIds.length} entities` +
        `  DR $${drStr}  CR $${crStr}`,
    )
    if (!balanced) {
      const diff = totalDebit - totalCredit
      console.log(
        `          ↳ out of balance by ${diff > 0 ? "+" : ""}${(diff / 100).toFixed(2)}`,
      )
      // Per-entry breakdown to help diagnose
      for (const entry of entries) {
        const dr = entry.lines.reduce((s, l) => s + l.debit, 0)
        const cr = entry.lines.reduce((s, l) => s + l.credit, 0)
        console.log(
          `          ↳ entry ${entry.id.slice(0, 8)}… entity=${entry.entityId.slice(0, 8)}…` +
            `  DR ${dr}  CR ${cr}`,
        )
      }
    }
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════")
  console.log(`  ${passedChecks}/${totalChecks} checks passed`)
  if (anyFailed) {
    console.log("  ❌  VERIFICATION FAILED — one or more checks above printed FAIL")
  } else {
    console.log("  ✅  ALL CHECKS PASSED — ledger is balanced")
  }
  console.log("══════════════════════════════════════════════════════════════════════\n")

  process.exit(anyFailed ? 1 : 0)
}

main()
  .catch((err) => {
    console.error("\nFatal error:", err.message ?? err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
