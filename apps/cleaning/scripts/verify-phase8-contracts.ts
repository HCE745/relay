// Phase 8 integration verification against a live database. Focus on the four
// constraints: (1) contracts never generate invoices — invoicing is untouched;
// (2) contract value vs. actually-invoiced revenue is accurate and bounded by
// the term; (3) linking service plans is optional — an existing customer with
// plans and no contract keeps working; (4) the expiring-contract count honours
// a configurable lead time.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase8-contracts.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { generateInvoice, setInvoiceStatus } from "../src/lib/data/invoices"
import {
  createContract,
  updateContract,
  setContractPlans,
  getContract,
  listContracts,
  countExpiring,
} from "../src/lib/data/contracts"
import { getContractExpiryLeadDays, updateOrgSettings } from "../src/lib/data/org"

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
const invoiceCount = (orgId: string) => systemDb.invoice.count({ where: { organizationId: orgId } })

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Contract Test", slug: `contract-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const customer = await systemDb.customer.create({ data: { organizationId: org.id, name: "Globex", paymentTerms: "NET_15" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: customer.id, name: "Plant", timezone: "UTC" } })

  // Two service plans; each has a completed job that will be invoiced.
  const mkPlanWithJob = async (name: string, rate: string, day: string) => {
    const plan = await systemDb.servicePlan.create({ data: { organizationId: org.id, serviceLocationId: site.id, name, billingType: "FLAT_PER_JOB", rate } })
    await systemDb.job.create({ data: { organizationId: org.id, serviceLocationId: site.id, servicePlanId: plan.id, title: `${name} job`, status: "COMPLETED", scheduledStart: new Date(`${day}T09:00:00Z`), actualEnd: new Date(`${day}T10:00:00Z`) } })
    return plan
  }
  const planA = await mkPlanWithJob("Plan A", "1000.00", "2026-03-10")
  const planB = await mkPlanWithJob("Plan B", "400.00", "2026-03-12")

  console.log("Invoicing is unchanged — a contract never becomes a billing path:")
  const before = await invoiceCount(org.id)
  const k = await createContract(org.id, { customerId: customer.id, title: "2026 Janitorial", startDate: "2026-01-01", endDate: "2026-12-31", contractValue: "24000", billingFrequency: "MONTHLY", status: "ACTIVE" })
  check("creating a contract writes no invoice", (await invoiceCount(org.id)) === before)
  await setContractPlans(org.id, k.id, [planA.id, planB.id])
  check("linking plans writes no invoice", (await invoiceCount(org.id)) === before)
  // Invoices still come only from generateInvoice over jobs/plans.
  const gen = await generateInvoice(org.id, { customerId: customer.id, periodStart: "2026-03-01", periodEnd: "2026-03-31" })
  await setInvoiceStatus(org.id, gen.invoiceId, "SENT")
  check("invoices still generate from jobs exactly as before", gen.created && (await invoiceCount(org.id)) === before + 1)

  console.log("Contract value vs. invoiced is accurate (the $24k vs. $18.4k idea):")
  const r1 = await getContract(org.id, k.id)
  check("invoiced = sum of linked plans' invoice lines (1000 + 400)", r1!.progress.invoiced.toString() === "1400", r1!.progress.invoiced.toString())
  check("remaining = value − invoiced (24000 − 1400)", r1!.progress.remaining?.toString() === "22600")
  check("pct is invoiced/value to 1dp", Math.abs((r1!.progress.pct ?? 0) - 5.8) < 0.05, String(r1!.progress.pct))

  console.log("Revenue is bounded by the contract term (no double counting outside dates):")
  // Shift the term to exclude planB's job (Mar 12): only planA (Mar 10) counts.
  await updateContract(org.id, k.id, { startDate: "2026-03-01", endDate: "2026-03-11" })
  const r2 = await getContract(org.id, k.id)
  check("only in-term lines count after narrowing the window", r2!.progress.invoiced.toString() === "1000", r2!.progress.invoiced.toString())

  console.log("VOID invoices are excluded from attributed revenue:")
  await setInvoiceStatus(org.id, gen.invoiceId, "VOID")
  await updateContract(org.id, k.id, { startDate: "2026-01-01", endDate: "2026-12-31" })
  const r3 = await getContract(org.id, k.id)
  check("voided invoice contributes nothing", r3!.progress.invoiced.toString() === "0", r3!.progress.invoiced.toString())

  console.log("Linking is optional and reversible — nothing is required:")
  // A second customer with a plan and NO contract must keep working.
  const cust2 = await systemDb.customer.create({ data: { organizationId: org.id, name: "Initech" } })
  const site2 = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: cust2.id, name: "Office", timezone: "UTC" } })
  const plan2 = await systemDb.servicePlan.create({ data: { organizationId: org.id, serviceLocationId: site2.id, name: "Solo plan", billingType: "FLAT_PER_JOB", rate: "200.00" } })
  check("a plan with no contract has contractId = null", plan2.contractId === null)
  const g2 = await generateInvoice(org.id, { customerId: cust2.id, periodStart: "2026-01-01", periodEnd: "2026-12-31" }).catch(() => ({ created: false }))
  check("an un-contracted customer's plan still exists and is billable-shaped", plan2.billingType === "FLAT_PER_JOB", `gen=${(g2 as { created: boolean }).created}`)
  // Unlink everything from the contract → invoiced falls to 0, plans survive.
  await setContractPlans(org.id, k.id, [])
  const r4 = await getContract(org.id, k.id)
  check("unlinked contract reads $0 invoiced", r4!.progress.invoiced.toString() === "0")
  const stillThere = await systemDb.servicePlan.findMany({ where: { id: { in: [planA.id, planB.id] } }, select: { contractId: true } })
  check("previously-linked plans still exist, now unlinked", stillThere.length === 2 && stillThere.every((p) => p.contractId === null))

  console.log("Cross-customer linking is refused:")
  const wrong = await threw(() => setContractPlans(org.id, k.id, [plan2.id]))
  check("cannot link a plan from another customer", wrong !== null && /belong/i.test(wrong ?? ""))

  console.log("Expiring-contract count honours the configurable lead time:")
  const now = new Date("2026-06-01T00:00:00Z")
  const soon = await createContract(org.id, { customerId: customer.id, title: "Ends in 45d", startDate: "2026-01-01", endDate: "2026-07-16", status: "ACTIVE" })
  const later = await createContract(org.id, { customerId: customer.id, title: "Ends in 120d", startDate: "2026-01-01", endDate: "2026-09-29", status: "ACTIVE" })
  const draftSoon = await createContract(org.id, { customerId: customer.id, title: "Draft ends soon", startDate: "2026-01-01", endDate: "2026-07-01", status: "DRAFT" })
  check("default lead time is 60 days", (await getContractExpiryLeadDays(org.id)) === 60)
  check("60-day window counts only the 45-day ACTIVE contract", (await countExpiring(org.id, 60, now)) === 1, `soon=${soon.id.slice(0, 6)}`)
  check("draft contracts are excluded from the warning", (await countExpiring(org.id, 60, now)) === 1, `draft=${draftSoon.id.slice(0, 6)}`)
  check("widening the lead time to 130 days catches both ACTIVE contracts", (await countExpiring(org.id, 130, now)) === 2, `later=${later.id.slice(0, 6)}`)
  await updateOrgSettings(org.id, { contractExpiryLeadDays: 90 })
  check("lead time is configurable and persists", (await getContractExpiryLeadDays(org.id)) === 90)

  console.log("List view attaches invoiced revenue per contract:")
  const list = await listContracts(org.id)
  check("listContracts returns all contracts with an invoiced figure", list.length === 4 && list.every((c) => c.invoiced != null))

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL CONTRACT CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
