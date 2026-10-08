import { orgDb } from "../org-db"
import { evaluateIntake } from "./intake-eval"
import { acknowledgeIntakeFlags } from "./service-areas"
import type { z } from "zod"
import type { customerCreateSchema, customerUpdateSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof customerCreateSchema>
type UpdateInput = z.infer<typeof customerUpdateSchema>

export function listCustomers(orgId: string) {
  return orgDb(orgId).customer.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { serviceLocations: true, contacts: true } } },
  })
}

export function getCustomer(orgId: string, id: string) {
  return orgDb(orgId).customer.findFirst({
    where: { id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      serviceLocations: { orderBy: [{ isActive: "desc" }, { name: "asc" }] },
    },
  })
}

export async function createCustomer(orgId: string, input: CreateInput, actorId?: string) {
  // Check the do-not-serve exclusion lists by contact (Customer has no
  // structured address). WARN, never block — the customer is still created and
  // staff see a clear flag with the reason.
  const evalResult = await evaluateIntake(orgId, {
    contactName: input.primaryContactName ?? input.name, contactEmail: input.email, contactPhone: input.phone,
  })
  // organizationId is also force-set by the org-scoped client; passing it here
  // satisfies Prisma's create type and can never diverge from the session org.
  const customer = await orgDb(orgId).customer.create({ data: { ...input, organizationId: orgId } })
  if (actorId && evalResult.exclusions.length > 0) {
    await acknowledgeIntakeFlags(orgId, actorId, "Customer", customer.id, evalResult)
  }
  return { ...customer, intakeExclusions: evalResult.exclusions }
}

export async function updateCustomer(orgId: string, id: string, input: UpdateInput) {
  const db = orgDb(orgId)
  const { count } = await db.customer.updateMany({ where: { id }, data: { ...input } })
  if (count === 0) return null
  return db.customer.findFirst({ where: { id } })
}

/** Archive = soft delete (isActive=false). We never hard-delete customers. */
export async function archiveCustomer(orgId: string, id: string) {
  const { count } = await orgDb(orgId).customer.updateMany({ where: { id }, data: { isActive: false } })
  return count > 0
}
