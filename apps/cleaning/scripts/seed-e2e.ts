// E2E-only fixture: a job scheduled TODAY, assigned to the seeded cleaner, with
// a required item + a photo-required item. Runs after the normal seed in the
// Playwright harness only — it does NOT touch the shared verify seed.

import { systemDb } from "../src/lib/org-db"
import { createCustomer } from "../src/lib/data/customers"
import { createServiceLocation } from "../src/lib/data/service-locations"
import { createChecklistTemplate } from "../src/lib/data/checklist-templates"
import { createManualJob } from "../src/lib/data/jobs"
import { assignCleaner } from "../src/lib/data/assignments"
import { DateTime } from "luxon"

async function main() {
  const sparkle = await systemDb.organization.findUniqueOrThrow({ where: { slug: "sparkle-co" } })
  const cleaner = await systemDb.user.findUniqueOrThrow({ where: { email: "cleaner@sparkle.test" } })

  const customer = await createCustomer(sparkle.id, { name: "Field Demo Co" })
  const site = await createServiceLocation(sparkle.id, {
    customerId: customer.id,
    name: "Field Demo Site",
    addressLine1: "123 Main St",
    city: "Detroit",
    state: "MI",
  })
  const tpl = await createChecklistTemplate(sparkle.id, {
    name: "Field checklist",
    items: [
      { label: "Empty all trash", isRequired: true, requirePhoto: false },
      { label: "Photo of lobby", isRequired: true, requirePhoto: true },
    ],
  })

  const date = DateTime.now().setZone(sparkle.timezone).toFormat("yyyy-MM-dd")
  const job = await createManualJob(sparkle.id, {
    serviceLocationId: site.id,
    title: "Field demo job",
    date,
    startTime: "10:00",
    checklistTemplateId: tpl.id,
  })
  await assignCleaner(sparkle.id, job.id, cleaner.id)

  console.log(`E2E fixture ready — job ${job.id} assigned to ${cleaner.email} on ${date}`)
}

main()
  .then(() => systemDb.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await systemDb.$disconnect()
    process.exit(1)
  })
