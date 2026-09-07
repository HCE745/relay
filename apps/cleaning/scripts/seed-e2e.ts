// E2E-only fixture: a job scheduled TODAY, assigned to the seeded cleaner, with
// a required item + a photo-required item. Runs after the normal seed in the
// Playwright harness only — it does NOT touch the shared verify seed.

import { systemDb, orgDb } from "../src/lib/org-db"
import { createCustomer } from "../src/lib/data/customers"
import { createServiceLocation } from "../src/lib/data/service-locations"
import { createChecklistTemplate } from "../src/lib/data/checklist-templates"
import { createManualJob, getJob } from "../src/lib/data/jobs"
import { assignCleaner } from "../src/lib/data/assignments"
import { clockIn, toggleChecklistItem, clockOut } from "../src/lib/scheduling/execution"
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

  // A SEPARATE, already-COMPLETED job (distinct cleaner "Dana") for Phase 4
  // inspection + time-approval tests — self-contained, no dependency on the
  // Phase 3 flow above.
  const dana = await orgDb(sparkle.id).user.create({
    data: { organizationId: sparkle.id, email: "dana@sparkle.test", name: "Dana Cleaner", password: "x", role: "CLEANER" },
  })
  const simple = await createChecklistTemplate(sparkle.id, {
    name: "Field checklist (simple)",
    items: [{ label: "Wipe surfaces", isRequired: true, requirePhoto: false }],
  })
  const inspectCustomer = await createCustomer(sparkle.id, { name: "Inspect Co" })
  const inspectSite = await createServiceLocation(sparkle.id, { customerId: inspectCustomer.id, name: "Inspect Site" })
  const doneJob = await createManualJob(sparkle.id, {
    serviceLocationId: inspectSite.id,
    title: "Inspection demo job",
    date,
    startTime: "08:00",
    checklistTemplateId: simple.id,
  })
  await assignCleaner(sparkle.id, doneJob.id, dana.id)
  await clockIn(sparkle.id, doneJob.id, dana.id, {})
  const item = (await getJob(sparkle.id, doneJob.id))!.checklistItems[0]
  await toggleChecklistItem(sparkle.id, doneJob.id, item.id, dana.id, { isComplete: true })
  await clockOut(sparkle.id, doneJob.id, dana.id, {})
  // Backdate clock-in so the entry has a realistic (2h) duration for the
  // correction/approval E2E (seed completes it in milliseconds otherwise).
  const te = (await getJob(sparkle.id, doneJob.id))!.timeEntries[0]
  await orgDb(sparkle.id).timeEntry.updateMany({
    where: { id: te.id },
    data: { clockInAt: new Date(te.clockOutAt!.getTime() - 2 * 3600_000) },
  })

  console.log(`E2E fixture ready — field job ${job.id} (${cleaner.email}); completed job ${doneJob.id} (${dana.email})`)
}

main()
  .then(() => systemDb.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await systemDb.$disconnect()
    process.exit(1)
  })
