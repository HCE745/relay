import { orgDb } from "../org-db"
import type { z } from "zod"
import type { inspectionTemplateCreateSchema, inspectionTemplateUpdateSchema, inspectionItemSchema } from "../zod-schemas"

// z.input so callers may omit fields that have Zod defaults (itemRow fills them).
type CreateInput = z.input<typeof inspectionTemplateCreateSchema>
type UpdateInput = z.input<typeof inspectionTemplateUpdateSchema>
type Item = z.input<typeof inspectionItemSchema>

const itemRow = (it: Item, i: number) => ({
  label: it.label,
  instructions: it.instructions,
  points: it.points ?? 1,
  isCritical: it.isCritical ?? false,
  requirePhoto: it.requirePhoto ?? false,
  sortOrder: i,
})

const withItems = { items: { orderBy: { sortOrder: "asc" } } } as const

export function listInspectionTemplates(orgId: string) {
  return orgDb(orgId).inspectionTemplate.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { items: true } } },
  })
}

export function getInspectionTemplate(orgId: string, id: string) {
  return orgDb(orgId).inspectionTemplate.findFirst({ where: { id }, include: withItems })
}

export function createInspectionTemplate(orgId: string, input: CreateInput) {
  return orgDb(orgId).inspectionTemplate.create({
    data: {
      organizationId: orgId,
      name: input.name,
      passThreshold: input.passThreshold ?? 80,
      items: { create: input.items.map(itemRow) },
    },
    include: withItems,
  })
}

export async function updateInspectionTemplate(orgId: string, id: string, input: UpdateInput) {
  const db = orgDb(orgId)
  const existing = await db.inspectionTemplate.findFirst({ where: { id }, select: { id: true } })
  if (!existing) return null

  const { items, ...fields } = input
  await db.$transaction(async (tx) => {
    if (items) {
      await tx.inspectionTemplateItem.deleteMany({ where: { templateId: id } })
      await tx.inspectionTemplateItem.createMany({ data: items.map((it, i) => ({ templateId: id, ...itemRow(it, i) })) })
    }
    await tx.inspectionTemplate.updateMany({ where: { id }, data: { ...fields } })
  })
  return db.inspectionTemplate.findFirst({ where: { id }, include: withItems })
}

export async function archiveInspectionTemplate(orgId: string, id: string) {
  const { count } = await orgDb(orgId).inspectionTemplate.updateMany({ where: { id }, data: { isActive: false } })
  return count > 0
}
