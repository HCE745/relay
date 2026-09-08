// Dedicated sales-demo tenant: a realistic commercial cleaning company built via
// the real application services, hitting every state a demo needs. Deterministic
// (fixed identities) and idempotent-ish: it wipes and recreates the demo org.
//
// Run: DATABASE_URL=... tsx scripts/seed-demo.ts

import bcrypt from "bcryptjs"
import { DateTime } from "luxon"
import { systemDb, orgDb } from "../src/lib/org-db"
import { createCustomer } from "../src/lib/data/customers"
import { createServiceLocation } from "../src/lib/data/service-locations"
import { createChecklistTemplate } from "../src/lib/data/checklist-templates"
import { createInspectionTemplate } from "../src/lib/data/inspection-templates"
import { createManualJob, getJob } from "../src/lib/data/jobs"
import { assignCleaner } from "../src/lib/data/assignments"
import { clockIn, clockOut, toggleChecklistItem } from "../src/lib/scheduling/execution"
import { uploadJobPhoto } from "../src/lib/data/photos"
import { reportProblem } from "../src/lib/data/issues"
import { createInspectionFromJob, setInspectionItemResult, finalizeInspection } from "../src/lib/scheduling/inspections"
import { approveTimeEntry } from "../src/lib/data/time-entries"

const TZ = "America/New_York"
const SLUG = "summit-facility-services"
const IMG = { data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), contentType: "image/jpeg", sizeBytes: 4 }

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10)

  // Fresh start for repeatable demos.
  const prior = await systemDb.organization.findUnique({ where: { slug: SLUG } })
  if (prior) await systemDb.organization.delete({ where: { id: prior.id } })

  const org = await systemDb.organization.create({
    data: { name: "Summit Facility Services", slug: SLUG, packageTier: "TEAM", subscriptionStatus: "active", onboardingCompletedAt: new Date(), timezone: TZ },
  })
  const db = orgDb(org.id)

  const mkUser = (email: string, name: string, role: string, code?: string) =>
    db.user.create({
      data: {
        organizationId: org.id,
        email,
        name,
        role: role as never,
        password: passwordHash,
        employeeProfile: { create: { organizationId: org.id, employeeCode: code, payType: "HOURLY", payRate: "18.50" } },
      },
    })

  await mkUser("owner@summitfs.com", "Dana Reyes", "OWNER", "E-0001")
  await mkUser("admin@summitfs.com", "Priya Shah", "ADMIN", "E-0002")
  const manager = await mkUser("manager@summitfs.com", "Marcus Lee", "MANAGER", "E-0003")
  await mkUser("sup1@summitfs.com", "Nina Alvarez", "SUPERVISOR", "E-0010")
  await mkUser("sup2@summitfs.com", "Tom Becker", "SUPERVISOR", "E-0011")

  const cleanerNames = ["Ava Johnson", "Liam Smith", "Sofia Garcia", "Noah Brown", "Mia Davis", "Ethan Wilson", "Isabella Martinez", "Lucas Anderson", "Emma Thomas", "Oliver Taylor", "Amelia Moore", "James White"]
  const cleaners: { id: string }[] = []
  for (let i = 0; i < cleanerNames.length; i++) {
    cleaners.push(await mkUser(`cleaner${i + 1}@summitfs.com`, cleanerNames[i], "CLEANER", `E-${1000 + i}`))
  }

  // Customers, sites, scopes.
  const nightly = await createChecklistTemplate(org.id, {
    name: "Standard nightly office clean",
    items: [
      { label: "Empty all trash & replace liners", isRequired: true, requirePhoto: false },
      { label: "Vacuum all carpeted areas", isRequired: true, requirePhoto: false },
      { label: "Clean & sanitize restrooms", isRequired: true, requirePhoto: true },
      { label: "Wipe & disinfect break room surfaces", isRequired: true, requirePhoto: false },
      { label: "Spot-clean glass doors", isRequired: false, requirePhoto: false },
    ],
  })
  const medical = await createChecklistTemplate(org.id, {
    name: "Medical office (disinfection)",
    items: [
      { label: "Disinfect all exam-room surfaces", isRequired: true, requirePhoto: true },
      { label: "Empty biohazard-adjacent bins", isRequired: true, requirePhoto: false },
      { label: "Mop hard floors with disinfectant", isRequired: true, requirePhoto: false },
      { label: "Restock restroom & sanitizer stations", isRequired: true, requirePhoto: false },
    ],
  })

  const inspectionTpl = await createInspectionTemplate(org.id, {
    name: "Standard Site Inspection",
    passThreshold: 80,
    items: [
      { label: "Floors clean and dry", points: 2 },
      { label: "Restrooms stocked and sanitized", points: 3, isCritical: true },
      { label: "Trash emptied", points: 1 },
      { label: "Surfaces dusted", points: 1 },
      { label: "Entry/glass presentable", points: 1 },
    ],
  })

  const customers = [
    { name: "Riverside Corporate Center", sites: ["Tower A — Floors 1-4", "Tower B — Lobby & Common"], scope: nightly },
    { name: "Lakewood Medical Group", sites: ["Main Clinic", "Imaging Annex"], scope: medical },
    { name: "Northgate Retail Plaza", sites: ["Center Court", "West Wing"], scope: nightly },
    { name: "Maplewood School District", sites: ["Admin Building"], scope: nightly },
  ]
  const sites: { id: string; scope: string }[] = []
  for (const c of customers) {
    const cust = await createCustomer(org.id, { name: c.name, primaryContactName: "Facilities Manager", email: `facilities@${c.name.split(" ")[0].toLowerCase()}.example` })
    for (const s of c.sites) {
      const site = await createServiceLocation(org.id, { customerId: cust.id, name: s, city: "Detroit", state: "MI", addressLine1: "100 Commerce Dr" })
      sites.push({ id: site.id, scope: c.scope.id })
    }
  }

  const today = DateTime.now().setZone(TZ).toFormat("yyyy-MM-dd")
  const mkJob = (siteIdx: number, title: string, time: string, crewSize?: number) =>
    createManualJob(org.id, { serviceLocationId: sites[siteIdx].id, title, date: today, startTime: time, checklistTemplateId: sites[siteIdx].scope, crewSize })

  // ── Today's board: a mix of states ───────────────────────────────────────────
  // Unassigned
  await mkJob(2, "Evening clean", "18:00")
  // Understaffed (needs 3, gets 1)
  const understaffed = await mkJob(0, "Deep clean — Tower A", "17:00", 3)
  await assignCleaner(org.id, understaffed.id, cleaners[0].id)
  // In progress (assigned + clocked in, left open)
  const inProgress = await mkJob(1, "Lobby refresh", "16:00")
  await assignCleaner(org.id, inProgress.id, cleaners[1].id)
  await clockIn(org.id, inProgress.id, cleaners[1].id, { lat: 42.331, lng: -83.045, source: "web" })
  // Assigned & upcoming
  const upcoming = await mkJob(5, "Nightly clean", "20:00")
  await assignCleaner(org.id, upcoming.id, cleaners[2].id)

  // Completed jobs with proof photos + time entries
  async function completeJob(siteIdx: number, title: string, time: string, cleanerIdx: number) {
    const job = await mkJob(siteIdx, title, time)
    await assignCleaner(org.id, job.id, cleaners[cleanerIdx].id)
    await clockIn(org.id, job.id, cleaners[cleanerIdx].id, { lat: 42.33, lng: -83.04, source: "web" })
    const items = (await getJob(org.id, job.id))!.checklistItems
    for (const it of items) {
      await toggleChecklistItem(org.id, job.id, it.id, cleaners[cleanerIdx].id, { isComplete: true })
      if (it.requirePhoto) await uploadJobPhoto(org.id, job.id, cleaners[cleanerIdx].id, { ...IMG, jobChecklistItemId: it.id })
    }
    await clockOut(org.id, job.id, cleaners[cleanerIdx].id, { lat: 42.33, lng: -83.04, source: "web" })
    // Realistic duration for time review.
    const te = (await getJob(org.id, job.id))!.timeEntries[0]
    await db.timeEntry.updateMany({ where: { id: te.id }, data: { clockInAt: new Date(te.clockOutAt!.getTime() - 2.5 * 3600_000) } })
    return { job, entryId: te.id }
  }

  const done1 = await completeJob(3, "Nightly clean — Admin", "19:00", 3)
  const done2 = await completeJob(4, "Center court clean", "18:30", 4)
  const done3 = await completeJob(0, "Tower A nightly", "20:00", 5)

  // Passing inspection on done1
  {
    const insp = await createInspectionFromJob(org.id, done1.job.id, manager.id, inspectionTpl.id)
    for (const r of insp.results) await setInspectionItemResult(org.id, insp.id, r.id, { result: "PASS" })
    await finalizeInspection(org.id, insp.id, manager.id, "Looks great.")
  }
  // Failing inspection on done2 (fails the critical restroom item) → creates an Issue
  {
    const insp = await createInspectionFromJob(org.id, done2.job.id, manager.id, inspectionTpl.id)
    for (const r of insp.results) {
      await setInspectionItemResult(org.id, insp.id, r.id, { result: r.label.includes("Restrooms") ? "FAIL" : "PASS", note: r.label.includes("Restrooms") ? "Out of paper towels; sink not wiped." : undefined })
    }
    await finalizeInspection(org.id, insp.id, manager.id, "Restrooms need re-service.")
  }

  // One open cleaner-reported problem
  await reportProblem(org.id, inProgress.id, cleaners[1].id, {
    category: "EQUIPMENT",
    description: "Vacuum belt snapped on Floor 2 — need a replacement to finish carpets.",
  })

  // Time: approve some, leave some pending
  await approveTimeEntry(org.id, done1.entryId, manager.id)
  await approveTimeEntry(org.id, done3.entryId, manager.id)
  // done2 left pending on purpose.

  console.log(`Demo tenant ready: ${org.name} (${SLUG})`)
  console.log(`  Sign in: owner@summitfs.com / manager@summitfs.com / cleaner1@summitfs.com — password: demo1234`)
}

main()
  .then(() => systemDb.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await systemDb.$disconnect()
    process.exit(1)
  })
