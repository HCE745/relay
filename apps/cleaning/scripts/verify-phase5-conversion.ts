// Phase 5 conversion integration verification against a live database.
// The estimate→customer conversion is the point of the phase, so this tests
// BOTH the happy path AND the failure path: a mid-conversion failure must roll
// back completely, never leaving an orphaned customer with no site/plan.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase5-conversion.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { createLead } from "../src/lib/data/leads"
import { createEstimate, setEstimateStatus, convertEstimate, updateEstimate } from "../src/lib/data/estimates"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
async function threw(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (e) {
    return (e as Error).message
  }
}
const counts = (orgId: string) =>
  Promise.all([
    systemDb.customer.count({ where: { organizationId: orgId } }),
    systemDb.serviceLocation.count({ where: { organizationId: orgId } }),
    systemDb.servicePlan.count({ where: { organizationId: orgId } }),
  ])

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "CRM Test", slug: `crm-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const tpl = await systemDb.checklistTemplate.create({ data: { organizationId: org.id, name: "Nightly scope" } })

  console.log("Happy path — PER_VISIT lead estimate → Customer + Site + Plan (atomic):")
  const lead = await createLead(org.id, { name: "Dana Buyer", company: "Acme Offices", email: "dana@acme.test" })
  const est = await createEstimate(org.id, {
    leadId: lead.id,
    title: "Nightly janitorial — Acme HQ",
    contactName: "Dana Buyer",
    contactEmail: "dana@acme.test",
    siteName: "Acme HQ",
    addressLine1: "1 Market St",
    city: "Springfield",
    state: "IL",
    frequency: "WEEKLY",
    pricing: "PER_VISIT",
    checklistTemplateId: tpl.id,
    lines: [
      { description: "Nightly clean", quantity: "1", unitRate: "250" },
      { description: "Restroom restock", quantity: "1", unitRate: "50" },
    ],
  })
  check("estimate total = 300.00", est.total.toFixed(2) === "300.00", est.total.toString())
  await setEstimateStatus(org.id, est.id, "ACCEPTED")

  const [c0, s0, p0] = await counts(org.id)
  const r = await convertEstimate(org.id, est.id)
  const [c1, s1, p1] = await counts(org.id)
  check("created exactly one customer + site + plan", c1 - c0 === 1 && s1 - s0 === 1 && p1 - p0 === 1)

  const customer = await systemDb.customer.findUniqueOrThrow({ where: { id: r.customerId } })
  const plan = await systemDb.servicePlan.findUniqueOrThrow({ where: { id: r.servicePlanId } })
  check("customer named from lead company (Acme Offices)", customer.name === "Acme Offices")
  check("plan billingType FLAT_PER_JOB, rate 300.00 (per-visit total)", plan.billingType === "FLAT_PER_JOB" && plan.rate?.toFixed(2) === "300.00")
  check("plan carried frequency + scope template", plan.frequency === "WEEKLY" && plan.checklistTemplateId === tpl.id)
  check("plan sits under the created site", plan.serviceLocationId === r.serviceLocationId)

  const estAfter = await systemDb.estimate.findUniqueOrThrow({ where: { id: est.id } })
  check("estimate permanently linked to the customer it created", estAfter.convertedCustomerId === r.customerId && estAfter.convertedAt !== null)
  const leadAfter = await systemDb.lead.findUniqueOrThrow({ where: { id: lead.id } })
  check("source lead marked WON", leadAfter.status === "WON")
  check("re-converting is refused (idempotent)", (await threw(() => convertEstimate(org.id, est.id))) !== null)
  check("converted estimate is read-only", (await threw(() => updateEstimate(org.id, est.id, { title: "x" }))) !== null)

  console.log("HOURLY estimate → HOURLY plan, rate carried:")
  const estH = await createEstimate(org.id, { title: "Hourly crew", pricing: "HOURLY", rate: "40", frequency: "WEEKLY", lines: [{ description: "Labor", quantity: "3", unitRate: "40" }] })
  await setEstimateStatus(org.id, estH.id, "ACCEPTED")
  const rH = await convertEstimate(org.id, estH.id)
  const planH = await systemDb.servicePlan.findUniqueOrThrow({ where: { id: rH.servicePlanId } })
  check("plan billingType HOURLY, rate 40.00", planH.billingType === "HOURLY" && planH.rate?.toFixed(2) === "40.00")

  console.log("Pricing that can't map cleanly is refused, with no writes:")
  const estBad = await createEstimate(org.id, { title: "Hourly, no rate", pricing: "HOURLY", lines: [{ description: "Work", quantity: "2", unitRate: "35" }] })
  await setEstimateStatus(org.id, estBad.id, "ACCEPTED")
  const [cb0] = await counts(org.id)
  const badMsg = await threw(() => convertEstimate(org.id, estBad.id))
  const [cb1] = await counts(org.id)
  check("hourly-with-no-rate conversion refused (says so)", badMsg !== null && /hourly rate/i.test(badMsg ?? ""))
  check("no customer created for the refused estimate", cb1 - cb0 === 0)

  console.log("FAILURE PATH — a mid-conversion failure rolls back fully (no orphaned customer):")
  // An estimate whose checklist template belongs to ANOTHER org: pricing maps
  // fine, so the customer + site are created inside the transaction, then the
  // template validation fails → the whole transaction must roll back.
  const orgB = await systemDb.organization.create({ data: { name: "Other", slug: `other-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const tplB = await systemDb.checklistTemplate.create({ data: { organizationId: orgB.id, name: "Foreign scope" } })
  const estF = await systemDb.estimate.create({
    data: {
      organizationId: org.id,
      title: "Booby-trapped estimate",
      pricing: "PER_VISIT",
      frequency: "WEEKLY",
      status: "ACCEPTED",
      checklistTemplateId: tplB.id, // FK exists (cross-org), but invalid within this org
      subtotal: "100.00",
      total: "100.00",
      lines: { create: [{ description: "Clean", quantity: "1", unitRate: "100", amount: "100.00", sortOrder: 0 }] },
    },
  })
  const [cf0, sf0, pf0] = await counts(org.id)
  const failMsg = await threw(() => convertEstimate(org.id, estF.id))
  const [cf1, sf1, pf1] = await counts(org.id)
  check("conversion threw", failMsg !== null, failMsg ?? "")
  check("rolled back: NO customer/site/plan created (no orphan)", cf1 - cf0 === 0 && sf1 - sf0 === 0 && pf1 - pf0 === 0)
  const estFAfter = await systemDb.estimate.findUniqueOrThrow({ where: { id: estF.id } })
  check("estimate NOT marked converted after failure", estFAfter.convertedCustomerId === null)

  await systemDb.organization.delete({ where: { id: org.id } })
  await systemDb.organization.delete({ where: { id: orgB.id } })
  console.log(`\n${failures === 0 ? "ALL CONVERSION CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
