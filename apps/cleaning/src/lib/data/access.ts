import { orgDb } from "../org-db"
import { assertFound, ForbiddenActionError, ReferenceError } from "./errors"
import { encryptSecret, decryptSecret, isSecretConfigured } from "../secret-crypto"
import type { z } from "zod"
import type { accessItemCreateSchema, accessItemUpdateSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof accessItemCreateSchema>
type UpdateInput = z.infer<typeof accessItemUpdateSchema>

const SECRET_TYPES = new Set(["CODE", "ALARM_CODE"])
// Public projection — NEVER selects secretCiphertext.
const listSelect = {
  id: true, type: true, identifier: true, description: true, status: true, serviceLocationId: true,
  holderUserId: true, secretCiphertext: true, createdAt: true,
  serviceLocation: { select: { name: true } },
  holder: { select: { id: true, name: true } },
} as const

export async function listAccessItems(orgId: string) {
  const items = await orgDb(orgId).accessItem.findMany({ orderBy: [{ status: "asc" }, { identifier: "asc" }], select: listSelect })
  // Strip the ciphertext; expose only whether a secret is held.
  return items.map(({ secretCiphertext, ...rest }) => ({ ...rest, hasSecret: SECRET_TYPES.has(rest.type) && !!secretCiphertext }))
}

export async function createAccessItem(orgId: string, input: CreateInput) {
  const site = await orgDb(orgId).serviceLocation.findFirst({ where: { id: input.serviceLocationId }, select: { id: true } })
  assertFound(site, "Service location")
  let secretCiphertext: string | null = null
  if (input.secret) {
    if (!SECRET_TYPES.has(input.type)) throw new ReferenceError("Only CODE/ALARM_CODE items can store a secret code")
    secretCiphertext = encryptSecret(input.secret)
    if (!secretCiphertext) throw new ForbiddenActionError("Access-code encryption is not configured (ACCESS_ENCRYPTION_KEY)")
  }
  const created = await orgDb(orgId).accessItem.create({
    data: {
      organizationId: orgId, serviceLocationId: input.serviceLocationId, type: input.type,
      identifier: input.identifier, description: input.description, secretCiphertext,
    },
    select: { id: true },
  })
  return { id: created.id }
}

export async function updateAccessItem(orgId: string, id: string, input: UpdateInput) {
  const item = await orgDb(orgId).accessItem.findFirst({ where: { id }, select: { id: true, type: true } })
  if (!item) return null
  const data: Record<string, unknown> = {}
  if (input.identifier !== undefined) data.identifier = input.identifier
  if (input.description !== undefined) data.description = input.description
  if (input.secret !== undefined) {
    if (!SECRET_TYPES.has(item.type)) throw new ReferenceError("Only CODE/ALARM_CODE items can store a secret code")
    const enc = encryptSecret(input.secret)
    if (!enc) throw new ForbiddenActionError("Access-code encryption is not configured (ACCESS_ENCRYPTION_KEY)")
    data.secretCiphertext = enc
  }
  await orgDb(orgId).accessItem.updateMany({ where: { id }, data })
  return { id }
}

async function audit(orgId: string, id: string, actorUserId: string, action: string, extra: Record<string, unknown> = {}) {
  await orgDb(orgId).auditEvent.create({
    data: { organizationId: orgId, actorUserId, entityType: "AccessItem", entityId: id, action, ...extra },
  })
}

export async function issueAccessItem(orgId: string, id: string, toUserId: string, actorUserId: string) {
  const db = orgDb(orgId)
  const item = await db.accessItem.findFirst({ where: { id }, select: { id: true, holderUserId: true } })
  if (!item) return null
  const user = await db.user.findFirst({ where: { id: toUserId, isActive: true }, select: { id: true } })
  if (!user) throw new ReferenceError("That employee is not available to hold access items")
  await db.$transaction(async (tx) => {
    await tx.accessItem.updateMany({ where: { id }, data: { holderUserId: toUserId, status: "ISSUED" } })
    await tx.auditEvent.create({ data: { organizationId: orgId, actorUserId, entityType: "AccessItem", entityId: id, action: "issue", oldValue: item.holderUserId ?? null, newValue: toUserId } })
  })
  return { id }
}

export async function returnAccessItem(orgId: string, id: string, actorUserId: string) {
  const db = orgDb(orgId)
  const item = await db.accessItem.findFirst({ where: { id }, select: { id: true, holderUserId: true } })
  if (!item) return null
  await db.$transaction(async (tx) => {
    await tx.accessItem.updateMany({ where: { id }, data: { holderUserId: null, status: "RETURNED" } })
    await tx.auditEvent.create({ data: { organizationId: orgId, actorUserId, entityType: "AccessItem", entityId: id, action: "return", oldValue: item.holderUserId ?? null } })
  })
  return { id }
}

export async function markAccessItemLost(orgId: string, id: string, actorUserId: string) {
  const db = orgDb(orgId)
  const item = await db.accessItem.findFirst({ where: { id }, select: { id: true } })
  if (!item) return null
  await db.accessItem.updateMany({ where: { id }, data: { status: "LOST", holderUserId: null } })
  await audit(orgId, id, actorUserId, "lost")
  return { id }
}

/**
 * Reveal a stored access code — restricted to OWNER/ADMIN/MANAGER at the route,
 * and every reveal is logged to AuditEvent. Returns the plaintext once.
 */
export async function revealAccessSecret(orgId: string, id: string, actorUserId: string): Promise<{ secret: string } | null> {
  if (!isSecretConfigured()) throw new ForbiddenActionError("Access-code encryption is not configured")
  const item = await orgDb(orgId).accessItem.findFirst({ where: { id }, select: { id: true, secretCiphertext: true } })
  if (!item) return null
  if (!item.secretCiphertext) throw new ReferenceError("This item has no stored code")
  const secret = decryptSecret(item.secretCiphertext)
  if (secret === null) throw new ForbiddenActionError("Could not decrypt the stored code")
  await audit(orgId, id, actorUserId, "reveal")
  return { secret }
}
