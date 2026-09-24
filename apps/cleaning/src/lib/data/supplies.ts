import { orgDb } from "../org-db"
import { assertFound, ConflictError } from "./errors"
import { Prisma } from "../../generated/prisma/client"
import type { z } from "zod"
import type { supplyCreateSchema, supplyUpdateSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof supplyCreateSchema>
type UpdateInput = z.infer<typeof supplyUpdateSchema>

const ZERO = new Prisma.Decimal(0)
const dec = (v?: string) => (v != null ? new Prisma.Decimal(v) : null)

/** Low stock = a meaningful reorder point that current stock has reached. */
export function isLowStock(s: { currentStock: Prisma.Decimal; reorderThreshold: Prisma.Decimal }): boolean {
  return s.reorderThreshold.greaterThan(ZERO) && s.currentStock.lessThanOrEqualTo(s.reorderThreshold)
}

export function listSupplies(orgId: string) {
  return orgDb(orgId).supply.findMany({ orderBy: { name: "asc" } })
}

/** Cleaner-facing: names + units only — no stock levels or costs. */
export function listSuppliesForField(orgId: string) {
  return orgDb(orgId).supply.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } })
}

export function getSupply(orgId: string, id: string) {
  return orgDb(orgId).supply.findFirst({
    where: { id },
    include: {
      usages: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { recordedBy: { select: { name: true } }, job: { select: { id: true, title: true } }, serviceLocation: { select: { name: true } } },
      },
      adjustments: { orderBy: { createdAt: "desc" }, take: 100, include: { adjustedBy: { select: { name: true } } } },
    },
  })
}

export async function countLowStock(orgId: string): Promise<number> {
  const supplies = await orgDb(orgId).supply.findMany({ select: { currentStock: true, reorderThreshold: true } })
  return supplies.filter(isLowStock).length
}

export function createSupply(orgId: string, input: CreateInput) {
  return orgDb(orgId).supply.create({
    data: {
      organizationId: orgId,
      name: input.name,
      unit: input.unit ?? "unit",
      currentStock: dec(input.currentStock) ?? ZERO,
      reorderThreshold: dec(input.reorderThreshold) ?? ZERO,
      costPerUnit: dec(input.costPerUnit),
    },
  })
}

/** Edit metadata only. Stock is NEVER set here — it changes via usage/adjust. */
export async function updateSupply(orgId: string, id: string, input: UpdateInput) {
  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name
  if (input.unit !== undefined) data.unit = input.unit
  if (input.reorderThreshold !== undefined) data.reorderThreshold = dec(input.reorderThreshold) ?? ZERO
  if (input.costPerUnit !== undefined) data.costPerUnit = dec(input.costPerUnit)
  const { count } = await orgDb(orgId).supply.updateMany({ where: { id }, data })
  if (count === 0) return null
  return getSupply(orgId, id)
}

/** Manual stock adjustment with a required reason (signed). Atomic. */
export async function adjustSupply(orgId: string, id: string, actorId: string, input: { delta: string; reason: string }) {
  const db = orgDb(orgId)
  const supply = await db.supply.findFirst({ where: { id }, select: { id: true, currentStock: true } })
  if (!supply) return null
  const delta = new Prisma.Decimal(input.delta)
  const next = supply.currentStock.plus(delta)
  if (next.lessThan(ZERO)) throw new ConflictError("That adjustment would make stock negative")
  await db.$transaction([
    db.supplyAdjustment.create({ data: { supplyId: id, delta, reason: input.reason, adjustedById: actorId } }),
    db.supply.updateMany({ where: { id }, data: { currentStock: next } }),
  ])
  return getSupply(orgId, id)
}

/**
 * Cleaner records supply usage on a job (one tap + quantity). Verifies the
 * cleaner is assigned to the job, logs the usage, and decrements stock (clamped
 * at 0 — physical stock never goes negative; over-draw is visible in the log).
 */
export async function recordSupplyUsage(
  orgId: string,
  userId: string,
  jobId: string,
  input: { supplyId: string; quantity: string },
) {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({
    where: { id: jobId, assignments: { some: { userId } } },
    select: { id: true, serviceLocationId: true },
  })
  if (!job) return null // not assigned / not found
  const supply = await db.supply.findFirst({ where: { id: input.supplyId }, select: { id: true, currentStock: true } })
  assertFound(supply, "Supply")

  const qty = new Prisma.Decimal(input.quantity)
  const next = supply!.currentStock.minus(qty)
  const clamped = next.lessThan(ZERO) ? ZERO : next
  await db.$transaction([
    db.supplyUsage.create({
      data: { organizationId: orgId, supplyId: input.supplyId, quantity: qty, jobId, serviceLocationId: job.serviceLocationId, recordedById: userId },
    }),
    db.supply.updateMany({ where: { id: input.supplyId }, data: { currentStock: clamped } }),
  ])
  return { ok: true }
}
