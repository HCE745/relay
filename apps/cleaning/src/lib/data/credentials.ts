import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import { credentialState } from "../credential-status"
import type { z } from "zod"
import type { credentialCreateSchema, credentialUpdateSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof credentialCreateSchema>
type UpdateInput = z.infer<typeof credentialUpdateSchema>
const toDate = (d?: string | null) => (d ? new Date(`${d}T00:00:00.000Z`) : null)

export function listCredentials(orgId: string) {
  return orgDb(orgId).credential.findMany({
    orderBy: [{ userId: "asc" }, { type: "asc" }],
    include: { user: { select: { id: true, name: true } } },
  })
}

export function listCredentialsForUser(orgId: string, userId: string) {
  return orgDb(orgId).credential.findMany({ where: { userId }, orderBy: { type: "asc" } })
}

export function createCredential(orgId: string, input: CreateInput) {
  return orgDb(orgId).credential.create({
    data: {
      organizationId: orgId,
      userId: input.userId,
      type: input.type,
      issueDate: toDate(input.issueDate),
      expiryDate: toDate(input.expiryDate),
      documentRef: input.documentRef,
      status: input.status ?? "ACTIVE",
      notes: input.notes,
    },
  })
}

export async function updateCredential(orgId: string, id: string, input: UpdateInput) {
  const data: Record<string, unknown> = {}
  if (input.type !== undefined) data.type = input.type
  if (input.issueDate !== undefined) data.issueDate = toDate(input.issueDate)
  if (input.expiryDate !== undefined) data.expiryDate = toDate(input.expiryDate)
  if (input.documentRef !== undefined) data.documentRef = input.documentRef
  if (input.status !== undefined) data.status = input.status
  if (input.notes !== undefined) data.notes = input.notes
  const { count } = await orgDb(orgId).credential.updateMany({ where: { id }, data })
  if (count === 0) return null
  return assertFound(await orgDb(orgId).credential.findFirst({ where: { id } }), "Credential")
}

export async function deleteCredential(orgId: string, id: string) {
  const { count } = await orgDb(orgId).credential.deleteMany({ where: { id } })
  return count > 0
}

/** Credentials that are expiring (within lead) or already expired — the warnings. */
export async function listExpiringCredentials(orgId: string, leadDays: number, now: Date = new Date()) {
  const all = await orgDb(orgId).credential.findMany({
    where: { status: "ACTIVE", expiryDate: { not: null } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { expiryDate: "asc" },
  })
  return all
    .map((c) => ({ ...c, state: credentialState(c, leadDays, now) }))
    .filter((c) => c.state === "EXPIRING" || c.state === "EXPIRED")
}

export async function countCredentialAlerts(orgId: string, leadDays: number, now: Date = new Date()): Promise<number> {
  return (await listExpiringCredentials(orgId, leadDays, now)).length
}

// ── Site credential requirements ──
export function listSiteRequirements(orgId: string, serviceLocationId?: string) {
  return orgDb(orgId).siteCredentialRequirement.findMany({
    where: serviceLocationId ? { serviceLocationId } : {},
    orderBy: { type: "asc" },
  })
}

/** Replace the set of credential types a site requires. */
export async function setSiteRequirements(orgId: string, serviceLocationId: string, types: string[]) {
  const db = orgDb(orgId)
  const site = await db.serviceLocation.findFirst({ where: { id: serviceLocationId }, select: { id: true } })
  assertFound(site, "Service location")
  const unique = [...new Set(types)]
  // Replace the whole set: clear the site's requirements, then create the
  // desired ones. deleteMany/createMany are auto-scoped by orgDb (upsert is a
  // blocked by-unique op on scoped models — see org-db.ts).
  await db.$transaction([
    db.siteCredentialRequirement.deleteMany({ where: { serviceLocationId } }),
    ...(unique.length
      ? [db.siteCredentialRequirement.createMany({ data: unique.map((type) => ({ organizationId: orgId, serviceLocationId, type: type as never })) })]
      : []),
  ])
  return listSiteRequirements(orgId, serviceLocationId)
}
