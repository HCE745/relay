// AUDIT (read-only, no fix): reproduce the reschedule-duplicate bug.
//
// A plan-generated Job is unique on (servicePlanId, scheduledStart) and the
// generator skips on that key. Rescheduling a plan job MOVES its scheduledStart
// (src/lib/data/jobs.ts:121 updateJob) without recording an exception, so the
// original slot is vacated — and the next generation run re-creates a GHOST job
// there. This script proves it end-to-end.
//
// Usage: DATABASE_URL=... tsx scripts/audit-reschedule-duplicate.ts  (after migrate)

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
  // UTC org so wall-clock == instant and the reproduction is deterministic.
  const org = await systemDb.organization.create({ data: { name: "Dup Co", slug: `dup-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })
  const customer = await systemDb.customer.create({ data: { organizationId: org.id, name: "Acme" } })
  const site = await systemDb.serviceLocation.create({ data: { organizationId: org.id, customerId: customer.id, name: "HQ", timezone: "UTC" } })
  const plan = await systemDb.servicePlan.create({
    data: { organizationId: org.id, serviceLocationId: site.id, name: "Daily clean", frequency: "DAILY", startTime: "09:00", startDate: new Date(), isActive: true, defaultDurationMin: 120 },
  })

  // 7-day window from midnight today (UTC) so day boundaries are clean.
  const now = new Date()
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const windowEnd = new Date(windowStart.getTime() + 7 * 86_400_000)

  console.log("1. First generation run:")
  const r1 = await generateJobsForServicePlan(org.id, plan.id, windowStart, windowEnd)
  const countAfterGen1 = await systemDb.job.count({ where: { servicePlanId: plan.id } })
  check("generated the daily occurrences", r1.created > 0 && countAfterGen1 === r1.created, `created=${r1.created}, jobs=${countAfterGen1}`)

  // Grab the earliest generated job and its original slot.
  const target = await systemDb.job.findFirstOrThrow({ where: { servicePlanId: plan.id }, orderBy: { scheduledStart: "asc" }, select: { id: true, scheduledStart: true } })
  const originalSlot = target.scheduledStart
  const dayISO = originalSlot.toISOString().slice(0, 10)

  console.log(`\n2. Reschedule that job within the same day (09:00 → 14:00) via updateJob:`)
  await updateJob(org.id, target.id, { date: dayISO, startTime: "14:00" })
  const moved = await systemDb.job.findUniqueOrThrow({ where: { id: target.id }, select: { scheduledStart: true } })
  check("the job moved off its original slot", moved.scheduledStart.getTime() !== originalSlot.getTime(), `now ${moved.scheduledStart.toISOString()}`)
  const occupantAtOriginal = await systemDb.job.count({ where: { servicePlanId: plan.id, scheduledStart: originalSlot } })
  check("original 09:00 slot is now vacant", occupantAtOriginal === 0)
  const countAfterMove = await systemDb.job.count({ where: { servicePlanId: plan.id } })

  console.log(`\n3. Second generation run (same window) — the cron's daily behavior:`)
  const r2 = await generateJobsForServicePlan(org.id, plan.id, windowStart, windowEnd)
  const countAfterGen2 = await systemDb.job.count({ where: { servicePlanId: plan.id } })

  console.log(`\n   RESULT:`)
  const ghost = await systemDb.job.findFirst({ where: { servicePlanId: plan.id, scheduledStart: originalSlot }, select: { id: true } })
  const jobsOnDay = await systemDb.job.count({ where: { servicePlanId: plan.id, scheduledStart: { gte: new Date(dayISO + "T00:00:00Z"), lt: new Date(dayISO + "T23:59:59Z") } } })

  check("regeneration RE-CREATED a ghost at the original 09:00 slot", !!ghost, ghost ? `ghost id=${ghost.id}` : "no ghost")
  check("total jobs increased by exactly 1 (the ghost)", countAfterGen2 === countAfterMove + 1, `before=${countAfterMove}, after=${countAfterGen2}, r2.created=${r2.created}`)
  check("that day now has TWO jobs where there should be one (09:00 ghost + 14:00 moved)", jobsOnDay === 2, `jobs on ${dayISO}=${jobsOnDay}`)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "BUG REPRODUCED — all assertions held" : `${failures} assertion(s) did NOT hold (bug may differ)`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
