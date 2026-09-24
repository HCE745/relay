import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import { Prisma } from "../../generated/prisma/client"
import type { z } from "zod"
import type { assetCreateSchema, assetUpdateSchema, assetMaintenanceSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof assetCreateSchema>
type UpdateInput = z.infer<typeof assetUpdateSchema>
type MaintInput = z.infer<typeof assetMaintenanceSchema>

const dec = (v?: string) => (v != null ? new Prisma.Decimal(v) : null)
const toDate = (d?: string) => (d ? new Date(`${d}T00:00:00.000Z`) : null)

const listInclude = {
  assignedToSite: { select: { id: true, name: true } },
  assignedToUser: { select: { id: true, name: true } },
  _count: { select: { maintenance: true } },
} as const

async function assertAssignments(orgId: string, input: { assignedToSiteId?: string; assignedToUserId?: string }) {
  const db = orgDb(orgId)
  if (input.assignedToSiteId) assertFound(await db.serviceLocation.findFirst({ where: { id: input.assignedToSiteId }, select: { id: true } }), "Site")
  if (input.assignedToUserId) assertFound(await db.user.findFirst({ where: { id: input.assignedToUserId }, select: { id: true } }), "User")
}

export function listAssets(orgId: string) {
  return orgDb(orgId).asset.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }], include: listInclude })
}

export function getAsset(orgId: string, id: string) {
  return orgDb(orgId).asset.findFirst({
    where: { id },
    include: {
      assignedToSite: { select: { id: true, name: true } },
      assignedToUser: { select: { id: true, name: true } },
      maintenance: { orderBy: { date: "desc" }, include: { performedBy: { select: { name: true } } } },
    },
  })
}

export async function createAsset(orgId: string, input: CreateInput) {
  await assertAssignments(orgId, input)
  return orgDb(orgId).asset.create({
    data: {
      organizationId: orgId,
      name: input.name,
      category: input.category ?? "EQUIPMENT",
      serial: input.serial,
      purchaseDate: toDate(input.purchaseDate),
      purchaseCost: dec(input.purchaseCost),
      status: input.status ?? "ACTIVE",
      assignedToSiteId: input.assignedToSiteId ?? null,
      assignedToUserId: input.assignedToUserId ?? null,
    },
  })
}

export async function updateAsset(orgId: string, id: string, input: UpdateInput) {
  await assertAssignments(orgId, input)
  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name
  if (input.category !== undefined) data.category = input.category
  if (input.serial !== undefined) data.serial = input.serial
  if (input.status !== undefined) data.status = input.status
  if (input.purchaseDate !== undefined) data.purchaseDate = toDate(input.purchaseDate)
  if (input.purchaseCost !== undefined) data.purchaseCost = dec(input.purchaseCost)
  if (input.assignedToSiteId !== undefined) data.assignedToSiteId = input.assignedToSiteId ?? null
  if (input.assignedToUserId !== undefined) data.assignedToUserId = input.assignedToUserId ?? null
  const { count } = await orgDb(orgId).asset.updateMany({ where: { id }, data })
  if (count === 0) return null
  return getAsset(orgId, id)
}

/** Append a maintenance-log entry (no scheduling — a record only). */
export async function addMaintenance(orgId: string, assetId: string, actorId: string, input: MaintInput) {
  const db = orgDb(orgId)
  const asset = await db.asset.findFirst({ where: { id: assetId }, select: { id: true } })
  if (!asset) return null
  await db.assetMaintenance.create({
    data: {
      assetId,
      type: input.type,
      date: input.date ? toDate(input.date)! : new Date(),
      cost: dec(input.cost),
      notes: input.notes,
      performedById: actorId,
    },
  })
  return getAsset(orgId, assetId)
}
