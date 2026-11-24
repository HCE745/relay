import { orgDb, systemDb } from "../org-db"
import { assertFound, ConflictError } from "../data/errors"
import { recordAudit } from "../data/audit"
import { notifyUser, notifyManagers } from "../notify"
import { INSPECTOR_ROLES } from "../rbac"
import { createInspectionForSite } from "./inspections"

// Recurring / scheduled inspections (Phase 46). A schedule materializes DRAFT
// inspections at a site on a cadence and reminds the inspector ahead of each
// run. The inspector may be fixed or drawn at random from an eligible pool.

export type Cadence = "ONCE" | "WEEKLY" | "BIWEEKLY" | "MONTHLY"

export type ScheduleInput = {
  serviceLocationId: string
  templateId: string
  cadence: Cadence
  firstRunAt: Date
  reminderLeadHours?: number
  randomizeInspector?: boolean
  inspectorPoolIds?: string[]
  assignedInspectorId?: string | null
}

const DAY = 86_400_000

/** Next run after `from` for a cadence, or null for a one-off. */
export function advanceRun(from: Date, cadence: Cadence): Date | null {
  if (cadence === "ONCE") return null
  const d = new Date(from)
  if (cadence === "WEEKLY") d.setUTCDate(d.getUTCDate() + 7)
  else if (cadence === "BIWEEKLY") d.setUTCDate(d.getUTCDate() + 14)
  else if (cadence === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

// Upcoming scheduled inspections whose next run falls in a window — calendar
// events for the unified schedule. Includes the fixed inspector (if any).
export function listScheduledInspectionsInWindow(orgId: string, start: Date, end: Date) {
  return orgDb(orgId).scheduledInspection.findMany({
    where: { active: true, nextRunAt: { gte: start, lte: end } },
    orderBy: { nextRunAt: "asc" },
    include: {
      serviceLocation: { select: { id: true, name: true, customerId: true, timezone: true, customer: { select: { name: true } } } },
      template: { select: { name: true } },
    },
  })
}

export function listScheduledInspections(orgId: string) {
  return orgDb(orgId).scheduledInspection.findMany({
    orderBy: [{ active: "desc" }, { nextRunAt: "asc" }],
    include: {
      serviceLocation: { select: { name: true, customer: { select: { name: true } } } },
      template: { select: { name: true } },
    },
  })
}

export async function createScheduledInspection(orgId: string, actorId: string, input: ScheduleInput) {
  const db = orgDb(orgId)
  const [site, template] = await Promise.all([
    db.serviceLocation.findFirst({ where: { id: input.serviceLocationId }, select: { id: true } }),
    db.inspectionTemplate.findFirst({ where: { id: input.templateId }, select: { id: true, isActive: true } }),
  ])
  assertFound(site, "Service location")
  assertFound(template, "Inspection template")
  if (input.randomizeInspector && (!input.inspectorPoolIds || input.inspectorPoolIds.length === 0)) {
    throw new ConflictError("Add at least one inspector to the random pool")
  }
  const row = await db.scheduledInspection.create({
    data: {
      organizationId: orgId,
      serviceLocationId: input.serviceLocationId,
      templateId: input.templateId,
      cadence: input.cadence,
      nextRunAt: input.firstRunAt,
      reminderLeadHours: input.reminderLeadHours ?? 24,
      randomizeInspector: input.randomizeInspector ?? false,
      inspectorPoolIds: input.inspectorPoolIds ?? [],
      assignedInspectorId: input.randomizeInspector ? null : input.assignedInspectorId ?? null,
      createdById: actorId,
    },
  })
  await recordAudit(orgId, actorId, "ScheduledInspection", row.id, "create", { metadata: { cadence: input.cadence } })
  return row
}

export async function setScheduledInspectionActive(orgId: string, actorId: string, id: string, active: boolean) {
  const { count } = await orgDb(orgId).scheduledInspection.updateMany({ where: { id }, data: { active } })
  if (count === 0) return null
  await recordAudit(orgId, actorId, "ScheduledInspection", id, active ? "resume" : "pause", {})
  return true
}

export async function deleteScheduledInspection(orgId: string, actorId: string, id: string) {
  const { count } = await orgDb(orgId).scheduledInspection.deleteMany({ where: { id } })
  if (count === 0) return null
  await recordAudit(orgId, actorId, "ScheduledInspection", id, "delete", {})
  return true
}

/** Pick an inspector for a run: a random eligible pool member, or the fixed one. */
async function resolveInspector(orgId: string, s: { randomizeInspector: boolean; inspectorPoolIds: string[]; assignedInspectorId: string | null }): Promise<string | null> {
  if (s.randomizeInspector && s.inspectorPoolIds.length) {
    // Only draw from pool members who are still active eligible inspectors.
    const eligible = await systemDb.user.findMany({
      where: { organizationId: orgId, id: { in: s.inspectorPoolIds }, isActive: true, role: { in: [...INSPECTOR_ROLES] } },
      select: { id: true },
    })
    if (eligible.length) return eligible[Math.floor(Math.random() * eligible.length)].id
  }
  if (s.assignedInspectorId) return s.assignedInspectorId
  // Fallback: any eligible inspector in the org (keeps a schedule from stalling).
  const any = await systemDb.user.findFirst({
    where: { organizationId: orgId, isActive: true, role: { in: [...INSPECTOR_ROLES] } },
    select: { id: true },
  })
  return any?.id ?? null
}

/**
 * Materialize every schedule whose nextRunAt is due: create a DRAFT inspection
 * and advance (or deactivate one-offs). Idempotent per run — nextRunAt only
 * moves forward after the inspection is created.
 */
export async function materializeDueInspections(orgId: string, now = new Date()): Promise<number> {
  const db = orgDb(orgId)
  const due = await db.scheduledInspection.findMany({ where: { active: true, nextRunAt: { lte: now } } })
  let created = 0
  for (const s of due) {
    const inspectorId = await resolveInspector(orgId, s)
    if (!inspectorId) continue // no eligible inspector — leave it due, retry next run
    try {
      await createInspectionForSite(orgId, s.serviceLocationId, inspectorId, s.templateId)
    } catch {
      continue // template emptied / site gone — skip without advancing
    }
    created++
    const next = advanceRun(s.nextRunAt, s.cadence)
    await db.scheduledInspection.updateMany({
      where: { id: s.id },
      data: next ? { lastRunAt: now, nextRunAt: next, reminderSentForRunAt: null } : { lastRunAt: now, active: false },
    })
  }
  return created
}

/** Send one reminder per schedule run when within its lead window. */
export async function runScheduledInspectionReminders(orgId: string, now = new Date()): Promise<number> {
  const db = orgDb(orgId)
  const upcoming = await db.scheduledInspection.findMany({ where: { active: true, nextRunAt: { gt: now } } })
  let sent = 0
  for (const s of upcoming) {
    const windowStart = new Date(s.nextRunAt.getTime() - s.reminderLeadHours * 3600_000)
    if (now < windowStart) continue
    if (s.reminderSentForRunAt && s.reminderSentForRunAt.getTime() === s.nextRunAt.getTime()) continue
    const site = await db.serviceLocation.findFirst({
      where: { id: s.serviceLocationId },
      select: { name: true, customer: { select: { name: true } } },
    })
    const where = site ? `${site.customer.name} · ${site.name}` : "a site"
    const when = s.nextRunAt.toISOString().slice(0, 10)
    const subject = "Upcoming inspection"
    const text = `An inspection is scheduled at ${where} on ${when}. Open Inspections to run it.`
    if (!s.randomizeInspector && s.assignedInspectorId) await notifyUser(orgId, s.assignedInspectorId, subject, text)
    else await notifyManagers(orgId, subject, `${text} (inspector assigned at run time)`)
    await db.scheduledInspection.updateMany({ where: { id: s.id }, data: { reminderSentForRunAt: s.nextRunAt } })
    sent++
  }
  return sent
}

/** Days until the next run — small helper for the UI. */
export function daysUntil(date: Date, now = new Date()): number {
  return Math.round((date.getTime() - now.getTime()) / DAY)
}
