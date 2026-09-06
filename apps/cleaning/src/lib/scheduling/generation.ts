import { orgDb, systemDb, isUniqueViolation } from "../org-db"
import { assertFound } from "../data/errors"
import { generateOccurrences, type Frequency, type PlanRecurrence } from "./recurrence"

// Deliberate, idempotent, concurrency-safe Job generation from ServicePlans.
//
// Idempotency is enforced at TWO levels: (1) the DB unique constraint
// (servicePlanId, scheduledStart), which is the source of truth, and (2) this
// service catching the resulting P2002 and counting it as "skipped". Two
// concurrent runs therefore converge without duplicates or crashes.

export type GenerationResult = {
  planId: string
  planActive: boolean
  total: number
  created: number
  skipped: number
}

async function effectiveTimezone(orgId: string, siteTimezone: string | null): Promise<string> {
  if (siteTimezone) return siteTimezone
  const org = await systemDb.organization.findUnique({ where: { id: orgId }, select: { timezone: true } })
  return org?.timezone ?? "America/New_York"
}

export async function generateJobsForServicePlan(
  orgId: string,
  servicePlanId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<GenerationResult> {
  const db = orgDb(orgId)
  const plan = await db.servicePlan.findFirst({
    where: { id: servicePlanId },
    include: {
      serviceLocation: { select: { id: true, timezone: true } },
      checklistTemplate: { include: { items: { orderBy: { sortOrder: "asc" } } } },
    },
  })
  assertFound(plan, "Service plan")
  // Inactive plans never generate work.
  if (!plan!.isActive) return { planId: servicePlanId, planActive: false, total: 0, created: 0, skipped: 0 }

  const tz = await effectiveTimezone(orgId, plan!.serviceLocation.timezone)
  const rec: PlanRecurrence = {
    frequency: plan!.frequency as Frequency,
    startDate: plan!.startDate ?? plan!.createdAt,
    startTime: plan!.startTime,
    rrule: plan!.rrule,
    endDate: plan!.endDate,
    timezone: tz,
  }
  const occurrences = generateOccurrences(rec, windowStart, windowEnd)

  // Snapshot the plan's CURRENT checklist template into each Job. Copied by
  // value, so later template edits never touch already-generated Jobs.
  const snapshot = (plan!.checklistTemplate?.items ?? []).map((it) => ({
    label: it.label,
    instructions: it.instructions,
    isRequired: it.isRequired,
    requirePhoto: it.requirePhoto,
    sortOrder: it.sortOrder,
  }))
  const durationMs = plan!.defaultDurationMin ? plan!.defaultDurationMin * 60_000 : null

  let created = 0
  let skipped = 0
  for (const start of occurrences) {
    try {
      await db.job.create({
        data: {
          organizationId: orgId,
          serviceLocationId: plan!.serviceLocation.id,
          servicePlanId: plan!.id,
          title: plan!.name,
          status: "SCHEDULED",
          scheduledStart: start,
          scheduledEnd: durationMs ? new Date(start.getTime() + durationMs) : null,
          crewSize: plan!.crewSize,
          checklistItems: snapshot.length ? { create: snapshot } : undefined,
        },
      })
      created++
    } catch (e) {
      if (isUniqueViolation(e)) skipped++
      else throw e
    }
  }

  return { planId: plan!.id, planActive: true, total: occurrences.length, created, skipped }
}

/**
 * Roll the schedule forward for every active plan in an org over the next
 * `days` days. This is the function a future Vercel cron would call; it is NOT
 * wired to any cron yet (see report).
 */
export async function generateUpcomingForOrg(
  orgId: string,
  days: number,
  now: Date = new Date(),
): Promise<{ plans: number; created: number; skipped: number }> {
  const end = new Date(now.getTime() + days * 86_400_000)
  const plans = await orgDb(orgId).servicePlan.findMany({ where: { isActive: true }, select: { id: true } })
  let created = 0
  let skipped = 0
  for (const p of plans) {
    const r = await generateJobsForServicePlan(orgId, p.id, now, end)
    created += r.created
    skipped += r.skipped
  }
  return { plans: plans.length, created, skipped }
}
