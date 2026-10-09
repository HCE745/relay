// REGRESSION for the reschedule-duplicate fix (Step 2.1). Same scenario as
// scripts/audit-reschedule-duplicate.ts, but now asserts the ghost does NOT
// appear: with plannedStart as the immutable occurrence identity, rescheduling
// a plan job (scheduledStart only) leaves the occurrence occupied, so a second
// generation run is a no-op for that day.
//
// Usage: DATABASE_URL=... tsx scripts/verify-reschedule-no-duplicate.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import { generateJobsForServicePlan } from "../src/lib/scheduling/generation"
import { updateJob } from "../src/lib/data/jobs"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "NoDup Co", slug: `nodup-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const customer = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: customer.id, name: "HQ", timezone: "UTC" } })
  const plan = await systemDb.servicePlan.create({
    data: { organizationId: org.id, serviceLocationId: site.id, name: "Daily clean", frequency: "DAILY", startTime: "09:00", startDate: new Date(), isActive: true, defaultDurationMin: 120 },
  })

  const now = new Date()
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const windowEnd = new Date(windowStart.getTime() + 7 * 86_400_000)

  const r1 = await generateJobsForServicePlan(org.id, plan.id, windowStart, windowEnd)
  const countAfterGen1 = await systemDb.job.count({ where: { servicePlanId: plan.id } })
  check("first run generated occurrences", r1.created > 0 && countAfterGen1 === r1.created, `created=${r1.created}`)

  const target = await systemDb.job.findFirstOrThrow({ where: { servicePlanId: plan.id }, orderBy: { scheduledStart: "asc" }, select: { id: true, scheduledStart: true, plannedStart: true } })
  const originalSlot = target.scheduledStart
  const dayISO = originalSlot.toISOString().slice(0, 10)
  check("generated job has plannedStart == scheduledStart", target.plannedStart?.getTime() === originalSlot.getTime())

  await updateJob(org.id, target.id, { date: dayISO, startTime: "14:00" })
  const moved = await systemDb.job.findUniqueOrThrow({ where: { id: target.id }, select: { scheduledStart: true, plannedStart: true } })
  check("reschedule moved scheduledStart", moved.scheduledStart.toISOString().endsWith("14:00:00.000Z"))
  check("reschedule did NOT move plannedStart (identity preserved)", moved.plannedStart?.getTime() === originalSlot.getTime())

  const countAfterMove = await systemDb.job.count({ where: { servicePlanId: plan.id } })
  const r2 = await generateJobsForServicePlan(org.id, plan.id, windowStart, windowEnd)
  const countAfterGen2 = await systemDb.job.count({ where: { servicePlanId: plan.id } })

  const ghost = await systemDb.job.findFirst({ where: { servicePlanId: plan.id, scheduledStart: originalSlot, id: { not: target.id } }, select: { id: true } })
  const jobsOnDay = await systemDb.job.count({ where: { servicePlanId: plan.id, scheduledStart: { gte: new Date(dayISO + "T00:00:00Z"), lt: new Date(dayISO + "T23:59:59Z") } } })

  check("NO ghost recreated at the original slot", ghost === null)
  check("second run created nothing (idempotent)", r2.created === 0 && countAfterGen2 === countAfterMove, `r2.created=${r2.created}, before=${countAfterMove}, after=${countAfterGen2}`)
  check("the rescheduled day has exactly ONE job", jobsOnDay === 1, `jobs on ${dayISO}=${jobsOnDay}`)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "FIX VERIFIED — no duplication" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
