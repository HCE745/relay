import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import type { z } from "zod"
import type { serviceLocationCreateSchema, serviceLocationUpdateSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof serviceLocationCreateSchema>
type UpdateInput = z.infer<typeof serviceLocationUpdateSchema>

async function assertCustomerInOrg(orgId: string, customerId: string) {
  const customer = await orgDb(orgId).customer.findFirst({ where: { id: customerId }, select: { id: true } })
  return assertFound(customer, "Customer")
}

/** All sites across the org (for the top-level Sites list). */
export function listAllSites(orgId: string) {
  return orgDb(orgId).serviceLocation.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { customer: { select: { id: true, name: true } } },
  })
}

export function getServiceLocation(orgId: string, id: string) {
  return orgDb(orgId).serviceLocation.findFirst({
    where: { id },
    include: {
      customer: { select: { id: true, name: true } },
      servicePlans: {
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        include: { checklistTemplate: { select: { id: true, name: true, version: true } } },
      },
      inspections: {
        where: { status: "FINALIZED" },
        orderBy: { finalizedAt: "desc" },
        take: 10,
        include: { inspector: { select: { name: true } } },
      },
    },
  })
}

export async function createServiceLocation(orgId: string, input: CreateInput) {
  await assertCustomerInOrg(orgId, input.customerId)
  const { customerId, ...rest } = input
  return orgDb(orgId).serviceLocation.create({ data: { organizationId: orgId, customerId, ...rest } })
}

export async function updateServiceLocation(orgId: string, id: string, input: UpdateInput) {
  const db = orgDb(orgId)
  const { count } = await db.serviceLocation.updateMany({ where: { id }, data: { ...input } })
  if (count === 0) return null
  return db.serviceLocation.findFirst({ where: { id } })
}

export async function archiveServiceLocation(orgId: string, id: string) {
  const { count } = await orgDb(orgId).serviceLocation.updateMany({ where: { id }, data: { isActive: false } })
  return count > 0
}
