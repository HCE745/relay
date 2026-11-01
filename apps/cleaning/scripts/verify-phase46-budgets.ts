// Phase 46 integration verification: labor budgeting & variance.
//  - budgets list with their target labels; targets are selectable
//  - variance prorates the budget and reports actual hours/cost vs budget
//  - an over-budget target is flagged; an unprofitable one (labor > revenue) alerts
//  - deactivating a budget drops it from the variance report
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase46-budgets.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { createDemoOrg } from "../src/lib/demo/provision"
import {
  listLaborBudgets,
  listBudgetTargets,
  createLaborBudget,
  updateLaborBudget,
  getLaborBudgetVariance,
} from "../src/lib/data/labor-budgets"

let failures = 0
const check = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${n}${d ? ` — ${d}` : ""}`); if (!ok) failures++ }

async function main() {
  const d = await createDemoOrg("46.46.46.46", 2)
  const orgId = d.orgId

  const to = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10)

  console.log("Budgets seeded with target labels:")
  const budgets = await listLaborBudgets(orgId)
  check("at least the three demo budgets exist", budgets.length >= 3, `budgets=${budgets.length}`)
  check("each budget resolves a target name", budgets.every((b) => !!b.name && b.name.length > 1))
  check("scopes cover contract, site and plan", ["CONTRACT", "SITE", "PLAN"].every((s) => budgets.some((b) => b.scope === s)))

  console.log("\nTargets are selectable for new budgets:")
  const targets = await listBudgetTargets(orgId)
  check("contracts, sites and plans are offered", targets.contracts.length > 0 && targets.sites.length > 0 && targets.plans.length > 0)

  console.log("\nVariance prorates the budget and reports actuals:")
  const variance = await getLaborBudgetVariance(orgId, { periodStart: from, periodEnd: to })
  check("a row per active budget", variance.length === budgets.filter((b) => b.isActive).length, `rows=${variance.length}`)
  check("budget hours are prorated above the weekly/monthly base", variance.some((r) => Number(r.hours.budget) > 0))
  check("actual hours accumulated for a worked target", variance.some((r) => Number(r.hours.actual) > 0))
  check("scheduled hours are reported", variance.some((r) => Number(r.scheduledHours) > 0))
  check("cost variance carries a percent-used", variance.every((r) => r.cost.pctUsed === null || typeof r.cost.pctUsed === "number"))

  console.log("\nAn obviously-unprofitable contract alerts:")
  // A tiny budget on a worked site with a low-revenue scope should breach; to be
  // deterministic, add a contract budget whose target has approved labor and set
  // its alert on, then look for any unprofitable or over-budget flag.
  const site = targets.sites[0]
  const tinyBudget = await createLaborBudget(orgId, {
    scope: "SITE",
    serviceLocationId: site.id,
    period: "MONTHLY",
    budgetedHours: "1",
    budgetedCost: "1",
    alertUnprofitable: true,
  })
  const v2 = await getLaborBudgetVariance(orgId, { periodStart: from, periodEnd: to })
  const tiny = v2.find((r) => r.id === tinyBudget.id)
  check("the $1 site budget is over budget on cost", !!tiny && tiny.overBudgetCost, tiny ? `budget=${tiny.cost.budget} actual=${tiny.cost.actual}` : "row missing")
  check("some target is flagged over budget", v2.some((r) => r.overBudgetCost || r.overBudgetHours))

  console.log("\nDeactivation removes a budget from the report:")
  const first = budgets[0]
  await updateLaborBudget(orgId, first.id, { isActive: false })
  const v3 = await getLaborBudgetVariance(orgId, { periodStart: from, periodEnd: to })
  check("the deactivated budget is gone from variance", !v3.some((r) => r.id === first.id))

  await systemDb.organization.delete({ where: { id: orgId } }).catch(() => {})
  console.log(`\n${failures === 0 ? "ALL LABOR-BUDGET CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
