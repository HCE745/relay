import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import { DEFAULT_PRODUCTION_RATES } from "../bid-math"
import type { z } from "zod"
import type { productionRateCreateSchema, productionRateUpdateSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof productionRateCreateSchema>
type UpdateInput = z.infer<typeof productionRateUpdateSchema>

export function listProductionRates(orgId: string, opts: { activeOnly?: boolean } = {}) {
  return orgDb(orgId).productionRate.findMany({
    where: opts.activeOnly ? { isActive: true } : {},
    orderBy: [{ taskType: "asc" }, { surfaceType: "asc" }],
  })
}

/** Seed the org's library from industry defaults — only if it has none yet. */
export async function seedDefaultProductionRates(orgId: string) {
  const existing = await orgDb(orgId).productionRate.count()
  if (existing > 0) return { seeded: 0 }
  await orgDb(orgId).productionRate.createMany({
    data: DEFAULT_PRODUCTION_RATES.map((r) => ({ ...r, organizationId: orgId })),
  })
  return { seeded: DEFAULT_PRODUCTION_RATES.length }
}

export function createProductionRate(orgId: string, input: CreateInput) {
  return orgDb(orgId).productionRate.create({ data: { ...input, organizationId: orgId } })
}

export async function updateProductionRate(orgId: string, id: string, input: UpdateInput) {
  const { count } = await orgDb(orgId).productionRate.updateMany({ where: { id }, data: { ...input } })
  if (count === 0) return null
  return assertFound(await orgDb(orgId).productionRate.findFirst({ where: { id } }), "Production rate")
}

export async function archiveProductionRate(orgId: string, id: string) {
  const { count } = await orgDb(orgId).productionRate.updateMany({ where: { id }, data: { isActive: false } })
  return count > 0
}
