// Phase 45 integration verification: indirect cost allocation.
//  - active pools are spread across site/customer/plan rows on the report
//  - net margin = gross margin − allocated indirect cost
//  - per-row indirect sums re-sum to the allocated total (rounding absorbed)
//  - allocation is OFF (indirect = 0, net = gross) when includeIndirect is false
//  - a brand-new period-dated pool does not touch an earlier report
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase45-indirect.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { createDemoOrg } from "../src/lib/demo/provision"
import { getProfitability } from "../src/lib/data/profitability"
import { createIndirectCostPool, listIndirectCostPools, updateIndirectCostPool } from "../src/lib/data/indirect-costs"
import { ZERO, type Money } from "../src/lib/billing-math"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }
const sum = (rows: { indirectCost: Money }[]) => rows.reduce((a, r) => a.plus(r.indirectCost), ZERO)
const near = (a: Money, b: Money, eps = 0.02) => Math.abs(Number(a.minus(b))) <= eps

async function main() {
  const d = await createDemoOrg("45.45.45.45", 2)
  const orgId = d.orgId

  // A wide window that spans the demo's completed, invoiced work.
  const to = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)

  console.log("Pools seeded and listable:")
  const pools = await listIndirectCostPools(orgId)
  check("three demo pools exist", pools.length >= 3, `pools=${pools.length}`)
  check("each carries an amount, cadence and basis", pools.every((p) => !!p.amount && p.periodDays > 0 && !!p.basis))

  console.log("\nAllocation on — indirect is spread and net margin reflects it:")
  const on = await getProfitability(orgId, { periodStart: from, periodEnd: to, includeUninvoiced: true, includeIndirect: true })
  check("some indirect cost was allocated", Number(on.indirectAllocated) > 0, `allocated=${on.indirectAllocated}`)
  check("bySite indirect re-sums to the allocated total", near(sum(on.bySite), on.indirectAllocated.plus(on.indirectUnallocated)), `site=${sum(on.bySite)} total=${on.indirectAllocated}`)
  check("byCustomer indirect re-sums to the allocated total", near(sum(on.byCustomer), on.indirectAllocated.plus(on.indirectUnallocated)))
  check("net margin = gross margin − allocated indirect", near(on.netMargin, on.summary.margin.minus(on.indirectAllocated)))
  check("a site row carries its own indirect share", on.bySite.some((r) => Number(r.indirectCost) > 0))
  check("net margin is below gross (indirect reduces margin)", Number(on.netMargin) < Number(on.summary.margin))

  console.log("\nAllocation off — indirect is zero and net equals gross:")
  const off = await getProfitability(orgId, { periodStart: from, periodEnd: to, includeUninvoiced: true, includeIndirect: false })
  check("nothing allocated when off", on.indirectAllocated && Number(off.indirectAllocated) === 0)
  check("net margin equals gross margin when off", near(off.netMargin, off.summary.margin))
  check("every site row has zero indirect when off", off.bySite.every((r) => Number(r.indirectCost) === 0))

  console.log("\nEffective window gates a pool out of an earlier period:")
  await createIndirectCostPool(orgId, {
    name: "New equipment lease",
    category: "EQUIPMENT",
    amount: "5000",
    periodDays: 30,
    basis: "EVEN",
    effectiveFrom: new Date(Date.now() + 10 * 86_400_000), // starts in the future
  })
  const stillOn = await getProfitability(orgId, { periodStart: from, periodEnd: to, includeUninvoiced: true, includeIndirect: true })
  check("a future-dated pool does not change this report", near(stillOn.indirectAllocated, on.indirectAllocated))

  console.log("\nDeactivation stops future allocation:")
  const first = (await listIndirectCostPools(orgId)).find((p) => p.isActive && Number(p.amount) > 0)!
  await updateIndirectCostPool(orgId, first.id, { isActive: false })
  const afterDeactivate = await getProfitability(orgId, { periodStart: from, periodEnd: to, includeUninvoiced: true, includeIndirect: true })
  check("allocated total drops after deactivating a pool", Number(afterDeactivate.indirectAllocated) < Number(on.indirectAllocated))

  await systemDb.organization.delete({ where: { id: orgId } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL INDIRECT-COST CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
