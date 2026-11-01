import { randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { orgDb, systemDb } from "../org-db"
import { assertFound, ForbiddenActionError } from "./errors"
import { recordAudit } from "./audit"
import { clockIn, clockOut } from "../scheduling/execution"

// Shared time-clock kiosk (Phase 49). A kiosk is a device authenticated by a
// bcrypt-hashed activation token (NOT a staff session). Every punch is routed
// through the normal clockIn/clockOut path so per-user TimeEntry integrity
// (one open entry per user, assignment + geofence checks) is unchanged, and
// each punch is written to the audit trail with the kiosk id.

// ── Admin management (org-scoped, session-guarded callers) ──

export async function listKiosks(orgId: string) {
  const kiosks = await orgDb(orgId).timeClockKiosk.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { serviceLocation: { select: { name: true } } },
  })
  return kiosks.map((k) => ({
    id: k.id,
    name: k.name,
    siteName: k.serviceLocation?.name ?? null,
    serviceLocationId: k.serviceLocationId,
    pinRequired: k.pinRequired,
    photoRequired: k.photoRequired,
    isActive: k.isActive,
    lastSeenAt: k.lastSeenAt,
  }))
}

type KioskInput = { name: string; serviceLocationId?: string | null; pinRequired?: boolean; photoRequired?: boolean }

function newToken() {
  return randomBytes(24).toString("base64url")
}

/** Create a kiosk and return the one-time plaintext activation token. */
export async function createKiosk(orgId: string, input: KioskInput) {
  const token = newToken()
  const kiosk = await orgDb(orgId).timeClockKiosk.create({
    data: {
      organizationId: orgId,
      name: input.name.trim(),
      serviceLocationId: input.serviceLocationId ?? null,
      deviceTokenHash: await bcrypt.hash(token, 10),
      pinRequired: input.pinRequired ?? true,
      photoRequired: input.photoRequired ?? false,
    },
    select: { id: true },
  })
  return { id: kiosk.id, token }
}

export async function updateKiosk(orgId: string, id: string, input: Partial<KioskInput> & { isActive?: boolean }) {
  const data: { name?: string; serviceLocationId?: string | null; pinRequired?: boolean; photoRequired?: boolean; isActive?: boolean } = {}
  if (input.name !== undefined) data.name = input.name.trim()
  if (input.serviceLocationId !== undefined) data.serviceLocationId = input.serviceLocationId
  if (input.pinRequired !== undefined) data.pinRequired = input.pinRequired
  if (input.photoRequired !== undefined) data.photoRequired = input.photoRequired
  if (input.isActive !== undefined) data.isActive = input.isActive
  const res = await orgDb(orgId).timeClockKiosk.updateMany({ where: { id }, data })
  assertFound(res.count > 0 ? {} : null, "Kiosk")
  return { ok: true }
}

/** Rotate a kiosk's activation token (invalidates the old device). Returns the new token once. */
export async function regenerateKioskToken(orgId: string, id: string) {
  const token = newToken()
  const res = await orgDb(orgId).timeClockKiosk.updateMany({ where: { id }, data: { deviceTokenHash: await bcrypt.hash(token, 10) } })
  assertFound(res.count > 0 ? {} : null, "Kiosk")
  return { token }
}

/** Set (or clear) an employee's clock PIN. PIN is bcrypt-hashed, never stored raw. */
export async function setClockPin(orgId: string, userId: string, pin: string | null) {
  const profile = await orgDb(orgId).employeeProfile.findFirst({ where: { userId }, select: { id: true } })
  assertFound(profile, "Employee profile")
  const hash = pin ? await bcrypt.hash(pin, 10) : null
  await orgDb(orgId).employeeProfile.updateMany({ where: { userId }, data: { clockPinHash: hash } })
  return { ok: true, set: !!pin }
}

/** Field staff with whether a PIN is set — for the admin PIN panel. */
export async function listPinStatus(orgId: string) {
  const users = await orgDb(orgId).user.findMany({
    where: { isActive: true, role: { in: ["CLEANER", "SUPERVISOR", "MANAGER"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, employeeProfile: { select: { clockPinHash: true } } },
  })
  return users.map((u) => ({ id: u.id, name: u.name, hasPin: !!u.employeeProfile?.clockPinHash }))
}

// ── Device side (token-authenticated, no staff session) ──

type AuthedKiosk = {
  id: string
  organizationId: string
  name: string
  serviceLocationId: string | null
  pinRequired: boolean
  photoRequired: boolean
}

/** Authenticate a kiosk device by id + plaintext token. Returns null on any failure. */
export async function authenticateKiosk(kioskId: string, token: string): Promise<AuthedKiosk | null> {
  if (!kioskId || !token) return null
  // Pre-auth lookup by id (no org context yet) — the kiosk row carries the tenant.
  const kiosk = await systemDb.timeClockKiosk.findUnique({ where: { id: kioskId } })
  if (!kiosk || !kiosk.isActive) return null
  const ok = await bcrypt.compare(token, kiosk.deviceTokenHash)
  if (!ok) return null
  await systemDb.timeClockKiosk.update({ where: { id: kiosk.id }, data: { lastSeenAt: new Date() } }).catch(() => {})
  return {
    id: kiosk.id,
    organizationId: kiosk.organizationId,
    name: kiosk.name,
    serviceLocationId: kiosk.serviceLocationId,
    pinRequired: kiosk.pinRequired,
    photoRequired: kiosk.photoRequired,
  }
}

/** The roster the device shows: active field staff with clocked-in + has-PIN state. */
export async function kioskRoster(kiosk: AuthedKiosk) {
  const db = orgDb(kiosk.organizationId)
  const users = await db.user.findMany({
    where: { isActive: true, role: { in: ["CLEANER", "SUPERVISOR"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, employeeProfile: { select: { clockPinHash: true } } },
  })
  const open = await db.timeEntry.findMany({ where: { status: "OPEN", userId: { in: users.map((u) => u.id) } }, select: { userId: true } })
  const clockedIn = new Set(open.map((o) => o.userId))
  return users.map((u) => ({ id: u.id, name: u.name, clockedIn: clockedIn.has(u.id), hasPin: !!u.employeeProfile?.clockPinHash }))
}

/** Resolve which job a punch applies to: clock OUT of an open entry, else clock
 *  IN to the user's assignment at the kiosk site around now. */
async function resolvePunch(orgId: string, userId: string, siteId: string | null, now: Date) {
  const db = orgDb(orgId)
  const open = await db.timeEntry.findFirst({ where: { userId, status: "OPEN" }, select: { id: true, jobId: true } })
  if (open?.jobId) return { mode: "out" as const, jobId: open.jobId, entryId: open.id }

  const windowStart = new Date(now.getTime() - 12 * 3600_000)
  const windowEnd = new Date(now.getTime() + 12 * 3600_000)
  const jobs = await db.job.findMany({
    where: {
      status: { in: ["SCHEDULED", "ASSIGNED", "IN_PROGRESS"] },
      scheduledStart: { gte: windowStart, lte: windowEnd },
      assignments: { some: { userId } },
      ...(siteId ? { serviceLocationId: siteId } : {}),
    },
    select: { id: true, title: true, scheduledStart: true },
  })
  if (jobs.length === 0) return { mode: "none" as const }
  // Nearest scheduled start to now.
  jobs.sort((a, b) => Math.abs(a.scheduledStart.getTime() - now.getTime()) - Math.abs(b.scheduledStart.getTime() - now.getTime()))
  return { mode: "in" as const, jobId: jobs[0].id, title: jobs[0].title }
}

/** Execute a kiosk punch for one employee. PIN/photo are verified per the
 *  kiosk's config; the clock itself goes through the normal path, then audited. */
export async function kioskPunch(kiosk: AuthedKiosk, input: { userId: string; pin?: string; photoRef?: string }) {
  const orgId = kiosk.organizationId
  const db = orgDb(orgId)
  const user = await db.user.findFirst({
    where: { id: input.userId, isActive: true, role: { in: ["CLEANER", "SUPERVISOR"] } },
    select: { id: true, name: true, employeeProfile: { select: { clockPinHash: true } } },
  })
  assertFound(user, "Employee")

  if (kiosk.pinRequired) {
    const hash = user!.employeeProfile?.clockPinHash
    if (!hash) throw new ForbiddenActionError("No clock PIN is set for this employee. Ask a manager to set one.")
    if (!(await bcrypt.compare(input.pin ?? "", hash))) throw new ForbiddenActionError("Incorrect PIN")
  }
  if (kiosk.photoRequired && !input.photoRef?.trim()) {
    throw new ForbiddenActionError("A photo is required at this kiosk")
  }

  const now = new Date()
  const site = kiosk.serviceLocationId
    ? await db.serviceLocation.findFirst({ where: { id: kiosk.serviceLocationId }, select: { latitude: true, longitude: true } })
    : null
  // Kiosk coordinates satisfy the site geofence naturally (the device is on-site).
  const loc = { source: "kiosk" as const, lat: site?.latitude ?? undefined, lng: site?.longitude ?? undefined }

  const resolved = await resolvePunch(orgId, input.userId, kiosk.serviceLocationId, now)
  if (resolved.mode === "none") {
    throw new ForbiddenActionError("No job to clock into right now. Check the schedule or see a supervisor.")
  }

  let entryId: string
  let action: "in" | "out"
  if (resolved.mode === "out") {
    await clockOut(orgId, resolved.jobId, input.userId, loc) // same checklist/photo gate as the app
    entryId = resolved.entryId
    action = "out"
  } else {
    const res = await clockIn(orgId, resolved.jobId, input.userId, loc)
    entryId = res.timeEntryId
    action = "in"
  }

  // Audit every shared-device punch with the kiosk + any photo reference, so a
  // shared kiosk strengthens rather than weakens the trail.
  await recordAudit(orgId, input.userId, "TimeEntry", entryId, action === "in" ? "kiosk_clock_in" : "kiosk_clock_out", {
    metadata: { kioskId: kiosk.id, kioskName: kiosk.name, photoRef: input.photoRef ?? null },
  })

  return { action, userName: user!.name }
}
