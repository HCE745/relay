// Phase 6 inventory integration verification against a live database.
// Covers the DB-coupled rules: usage decrements stock (clamped at 0, and only
// for an assigned cleaner), manual adjustment with a reason, negative-stock
// guard, low-stock count, and the asset maintenance log.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase6-inventory.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { createSupply, recordSupplyUsage, adjustSupply, countLowStock, getSupply } from "../src/lib/data/supplies"
import { createAsset, addMaintenance } from "../src/lib/data/assets"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
async function threw(fn: () => Promise<unknown>) {
  try {
    await fn()
    return null
  } catch (e) {
    return (e as Error).message
  }
}
const stock = async (id: string) => (await systemDb.supply.findUniqueOrThrow({ where: { id } })).currentStock.toString()

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Inv Test", slug: `inv-${stamp}`, packageTier: "BUSINESS", timezone: "UTC" } })
  const owner = await systemDb.user.create({ data: { organizationId: org.id, email: `o-${stamp}@t.test`, name: "Owner", password: "x", role: "OWNER" } })
  const cleaner = await systemDb.user.create({ data: { organizationId: org.id, email: `c-${stamp}@t.test`, name: "Cleaner", password: "x", role: "CLEANER" } })
  const other = await systemDb.user.create({ data: { organizationId: org.id, email: `c2-${stamp}@t.test`, name: "Other", password: "x", role: "CLEANER" } })
  const customer = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: customer.id, name: "HQ", timezone: "UTC" } })
  const job = await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, title: "Clean", status: "IN_PROGRESS", scheduledStart: new Date("2026-09-23T09:00:00Z") } })
  await systemDb.jobAssignment.create({ data: { organizationId: org.id, jobId: job.id, userId: cleaner.id } })

  const supply = await createSupply(org.id, { name: "Trash bags", unit: "case", currentStock: "10", reorderThreshold: "3" })

  console.log("Cleaner usage decrements stock:")
  const u1 = await recordSupplyUsage(org.id, cleaner.id, job.id, { supplyId: supply.id, quantity: "4" })
  check("usage recorded", u1 !== null)
  check("stock 10 → 6", (await stock(supply.id)) === "6")
  const withUsage = await getSupply(org.id, supply.id)
  check("usage log has the entry, tagged with site + recorder", withUsage?.usages[0]?.serviceLocation?.name === "HQ" && withUsage?.usages[0]?.recordedBy.name === "Cleaner")

  console.log("Over-draw clamps at 0 (physical stock never negative), usage still logged:")
  await recordSupplyUsage(org.id, cleaner.id, job.id, { supplyId: supply.id, quantity: "100" })
  check("stock clamps to 0", (await stock(supply.id)) === "0")
  const s2 = await getSupply(org.id, supply.id)
  check("both usages are in the log", s2?.usages.length === 2)

  console.log("Low-stock count picks it up:")
  check("1 supply low (0 ≤ 3)", (await countLowStock(org.id)) === 1)

  console.log("A cleaner NOT assigned to the job cannot log usage:")
  const denied = await recordSupplyUsage(org.id, other.id, job.id, { supplyId: supply.id, quantity: "1" })
  check("unassigned cleaner refused (null)", denied === null)
  check("stock unchanged by the refused attempt", (await stock(supply.id)) === "0")

  console.log("Manual adjustment (with reason) restocks; negative result is refused:")
  await adjustSupply(org.id, supply.id, owner.id, { delta: "20", reason: "Received shipment" })
  check("stock 0 → 20 after +20", (await stock(supply.id)) === "20")
  const overdraw = await threw(() => adjustSupply(org.id, supply.id, owner.id, { delta: "-100", reason: "typo" }))
  check("adjustment that would go negative is refused", overdraw !== null && /negative/i.test(overdraw ?? ""))
  check("stock unchanged after the refused adjustment", (await stock(supply.id)) === "20")
  const s3 = await getSupply(org.id, supply.id)
  check("one adjustment logged with its reason", s3?.adjustments.length === 1 && s3?.adjustments[0].reason === "Received shipment")
  check("no longer low after restock", (await countLowStock(org.id)) === 0)

  console.log("Asset + maintenance log:")
  const asset = await createAsset(org.id, { name: "Floor buffer", category: "MACHINE", purchaseCost: "1200" })
  await addMaintenance(org.id, asset.id, owner.id, { type: "Pad replacement", cost: "45", notes: "Worn" })
  const withMaint = await systemDb.asset.findUniqueOrThrow({ where: { id: asset.id }, include: { maintenance: true } })
  check("asset has one maintenance entry", withMaint.maintenance.length === 1 && withMaint.maintenance[0].type === "Pad replacement")

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL INVENTORY CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
