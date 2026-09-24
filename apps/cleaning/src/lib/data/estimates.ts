import { orgDb } from "../org-db"
import { assertFound, ConflictError } from "./errors"
import { Prisma } from "../../generated/prisma/client"
import { lineAmount, estimateTotal, planPricingFromEstimate } from "../estimate-pricing"
import type { z } from "zod"
import type { estimateCreateSchema, estimateUpdateSchema, ESTIMATE_STATUSES } from "../zod-schemas"

type CreateInput = z.infer<typeof estimateCreateSchema>
type UpdateInput = z.infer<typeof estimateUpdateSchema>
type EstimateStatus = (typeof ESTIMATE_STATUSES)[number]

const estimateInclude = {
  lead: { select: { id: true, name: true, company: true } },
  customer: { select: { id: true, name: true } },
  convertedCustomer: { select: { id: true, name: true } },
  checklistTemplate: { select: { id: true, name: true } },
  lines: { orderBy: { sortOrder: "asc" as const } },
} as const

async function assertOrgFks(orgId: string, input: { leadId?: string; customerId?: string; checklistTemplateId?: string }) {
  const db = orgDb(orgId)
  if (input.leadId) assertFound(await db.lead.findFirst({ where: { id: input.leadId }, select: { id: true } }), "Lead")
  if (input.customerId) assertFound(await db.customer.findFirst({ where: { id: input.customerId }, select: { id: true } }), "Customer")
  if (input.checklistTemplateId)
    assertFound(await db.checklistTemplate.findFirst({ where: { id: input.checklistTemplateId }, select: { id: true } }), "Checklist template")
}

function buildLines(lines: CreateInput["lines"]) {
  return lines.map((l, i) => {
    const quantity = new Prisma.Decimal(l.quantity)
    const unitRate = new Prisma.Decimal(l.unitRate)
    return { description: l.description, quantity, unitRate, amount: lineAmount(quantity, unitRate), sortOrder: i }
  })
}

const toDate = (d?: string) => (d ? new Date(`${d}T00:00:00.000Z`) : null)

export function listEstimates(orgId: string, filter: { status?: string } = {}) {
  return orgDb(orgId).estimate.findMany({
    where: filter.status ? { status: filter.status as EstimateStatus } : {},
    orderBy: { createdAt: "desc" },
    include: estimateInclude,
  })
}

export function getEstimate(orgId: string, id: string) {
  return orgDb(orgId).estimate.findFirst({ where: { id }, include: estimateInclude })
}

export async function createEstimate(orgId: string, input: CreateInput) {
  await assertOrgFks(orgId, input)
  const lines = buildLines(input.lines)
  const subtotal = estimateTotal(lines)
  return orgDb(orgId).estimate.create({
    data: {
      organizationId: orgId,
      leadId: input.leadId ?? null,
      customerId: input.customerId ?? null,
      title: input.title,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      siteName: input.siteName,
      addressLine1: input.addressLine1,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      frequency: input.frequency ?? "WEEKLY",
      pricing: input.pricing ?? "PER_VISIT",
      rate: input.rate != null ? new Prisma.Decimal(input.rate) : null,
      currency: input.currency ?? "USD",
      checklistTemplateId: input.checklistTemplateId ?? null,
      validUntil: toDate(input.validUntil),
      notes: input.notes,
      subtotal,
      total: subtotal,
      lines: { create: lines },
    },
    include: estimateInclude,
  })
}

/** Load an estimate for mutation, refusing once it has been converted (read-only). */
async function assertEditable(orgId: string, id: string) {
  const est = await orgDb(orgId).estimate.findFirst({ where: { id }, select: { id: true, convertedCustomerId: true } })
  if (!est) return null
  if (est.convertedCustomerId) throw new ConflictError("A converted estimate is read-only")
  return est
}

export async function updateEstimate(orgId: string, id: string, input: UpdateInput) {
  const db = orgDb(orgId)
  const editable = await assertEditable(orgId, id)
  if (!editable) return null
  await assertOrgFks(orgId, input)

  const data: Record<string, unknown> = {}
  const scalars: (keyof UpdateInput)[] = [
    "leadId", "customerId", "title", "contactName", "contactEmail", "contactPhone",
    "siteName", "addressLine1", "city", "state", "postalCode", "frequency", "pricing", "currency", "checklistTemplateId", "notes", "status",
  ]
  for (const k of scalars) if (input[k] !== undefined) data[k] = input[k]
  if (input.rate !== undefined) data.rate = input.rate ? new Prisma.Decimal(input.rate) : null
  if (input.validUntil !== undefined) data.validUntil = toDate(input.validUntil)

  const lines = input.lines ? buildLines(input.lines) : null
  if (lines) {
    const subtotal = estimateTotal(lines)
    data.subtotal = subtotal
    data.total = subtotal
  }

  await db.$transaction(async (tx) => {
    await tx.estimate.updateMany({ where: { id }, data })
    if (lines) {
      await tx.estimateLine.deleteMany({ where: { estimateId: id } })
      await tx.estimateLine.createMany({ data: lines.map((l) => ({ ...l, estimateId: id })) })
    }
  })
  return getEstimate(orgId, id)
}

export async function setEstimateStatus(orgId: string, id: string, status: EstimateStatus) {
  const editable = await assertEditable(orgId, id)
  if (!editable) return null
  await orgDb(orgId).estimate.updateMany({ where: { id }, data: { status } })
  return getEstimate(orgId, id)
}

export type ConvertResult = { customerId: string; serviceLocationId: string; servicePlanId: string }

/**
 * Convert an ACCEPTED estimate into a live Customer + ServiceLocation +
 * ServicePlan in ONE atomic transaction. Either all three exist afterward or
 * none do — there is never an orphaned customer with no site/plan. The plan
 * carries the estimate's billingType + rate (see planPricingFromEstimate) so
 * Phase 2 invoicing works with no re-entry. The estimate becomes read-only and
 * is permanently linked to the customer it created.
 */
export async function convertEstimate(orgId: string, id: string): Promise<ConvertResult> {
  const db = orgDb(orgId)
  const est = await db.estimate.findFirst({
    where: { id },
    include: { lead: { select: { id: true, company: true, name: true } }, lines: { select: { amount: true } } },
  })
  assertFound(est, "Estimate")
  if (est!.convertedCustomerId) throw new ConflictError("This estimate has already been converted")
  if (est!.status !== "ACCEPTED") throw new ConflictError("Only an accepted estimate can be converted")

  // Map pricing → plan billing FIRST — this throws (→ 422) rather than guessing
  // if the estimate's pricing can't map cleanly, before any writes happen.
  const total = estimateTotal(est!.lines)
  const { billingType, rate } = planPricingFromEstimate({ pricing: est!.pricing, rate: est!.rate, total })

  const customerName =
    est!.lead?.company?.trim() || est!.contactName?.trim() || est!.siteName?.trim() || est!.title
  const now = new Date()

  return db.$transaction(async (tx) => {
    // 1) Customer — reuse an existing one, else create it.
    let customerId: string
    if (est!.customerId) {
      const existing = await tx.customer.findFirst({ where: { id: est!.customerId }, select: { id: true } })
      customerId = assertFound(existing, "Customer").id
    } else {
      const created = await tx.customer.create({
        data: {
          organizationId: orgId,
          name: customerName,
          primaryContactName: est!.contactName ?? undefined,
          email: est!.contactEmail ?? undefined,
          phone: est!.contactPhone ?? undefined,
          billingEmail: est!.contactEmail ?? undefined,
        },
      })
      customerId = created.id
    }

    // 2) ServiceLocation
    const site = await tx.serviceLocation.create({
      data: {
        organizationId: orgId,
        customerId,
        name: est!.siteName?.trim() || "Main site",
        addressLine1: est!.addressLine1 ?? undefined,
        city: est!.city ?? undefined,
        state: est!.state ?? undefined,
        postalCode: est!.postalCode ?? undefined,
      },
    })

    // 3) ServicePlan — carries billingType + rate from the estimate; scope carries via template.
    if (est!.checklistTemplateId) {
      assertFound(await tx.checklistTemplate.findFirst({ where: { id: est!.checklistTemplateId }, select: { id: true } }), "Checklist template")
    }
    const plan = await tx.servicePlan.create({
      data: {
        organizationId: orgId,
        serviceLocationId: site.id,
        name: est!.title,
        frequency: est!.frequency,
        billingType,
        rate,
        currency: est!.currency,
        checklistTemplateId: est!.checklistTemplateId ?? undefined,
      },
    })

    // 4) Lock the estimate to the customer it created (read-only from here on).
    await tx.estimate.updateMany({ where: { id }, data: { convertedCustomerId: customerId, convertedAt: now } })
    if (est!.leadId) await tx.lead.updateMany({ where: { id: est!.leadId }, data: { status: "WON" } })

    return { customerId, serviceLocationId: site.id, servicePlanId: plan.id }
  })
}
