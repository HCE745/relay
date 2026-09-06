// Phase 1 integration verification against a live database. Exercises the real
// data layer end-to-end (the same functions the API routes call) and proves
// tenant isolation on both reads and writes.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase1.ts   (after migrate + seed)

import { systemDb, orgDb, OrgScopeError } from "../src/lib/org-db"
import { ReferenceError } from "../src/lib/data/errors"
import { createCustomer, getCustomer, updateCustomer } from "../src/lib/data/customers"
import { createContact } from "../src/lib/data/contacts"
import { createServiceLocation } from "../src/lib/data/service-locations"
import { createChecklistTemplate, updateChecklistTemplate } from "../src/lib/data/checklist-templates"
import { createServicePlan } from "../src/lib/data/service-plans"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
async function expectThrows(name: string, fn: () => Promise<unknown>, type: new (...a: never[]) => Error) {
  let thrown: unknown
  try {
    await fn()
  } catch (e) {
    thrown = e
  }
  check(name, thrown instanceof type, thrown ? (thrown as Error).name : "did not throw")
}

async function main() {
  const sparkle = await systemDb.organization.findUniqueOrThrow({ where: { slug: "sparkle-co" } })
  const rival = await systemDb.organization.findUniqueOrThrow({ where: { slug: "rival-cleaners" } })

  console.log("Workflow — Customer → Site → Scope → Service Plan (as Sparkle):")
  const customer = await createCustomer(sparkle.id, { name: "Acme Offices" })
  check("create customer", !!customer.id && customer.organizationId === sparkle.id)

  const contact = await createContact(sparkle.id, { customerId: customer.id, name: "Jane Doe", isPrimary: true })
  check("create contact under customer", contact.customerId === customer.id)

  const site = await createServiceLocation(sparkle.id, { customerId: customer.id, name: "HQ Tower", city: "Detroit" })
  check("create service location under customer", site.customerId === customer.id && site.organizationId === sparkle.id)

  const tpl = await createChecklistTemplate(sparkle.id, {
    name: "Nightly office clean",
    items: [{ label: "Empty trash", isRequired: true, requirePhoto: false }],
  })
  check("create checklist with items", tpl.items.length === 1 && tpl.version === 1)

  const plan = await createServicePlan(sparkle.id, {
    serviceLocationId: site.id,
    name: "Nightly janitorial",
    frequency: "WEEKLY",
    crewSize: 2,
    checklistTemplateId: tpl.id,
  })
  check("create service plan referencing site + checklist", !!plan.id)

  console.log("\nReopen + safe edits:")
  const reopened = await getCustomer(sparkle.id, customer.id)
  check("reopen customer shows its contact + site", reopened?.contacts.length === 1 && reopened?.serviceLocations.length === 1)

  const renamed = await updateCustomer(sparkle.id, customer.id, { name: "Acme Offices Inc" })
  check("edit customer name", renamed?.name === "Acme Offices Inc")

  const bumped = await updateChecklistTemplate(sparkle.id, tpl.id, {
    items: [{ label: "Empty trash", isRequired: true, requirePhoto: false }, { label: "Vacuum floors", isRequired: true, requirePhoto: false }],
  })
  check("edit checklist replaces items + bumps version", bumped?.version === 2 && bumped?.items.length === 2)

  console.log("\nTenant isolation — Rival must never touch Sparkle data:")
  check("Rival cannot READ Sparkle's customer", (await getCustomer(rival.id, customer.id)) === null)
  check("Rival cannot UPDATE Sparkle's customer", (await updateCustomer(rival.id, customer.id, { name: "hacked" })) === null)

  const stillThere = await getCustomer(sparkle.id, customer.id)
  check("Sparkle customer unchanged after cross-org write attempt", stillThere?.name === "Acme Offices Inc")

  check(
    "Rival's org-scoped client returns null for Sparkle id",
    (await orgDb(rival.id).customer.findFirst({ where: { id: customer.id } })) === null,
  )

  await expectThrows(
    "Rival cannot attach a Site to Sparkle's customer",
    () => createServiceLocation(rival.id, { customerId: customer.id, name: "evil" }),
    ReferenceError,
  )
  await expectThrows(
    "Rival cannot reference Sparkle's site/checklist in a plan",
    () => createServicePlan(rival.id, { serviceLocationId: site.id, name: "x", frequency: "WEEKLY", crewSize: 1, checklistTemplateId: tpl.id }),
    ReferenceError,
  )
  await expectThrows(
    "org-scoped client blocks unsafe by-id update()",
    () => orgDb(sparkle.id).customer.update({ where: { id: customer.id }, data: { name: "x" } }),
    OrgScopeError,
  )
  await expectThrows(
    "org-scoped client blocks unsafe findUnique()",
    () => orgDb(sparkle.id).customer.findUnique({ where: { id: customer.id } }),
    OrgScopeError,
  )

  console.log(`\n${failures === 0 ? "ALL PHASE 1 CHECKS PASSED" : `${failures} PHASE 1 CHECK(S) FAILED`}`)
}

main()
  .then(async () => {
    await systemDb.$disconnect()
    process.exit(failures === 0 ? 0 : 1)
  })
  .catch(async (e) => {
    console.error(e)
    await systemDb.$disconnect()
    process.exit(1)
  })
