import { orgDb } from "../org-db"
import { recordAudit } from "./audit"
import { assertFound } from "./errors"
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
    db.excludedAddress.findMany({ orderBy: { createdAt: "desc" } }),
    db.excludedContact.findMany({ orderBy: { createdAt: "desc" } }),
    db.excludedZone.findMany({ orderBy: { createdAt: "desc" } }),
  ]).then(([addresses, contacts, zones]) => ({ addresses, contacts, zones }))
}

export async function createExcludedAddress(orgId: string, actorId: string, input: AddressInput) {
  const row = await orgDb(orgId).excludedAddress.create({
    data: { organizationId: orgId, addressLine1: input.addressLine1, city: input.city, state: input.state, postalCode: input.postalCode, reason: input.reason, note: input.note, createdById: actorId },
  })
  await recordAudit(orgId, actorId, ENTITY.address, row.id, "create", { newValue: input.reason, metadata: { reason: input.reason, note: input.note, addressLine1: input.addressLine1 } })
  return row
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
  const { count } = await db.excludedAddress.updateMany({ where: { id }, data: { ...input } })
  if (count === 0) return null
  await logUpdate(orgId, actorId, "address", id, { ...input })
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
