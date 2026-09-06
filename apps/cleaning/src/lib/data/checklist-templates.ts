import { orgDb } from "../org-db"
import type { z } from "zod"
import type {
  checklistTemplateCreateSchema,
  checklistTemplateUpdateSchema,
  checklistItemSchema,
} from "../zod-schemas"

type CreateInput = z.infer<typeof checklistTemplateCreateSchema>
type UpdateInput = z.infer<typeof checklistTemplateUpdateSchema>
type Item = z.infer<typeof checklistItemSchema>

const itemRow = (it: Item, i: number) => ({
  label: it.label,
  instructions: it.instructions,
  isRequired: it.isRequired ?? true,
  requirePhoto: it.requirePhoto ?? false,
  sortOrder: i,
})

const withItems = { items: { orderBy: { sortOrder: "asc" } } } as const

export function listChecklistTemplates(orgId: string) {
  return orgDb(orgId).checklistTemplate.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { items: true } } },
  })
}

export function getChecklistTemplate(orgId: string, id: string) {
  return orgDb(orgId).checklistTemplate.findFirst({ where: { id }, include: withItems })
}

export function createChecklistTemplate(orgId: string, input: CreateInput) {
  return orgDb(orgId).checklistTemplate.create({
    data: {
      organizationId: orgId,
      name: input.name,
      description: input.description,
      items: { create: input.items.map(itemRow) },
    },
    include: withItems,
  })
}

/**
 * Update a template. When `items` are supplied they REPLACE the existing set
 * and the version is bumped — historical Jobs (Phase 2) snapshot their own
 * checklist rows at instantiation, so bumping here never mutates completed work.
 */
export async function updateChecklistTemplate(orgId: string, id: string, input: UpdateInput) {
  const db = orgDb(orgId)
  const existing = await db.checklistTemplate.findFirst({ where: { id }, select: { id: true } })
  if (!existing) return null

  const { items, ...fields } = input
  await db.$transaction(async (tx) => {
    if (items) {
      await tx.checklistTemplateItem.deleteMany({ where: { templateId: id } })
      await tx.checklistTemplateItem.createMany({
        data: items.map((it, i) => ({ templateId: id, ...itemRow(it, i) })),
      })
    }
    await tx.checklistTemplate.updateMany({
      where: { id },
      data: { ...fields, ...(items ? { version: { increment: 1 } } : {}) },
    })
  })

  return db.checklistTemplate.findFirst({ where: { id }, include: withItems })
}

export async function archiveChecklistTemplate(orgId: string, id: string) {
  const { count } = await orgDb(orgId).checklistTemplate.updateMany({ where: { id }, data: { isActive: false } })
  return count > 0
}
