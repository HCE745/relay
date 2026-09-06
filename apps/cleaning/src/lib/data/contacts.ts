import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import type { z } from "zod"
import type { contactCreateSchema, contactUpdateSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof contactCreateSchema>
type UpdateInput = z.infer<typeof contactUpdateSchema>

/** Verify the customer belongs to this org before attaching a contact. */
async function assertCustomerInOrg(orgId: string, customerId: string) {
  const customer = await orgDb(orgId).customer.findFirst({ where: { id: customerId }, select: { id: true } })
  return assertFound(customer, "Customer")
}

export async function createContact(orgId: string, input: CreateInput) {
  await assertCustomerInOrg(orgId, input.customerId)
  const db = orgDb(orgId)
  if (input.isPrimary) {
    await db.contact.updateMany({ where: { customerId: input.customerId }, data: { isPrimary: false } })
  }
  return db.contact.create({
    data: {
      organizationId: orgId,
      customerId: input.customerId,
      name: input.name,
      title: input.title,
      email: input.email,
      phone: input.phone,
      isPrimary: input.isPrimary ?? false,
    },
  })
}

export async function updateContact(orgId: string, id: string, input: UpdateInput) {
  const db = orgDb(orgId)
  const existing = await db.contact.findFirst({ where: { id } })
  if (!existing) return null
  if (input.isPrimary) {
    await db.contact.updateMany({ where: { customerId: existing.customerId }, data: { isPrimary: false } })
  }
  const { count } = await db.contact.updateMany({ where: { id }, data: { ...input } })
  if (count === 0) return null
  return db.contact.findFirst({ where: { id } })
}

export async function deleteContact(orgId: string, id: string) {
  const { count } = await orgDb(orgId).contact.deleteMany({ where: { id } })
  return count > 0
}
