import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import type { z } from "zod"
import type { servicePlanCreateSchema, servicePlanUpdateSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof servicePlanCreateSchema>
type UpdateInput = z.infer<typeof servicePlanUpdateSchema>

async function assertLocationInOrg(orgId: string, serviceLocationId: string) {
  const loc = await orgDb(orgId).serviceLocation.findFirst({ where: { id: serviceLocationId }, select: { id: true } })
  return assertFound(loc, "Service location")
}

async function assertTemplateInOrg(orgId: string, checklistTemplateId: string) {
  const tpl = await orgDb(orgId).checklistTemplate.findFirst({ where: { id: checklistTemplateId }, select: { id: true } })
  return assertFound(tpl, "Checklist template")
}

export function getServicePlan(orgId: string, id: string) {
  return orgDb(orgId).servicePlan.findFirst({
    where: { id },
    include: {
      serviceLocation: { select: { id: true, name: true, customerId: true } },
      checklistTemplate: { select: { id: true, name: true, version: true } },
    },
  })
}

export async function createServicePlan(orgId: string, input: CreateInput) {
  await assertLocationInOrg(orgId, input.serviceLocationId)
  if (input.checklistTemplateId) await assertTemplateInOrg(orgId, input.checklistTemplateId)
  return orgDb(orgId).servicePlan.create({ data: { ...input, organizationId: orgId } })
}

export async function updateServicePlan(orgId: string, id: string, input: UpdateInput) {
  const db = orgDb(orgId)
  if (input.checklistTemplateId) await assertTemplateInOrg(orgId, input.checklistTemplateId)
  const { count } = await db.servicePlan.updateMany({ where: { id }, data: { ...input } })
  if (count === 0) return null
  return getServicePlan(orgId, id)
}

export async function archiveServicePlan(orgId: string, id: string) {
  const { count } = await orgDb(orgId).servicePlan.updateMany({ where: { id }, data: { isActive: false } })
  return count > 0
}
