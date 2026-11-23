import { orgDb } from "../org-db"
import { recordAudit } from "./audit"
import { assertFound, ConflictError } from "./errors"
import type { z } from "zod"
import type {
  serviceAreaCreateSchema, excludedAddressSchema, excludedContactSchema, excludedZoneSchema,
} from "../zod-schemas"

type AreaInput = z.infer<typeof serviceAreaCreateSchema>
type AddressInput = z.infer<typeof excludedAddressSchema>
type ContactInput = z.infer<typeof excludedContactSchema>
type ZoneInput = z.infer<typeof excludedZoneSchema>

const dec = (n?: number) => (n === undefined ? null : String(n))

// ── Service areas ──
export function listServiceAreas(orgId: string) {
  return orgDb(orgId).serviceArea.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] })
}
export function createServiceArea(orgId: string, input: AreaInput) {
  return orgDb(orgId).serviceArea.create({
    data: {
      organizationId: orgId, name: input.name, zipCodes: input.zipCodes ?? [],
      centerLat: dec(input.centerLat), centerLng: dec(input.centerLng), radiusMiles: dec(input.radiusMiles),
      officeLabel: input.officeLabel, active: input.active ?? true,
    },
  })
}
export async function updateServiceArea(orgId: string, id: string, input: Partial<AreaInput>) {
  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name
  if (input.zipCodes !== undefined) data.zipCodes = input.zipCodes
  if (input.centerLat !== undefined) data.centerLat = dec(input.centerLat)
  if (input.centerLng !== undefined) data.centerLng = dec(input.centerLng)
  if (input.radiusMiles !== undefined) data.radiusMiles = dec(input.radiusMiles)
  if (input.officeLabel !== undefined) data.officeLabel = input.officeLabel
  if (input.active !== undefined) data.active = input.active
  const { count } = await orgDb(orgId).serviceArea.updateMany({ where: { id }, data })
  if (count === 0) return null
  return orgDb(orgId).serviceArea.findFirst({ where: { id } })
}
export async function deleteServiceArea(orgId: string, id: string) {
  const { count } = await orgDb(orgId).serviceArea.deleteMany({ where: { id } })
  return count > 0
}

// ── Exclusions ──
// Every create/edit/delete of an exclusion writes to AuditEvent with the actor
// and the reason — a permanent record of who put a do-not-serve flag on file.
type Kind = "address" | "contact" | "zone"
const ENTITY: Record<Kind, string> = { address: "ExcludedAddress", contact: "ExcludedContact", zone: "ExcludedZone" }

export function listExclusions(orgId: string) {
  const db = orgDb(orgId)
  return Promise.all([
    db.excludedAddress.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { customer: { select: { id: true, name: true, archivedAt: true } }, serviceLocation: { select: { id: true, name: true } } },
    }),
    db.excludedContact.findMany({ orderBy: { createdAt: "desc" } }),
    db.excludedZone.findMany({ orderBy: { createdAt: "desc" } }),
  ]).then(([addresses, contacts, zones]) => ({ addresses, contacts, zones }))
}

/** How many address exclusions reference a customer (any status) — used to warn
 *  on archive and to block a hard delete that would orphan incident history. */
export function customerExclusionCount(orgId: string, customerId: string) {
  return orgDb(orgId).excludedAddress.count({ where: { customerId } })
}

export async function createExcludedAddress(orgId: string, actorId: string, input: AddressInput) {
  const db = orgDb(orgId)
  // Snapshot the linked customer's name so the association survives archiving.
  let customerNameSnapshot: string | undefined
  if (input.customerId) {
    const c = await db.customer.findFirst({ where: { id: input.customerId }, select: { name: true } })
    customerNameSnapshot = c?.name
  }
  const row = await db.excludedAddress.create({
    data: {
      organizationId: orgId,
      addressLine1: input.addressLine1, city: input.city, state: input.state, postalCode: input.postalCode,
      reason: input.reason, note: input.note, createdById: actorId,
      customerId: input.customerId ?? null,
      serviceLocationId: input.serviceLocationId ?? null,
      customerNameSnapshot: customerNameSnapshot ?? null,
      incidentDate: input.incidentDate ? new Date(input.incidentDate) : null,
      occupantName: input.occupantName ?? null,
      occupantPhone: input.occupantPhone ?? null,
      occupantEmail: input.occupantEmail ?? null,
      isPropertySpecific: input.isPropertySpecific ?? false,
      events: {
        create: { organizationId: orgId, type: "CREATED", actorId, note: input.note ?? null },
      },
    },
  })
  await recordAudit(orgId, actorId, ENTITY.address, row.id, "create", { newValue: input.reason, metadata: { reason: input.reason, note: input.note, addressLine1: input.addressLine1, customerId: input.customerId, isPropertySpecific: input.isPropertySpecific } })
  return row
}

// Full detail for one address exclusion: incident fields, the audit trail, the
// linked customer + location, and the customer's contracts (for navigation).
export async function getExcludedAddressDetail(orgId: string, id: string) {
  const db = orgDb(orgId)
  const row = await db.excludedAddress.findFirst({
    where: { id },
    include: {
      events: { orderBy: { createdAt: "desc" } },
      customer: { select: { id: true, name: true, archivedAt: true, contracts: { select: { id: true, title: true, status: true }, orderBy: { createdAt: "desc" } } } },
      serviceLocation: { select: { id: true, name: true } },
    },
  })
  return row
}

/**
 * Record a verified occupant change. This documents the NEW occupant's identity
 * and sets occupantChangeVerifiedAt — the evidence that lets management lift a
 * person-specific exclusion. It deliberately does NOT create a new exclusion or
 * re-point the incident's customer link: a previous occupant's misconduct is
 * never auto-transferred to whoever lives there now.
 */
export async function recordOccupantChange(
  orgId: string, actorId: string, id: string,
  input: { occupantName?: string; occupantPhone?: string; occupantEmail?: string; verifiedAt?: string; note?: string },
) {
  const db = orgDb(orgId)
  const existing = await db.excludedAddress.findFirst({ where: { id }, select: { id: true } })
  assertFound(existing, "Exclusion")
  const verifiedAt = input.verifiedAt ? new Date(input.verifiedAt) : new Date()
  await db.excludedAddress.updateMany({
    where: { id },
    data: {
      occupantName: input.occupantName ?? null,
      occupantPhone: input.occupantPhone ?? null,
      occupantEmail: input.occupantEmail ?? null,
      occupantChangeVerifiedAt: verifiedAt,
    },
  })
  await db.exclusionEvent.create({
    data: { organizationId: orgId, excludedAddressId: id, type: "OCCUPANT_CHANGE", actorId, note: input.note ?? null,
      occupantName: input.occupantName ?? null, occupantPhone: input.occupantPhone ?? null, occupantEmail: input.occupantEmail ?? null, verifiedAt },
  })
  await recordAudit(orgId, actorId, ENTITY.address, id, "occupant_change", { metadata: { occupantName: input.occupantName, verifiedAt: verifiedAt.toISOString() } })
  return db.excludedAddress.findFirst({ where: { id } })
}

/** Lift an exclusion (management, after review). Preserves the record + its
 *  customer association — status becomes LIFTED, never deleted. */
export async function liftExclusion(orgId: string, actorId: string, id: string, reason: string) {
  const db = orgDb(orgId)
  const existing = await db.excludedAddress.findFirst({ where: { id }, select: { status: true } })
  assertFound(existing, "Exclusion")
  if (existing!.status === "LIFTED") throw new ConflictError("This exclusion is already lifted")
  await db.excludedAddress.updateMany({ where: { id }, data: { status: "LIFTED", liftedAt: new Date(), liftedById: actorId, liftReason: reason } })
  await db.exclusionEvent.create({ data: { organizationId: orgId, excludedAddressId: id, type: "LIFTED", actorId, note: reason } })
  await recordAudit(orgId, actorId, ENTITY.address, id, "lift", { metadata: { reason } })
  return db.excludedAddress.findFirst({ where: { id } })
}

/** Reinstate a previously lifted exclusion. */
export async function reinstateExclusion(orgId: string, actorId: string, id: string, reason: string) {
  const db = orgDb(orgId)
  const existing = await db.excludedAddress.findFirst({ where: { id }, select: { status: true } })
  assertFound(existing, "Exclusion")
  if (existing!.status === "ACTIVE") throw new ConflictError("This exclusion is already active")
  await db.excludedAddress.updateMany({ where: { id }, data: { status: "ACTIVE", liftedAt: null, liftedById: null, liftReason: null } })
  await db.exclusionEvent.create({ data: { organizationId: orgId, excludedAddressId: id, type: "REINSTATED", actorId, note: reason } })
  await recordAudit(orgId, actorId, ENTITY.address, id, "reinstate", { metadata: { reason } })
  return db.excludedAddress.findFirst({ where: { id } })
}

/** Link/relink the incident to a customer + service location (snapshots name). */
export async function linkExclusionRecord(
  orgId: string, actorId: string, id: string,
  input: { customerId?: string | null; serviceLocationId?: string | null; incidentDate?: string | null; isPropertySpecific?: boolean },
) {
  const db = orgDb(orgId)
  const data: Record<string, unknown> = {}
  if (input.customerId !== undefined) {
    data.customerId = input.customerId
    if (input.customerId) {
      const c = await db.customer.findFirst({ where: { id: input.customerId }, select: { name: true } })
      data.customerNameSnapshot = c?.name ?? null
    }
  }
  if (input.serviceLocationId !== undefined) data.serviceLocationId = input.serviceLocationId
  if (input.incidentDate !== undefined) data.incidentDate = input.incidentDate ? new Date(input.incidentDate) : null
  if (input.isPropertySpecific !== undefined) data.isPropertySpecific = input.isPropertySpecific
  const { count } = await db.excludedAddress.updateMany({ where: { id }, data })
  if (count === 0) return null
  await recordAudit(orgId, actorId, ENTITY.address, id, "link", { metadata: input })
  return db.excludedAddress.findFirst({ where: { id } })
}
export async function createExcludedContact(orgId: string, actorId: string, input: ContactInput) {
  const row = await orgDb(orgId).excludedContact.create({
    data: { organizationId: orgId, name: input.name, phone: input.phone, email: input.email, reason: input.reason, note: input.note, createdById: actorId },
  })
  await recordAudit(orgId, actorId, ENTITY.contact, row.id, "create", { newValue: input.reason, metadata: { reason: input.reason, note: input.note } })
  return row
}
export async function createExcludedZone(orgId: string, actorId: string, input: ZoneInput) {
  const row = await orgDb(orgId).excludedZone.create({
    data: { organizationId: orgId, value: input.value, reason: input.reason, note: input.note, createdById: actorId },
  })
  await recordAudit(orgId, actorId, ENTITY.zone, row.id, "create", { newValue: input.reason, metadata: { reason: input.reason, note: input.note, value: input.value } })
  return row
}

async function logUpdate(orgId: string, actorId: string, kind: Kind, id: string, data: Record<string, unknown>) {
  await recordAudit(orgId, actorId, ENTITY[kind], id, "update", { metadata: { ...data } })
}
export async function updateExcludedAddress(orgId: string, actorId: string, id: string, input: Partial<AddressInput>) {
  const db = orgDb(orgId)
  // Map explicitly so `incidentDate` (a string on the wire) becomes a Date and
  // no unexpected field reaches Prisma.
  const data: Record<string, unknown> = {}
  for (const k of ["addressLine1", "city", "state", "postalCode", "reason", "note", "occupantName", "occupantPhone", "occupantEmail", "isPropertySpecific"] as const) {
    if (input[k] !== undefined) data[k] = input[k]
  }
  if (input.incidentDate !== undefined) data.incidentDate = input.incidentDate ? new Date(input.incidentDate) : null
  const { count } = await db.excludedAddress.updateMany({ where: { id }, data })
  if (count === 0) return null
  await logUpdate(orgId, actorId, "address", id, data)
  return db.excludedAddress.findFirst({ where: { id } })
}
export async function updateExcludedContact(orgId: string, actorId: string, id: string, input: Partial<ContactInput>) {
  const db = orgDb(orgId)
  const { count } = await db.excludedContact.updateMany({ where: { id }, data: { ...input } })
  if (count === 0) return null
  await logUpdate(orgId, actorId, "contact", id, { ...input })
  return db.excludedContact.findFirst({ where: { id } })
}
export async function updateExcludedZone(orgId: string, actorId: string, id: string, input: Partial<ZoneInput>) {
  const db = orgDb(orgId)
  const { count } = await db.excludedZone.updateMany({ where: { id }, data: { ...input } })
  if (count === 0) return null
  await logUpdate(orgId, actorId, "zone", id, { ...input })
  return db.excludedZone.findFirst({ where: { id } })
}

export async function deleteExcludedAddress(orgId: string, actorId: string, id: string) {
  const db = orgDb(orgId)
  const existing = await db.excludedAddress.findFirst({ where: { id }, select: { reason: true } })
  assertFound(existing, "Exclusion")
  await db.excludedAddress.deleteMany({ where: { id } })
  await recordAudit(orgId, actorId, ENTITY.address, id, "delete", { oldValue: existing!.reason, metadata: { reason: existing!.reason } })
  return true
}
export async function deleteExcludedContact(orgId: string, actorId: string, id: string) {
  const db = orgDb(orgId)
  const existing = await db.excludedContact.findFirst({ where: { id }, select: { reason: true } })
  assertFound(existing, "Exclusion")
  await db.excludedContact.deleteMany({ where: { id } })
  await recordAudit(orgId, actorId, ENTITY.contact, id, "delete", { oldValue: existing!.reason, metadata: { reason: existing!.reason } })
  return true
}
export async function deleteExcludedZone(orgId: string, actorId: string, id: string) {
  const db = orgDb(orgId)
  const existing = await db.excludedZone.findFirst({ where: { id }, select: { reason: true } })
  assertFound(existing, "Exclusion")
  await db.excludedZone.deleteMany({ where: { id } })
  await recordAudit(orgId, actorId, ENTITY.zone, id, "delete", { oldValue: existing!.reason, metadata: { reason: existing!.reason } })
  return true
}

/**
 * Record that staff knowingly proceeded past an intake warning (outside service
 * area and/or an exclusion match). WARN, not block — but the override is a
 * permanent AuditEvent naming the actor and the reasons.
 */
export function acknowledgeIntakeFlags(
  orgId: string,
  actorId: string,
  entityType: string,
  entityId: string,
  flags: { outsideServiceArea: boolean; exclusions: { kind: string; reason: string }[] },
) {
  const reasons = [
    ...(flags.outsideServiceArea ? ["outside_service_area"] : []),
    ...flags.exclusions.map((e) => `${e.kind}:${e.reason}`),
  ]
  return recordAudit(orgId, actorId, entityType, entityId, "intake_flag_acknowledged", { metadata: { reasons } })
}
