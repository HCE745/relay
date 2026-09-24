import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import type { z } from "zod"
import type { leadCreateSchema, leadUpdateSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof leadCreateSchema>
type UpdateInput = z.infer<typeof leadUpdateSchema>

const leadInclude = {
  assignedTo: { select: { id: true, name: true } },
  _count: { select: { estimates: true } },
} as const

async function assertAssignee(orgId: string, userId: string) {
  const u = await orgDb(orgId).user.findFirst({ where: { id: userId }, select: { id: true } })
  return assertFound(u, "Assignee")
}

export function listLeads(orgId: string) {
  return orgDb(orgId).lead.findMany({ orderBy: { createdAt: "desc" }, include: leadInclude })
}

export async function createLead(orgId: string, input: CreateInput) {
  if (input.assignedToId) await assertAssignee(orgId, input.assignedToId)
  return orgDb(orgId).lead.create({ data: { ...input, organizationId: orgId } })
}

export async function updateLead(orgId: string, id: string, input: UpdateInput) {
  if (input.assignedToId) await assertAssignee(orgId, input.assignedToId)
  const { count } = await orgDb(orgId).lead.updateMany({ where: { id }, data: { ...input } })
  if (count === 0) return null
  return orgDb(orgId).lead.findFirst({ where: { id }, include: leadInclude })
}
