import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import { Prisma } from "../../generated/prisma/client"
import type { IndirectPool } from "../indirect-costs"

// Indirect cost pool storage (Phase 45). Pools are management-reporting inputs:
// the profitability report spreads them across sites/customers/plans. Reads for
// the allocator return the pure IndirectPool shape the math consumes.

type PoolInput = {
  name: string
  category: "EQUIPMENT" | "INSURANCE" | "OVERHEAD" | "OTHER"
  amount: string
  periodDays?: number
  basis: "REVENUE" | "LABOR_COST" | "LABOR_HOURS" | "JOB_COUNT" | "EVEN"
  effectiveFrom?: Date | null
  effectiveTo?: Date | null
}

export async function listIndirectCostPools(orgId: string) {
  const pools = await orgDb(orgId).indirectCostPool.findMany({
    orderBy: [{ isActive: "desc" }, { category: "asc" }, { name: "asc" }],
  })
  return pools.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    amount: p.amount.toString(),
    periodDays: p.periodDays,
    basis: p.basis,
    effectiveFrom: p.effectiveFrom,
    effectiveTo: p.effectiveTo,
    isActive: p.isActive,
  }))
}

/** Active pools in the shape the allocation math (allocateIndirect) consumes. */
export async function activeIndirectPools(orgId: string): Promise<IndirectPool[]> {
  const pools = await orgDb(orgId).indirectCostPool.findMany({ where: { isActive: true } })
  return pools.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    amount: p.amount,
    periodDays: p.periodDays,
    basis: p.basis,
    effectiveFrom: p.effectiveFrom,
    effectiveTo: p.effectiveTo,
  }))
}

export async function createIndirectCostPool(orgId: string, input: PoolInput) {
  return orgDb(orgId).indirectCostPool.create({
    data: {
      organizationId: orgId,
      name: input.name,
      category: input.category,
      amount: new Prisma.Decimal(input.amount),
      periodDays: input.periodDays ?? 30,
      basis: input.basis,
      effectiveFrom: input.effectiveFrom ?? null,
      effectiveTo: input.effectiveTo ?? null,
    },
  })
}

export async function updateIndirectCostPool(
  orgId: string,
  id: string,
  input: Partial<PoolInput> & { isActive?: boolean },
) {
  const data: Prisma.IndirectCostPoolUncheckedUpdateManyInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.category !== undefined) data.category = input.category
  if (input.amount !== undefined) data.amount = new Prisma.Decimal(input.amount)
  if (input.periodDays !== undefined) data.periodDays = input.periodDays
  if (input.basis !== undefined) data.basis = input.basis
  if (input.effectiveFrom !== undefined) data.effectiveFrom = input.effectiveFrom
  if (input.effectiveTo !== undefined) data.effectiveTo = input.effectiveTo
  if (input.isActive !== undefined) data.isActive = input.isActive
  const res = await orgDb(orgId).indirectCostPool.updateMany({ where: { id }, data })
  assertFound(res.count > 0 ? {} : null, "Indirect cost pool")
  return orgDb(orgId).indirectCostPool.findFirst({ where: { id } })
}
