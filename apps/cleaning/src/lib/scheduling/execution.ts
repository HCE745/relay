import { orgDb, systemDb } from "../org-db"
import { assertFound, ForbiddenActionError, ConflictError, RequirementsError } from "../data/errors"
import { sendServiceSummarySafe } from "../data/customer-comms"
import { recomputeJobEarnings } from "../data/commission"
import { resolveCapabilities, parseOverrides, type PackageTier } from "../entitlements"

// Geofencing capability check without the server-only page-guards import.
async function orgHasGeofencing(orgId: string): Promise<boolean> {
  const org = await systemDb.organization.findUnique({ where: { id: orgId }, select: { packageTier: true, capabilityOverrides: true } })
  if (!org) return false
  return resolveCapabilities({ packageTier: org.packageTier as PackageTier, capabilityOverrides: parseOverrides(org.capabilityOverrides) }).has("workforce.geofencing")
}

// Great-circle distance in meters (geofence check).
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
import type { ClockInput } from "../zod-schemas"

// ─── Field execution: clock in/out, checklist, completion ────────────────────
//
// Status model (V1, deterministic — documented here and in the report):
//
//   JobAssignment.status:  ASSIGNED → IN_PROGRESS (on clock-in) → COMPLETED (on
//     clock-out). ACKNOWLEDGED is unused in V1 (no field UX value); DECLINED
//     reserved. It tracks ONE cleaner.
//
//   TimeEntry.status:      OPEN (clocked in) → COMPLETED (clocked out). One OPEN
//     entry per (cleaner, job). A cleaner may hold only ONE open entry at a time
//     across all jobs.
//
//   Job.status:            represents the whole occurrence. SCHEDULED/ASSIGNED →
//     IN_PROGRESS when the FIRST cleaner clocks in (sets actualStart) → COMPLETED
//     only when NO cleaner has an open entry AND every assignment is COMPLETED
//     (sets actualEnd). One cleaner clocking out never completes a job while
//     another assigned cleaner is still working.
//
// Actor identity (userId) always comes from the session, never the client.

type Loc = ClockInput

function sourceFor(loc: Loc): string {
  return loc.lat != null && loc.lng != null ? (loc.source ?? "web") : "web_no_location"
}

async function assertAssigned(db: ReturnType<typeof orgDb>, jobId: string, userId: string) {
  const a = await db.jobAssignment.findFirst({ where: { jobId, userId }, select: { id: true } })
  if (!a) throw new ForbiddenActionError("You are not assigned to this job")
}

/** Labels of required work not yet satisfied (required items + required photos). */
export async function checklistRequirementsUnmet(orgId: string, jobId: string): Promise<string[]> {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({ where: { id: jobId }, select: { id: true } })
  if (!job) return ["Job not found"]

  const items = await db.jobChecklistItem.findMany({ where: { jobId }, orderBy: { sortOrder: "asc" } })
  const unmet: string[] = []
  for (const it of items) {
    if (it.isRequired && !it.isComplete) unmet.push(`Incomplete: ${it.label}`)
  }
  const photoItems = items.filter((it) => it.requirePhoto)
  if (photoItems.length) {
    const photos = await db.jobPhoto.findMany({
      where: { jobId, jobChecklistItemId: { in: photoItems.map((i) => i.id) } },
      select: { jobChecklistItemId: true },
    })
    const withPhoto = new Set(photos.map((p) => p.jobChecklistItemId))
    for (const it of photoItems) if (!withPhoto.has(it.id)) unmet.push(`Photo required: ${it.label}`)
  }
  return unmet
}

export async function clockIn(orgId: string, jobId: string, userId: string, loc: Loc) {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({
    where: { id: jobId },
    select: { id: true, status: true, actualStart: true, serviceLocation: { select: { latitude: true, longitude: true, geofenceRadiusM: true } } },
  })
  assertFound(job, "Job")
  if (job!.status === "CANCELLED") throw new ConflictError("This job has been cancelled")
  await assertAssigned(db, jobId, userId)

  // Geofence enforcement (Phase 29): only when the org has the capability, the
  // site has a geofence, AND a location was actually captured. We never block on
  // a missing GPS fix (that would strand cleaners with poor signal).
  const site = job!.serviceLocation
  if (site.latitude != null && site.longitude != null && site.geofenceRadiusM != null && loc.lat != null && loc.lng != null) {
    if (await orgHasGeofencing(orgId)) {
      const meters = haversineMeters(loc.lat, loc.lng, site.latitude, site.longitude)
      if (meters > site.geofenceRadiusM) {
        throw new ForbiddenActionError(`You appear to be ${Math.round(meters)}m from the site (outside the ${site.geofenceRadiusM}m clock-in area). Move closer and try again, or contact your supervisor.`)
      }
    }
  }

  // Idempotent: already clocked into THIS job.
  const existing = await db.timeEntry.findFirst({ where: { jobId, userId, status: "OPEN" }, select: { id: true } })
  if (existing) return { timeEntryId: existing.id, alreadyOpen: true }

  // Blocked: clocked into ANOTHER job.
  const other = await db.timeEntry.findFirst({
    where: { userId, status: "OPEN", jobId: { not: jobId } },
    include: { job: { select: { id: true, title: true } } },
  })
  if (other) {
    throw new ConflictError("You're already clocked into another job", {
      activeJobId: other.job?.id,
      activeJobTitle: other.job?.title,
    })
  }

  const now = new Date()
  const entry = await db.timeEntry.create({
    data: {
      organizationId: orgId,
      jobId,
      userId,
      status: "OPEN",
      clockInAt: now,
      clockInLat: loc.lat,
      clockInLng: loc.lng,
      clockInAccuracyM: loc.accuracyM,
      clockInSource: sourceFor(loc),
    },
  })
  await db.jobAssignment.updateMany({ where: { jobId, userId }, data: { status: "IN_PROGRESS" } })
  // First cleaner active → Job IN_PROGRESS + actualStart (only if not set).
  await db.job.updateMany({
    where: { id: jobId, status: { in: ["SCHEDULED", "ASSIGNED"] } },
    data: { status: "IN_PROGRESS", ...(job!.actualStart ? {} : { actualStart: now }) },
  })
  return { timeEntryId: entry.id, alreadyOpen: false }
}

export async function clockOut(orgId: string, jobId: string, userId: string, loc: Loc) {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({ where: { id: jobId }, select: { id: true, status: true } })
  assertFound(job, "Job")

  const open = await db.timeEntry.findFirst({ where: { jobId, userId, status: "OPEN" }, select: { id: true } })
  if (!open) {
    // Retry-safe: nothing to close.
    return { closed: false, jobCompleted: job!.status === "COMPLETED" }
  }

  // Gate: required checklist + required photos must be satisfied.
  const unmet = await checklistRequirementsUnmet(orgId, jobId)
  if (unmet.length) throw new RequirementsError("Finish required work before clocking out", unmet)

  const now = new Date()
  await db.timeEntry.updateMany({
    where: { id: open.id },
    data: {
      status: "COMPLETED",
      clockOutAt: now,
      clockOutLat: loc.lat,
      clockOutLng: loc.lng,
      clockOutAccuracyM: loc.accuracyM,
      clockOutSource: sourceFor(loc),
      ...(loc.breakMinutes != null ? { breakMinutes: loc.breakMinutes } : {}),
    },
  })
  await db.jobAssignment.updateMany({ where: { jobId, userId }, data: { status: "COMPLETED" } })

  // Complete the Job only when no one is still working and everyone is done.
  const openCount = await db.timeEntry.count({ where: { jobId, status: "OPEN" } })
  const notDone = await db.jobAssignment.count({ where: { jobId, status: { not: "COMPLETED" } } })
  let jobCompleted = false
  if (openCount === 0 && notDone === 0) {
    const { count } = await db.job.updateMany({
      where: { id: jobId, status: { notIn: ["CANCELLED", "COMPLETED"] } },
      data: { status: "COMPLETED", actualEnd: now },
    })
    jobCompleted = true
    // Best-effort customer service-completion summary (Phase 26); idempotent.
    if (count > 0) {
      sendServiceSummarySafe(orgId, jobId)
      // Commission/crew-based earnings (Phase 37); no-op unless the org has it.
      await recomputeJobEarnings(orgId, jobId).catch(() => {})
    }
  }
  return { closed: true, jobCompleted }
}

export async function toggleChecklistItem(
  orgId: string,
  jobId: string,
  itemId: string,
  userId: string,
  patch: { isComplete?: boolean; note?: string },
) {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({ where: { id: jobId }, select: { id: true } })
  assertFound(job, "Job")
  await assertAssigned(db, jobId, userId)

  const item = await db.jobChecklistItem.findFirst({ where: { id: itemId, jobId }, select: { id: true } })
  assertFound(item, "Checklist item")

  const data: Record<string, unknown> = {}
  if (patch.note !== undefined) data.note = patch.note
  if (patch.isComplete !== undefined) {
    data.isComplete = patch.isComplete
    data.completedAt = patch.isComplete ? new Date() : null
    data.completedById = patch.isComplete ? userId : null
  }
  await db.jobChecklistItem.updateMany({ where: { id: itemId, jobId }, data })
  return db.jobChecklistItem.findFirst({ where: { id: itemId, jobId } })
}

/** Cleaner sets the job-level operational note (assigned cleaners only). */
export async function setFieldJobNote(orgId: string, jobId: string, userId: string, note: string) {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({ where: { id: jobId }, select: { id: true } })
  assertFound(job, "Job")
  await assertAssigned(db, jobId, userId)
  await db.job.updateMany({ where: { id: jobId }, data: { notes: note } })
  return { ok: true }
}
