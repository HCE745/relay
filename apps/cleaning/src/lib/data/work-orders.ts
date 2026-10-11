import { orgDb } from "../org-db"
import { assertFound, ForbiddenActionError, RequirementsError, ConflictError } from "./errors"
import { getOrgTimezone } from "./org"
import { wallTimeToInstant } from "../scheduling/time"
import type { z } from "zod"
import type { workOrderCreateSchema, workOrderUpdateSchema, workOrderConvertSchema, issueToWorkOrderSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof workOrderCreateSchema>
type UpdateInput = z.infer<typeof workOrderUpdateSchema>
type ConvertInput = z.infer<typeof workOrderConvertSchema>
type IssueConvertInput = z.infer<typeof issueToWorkOrderSchema>

export function listWorkOrders(orgId: string, opts: { status?: string } = {}) {
  return orgDb(orgId).workOrder.findMany({
    where: opts.status ? { status: opts.status as "REQUESTED" } : {},
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    include: {
      customer: { select: { name: true } },
      serviceLocation: { select: { name: true } },
      convertedJob: { select: { id: true, status: true } },
    },
  })
}

export function getWorkOrder(orgId: string, id: string) {
  return orgDb(orgId).workOrder.findFirst({ where: { id }, include: { customer: { select: { name: true } }, serviceLocation: { select: { name: true } } } })
}

export function createWorkOrder(orgId: string, input: CreateInput, createdById: string) {
  return orgDb(orgId).workOrder.create({
    data: {
      organizationId: orgId, customerId: input.customerId, serviceLocationId: input.serviceLocationId,
      type: input.type, description: input.description, requestedBy: input.requestedBy,
      priority: input.priority ?? "NORMAL", quotedAmount: input.quotedAmount ?? null,
      status: input.quotedAmount != null ? "QUOTED" : "REQUESTED", createdById,
    },
  })
}

export async function updateWorkOrder(orgId: string, id: string, input: UpdateInput, actorId: string) {
  const wo = await orgDb(orgId).workOrder.findFirst({ where: { id }, select: { convertedJobId: true } })
  if (!wo) return null
  if (wo.convertedJobId) throw new ForbiddenActionError("This work order was converted to a job and is read-only")
  const data: Record<string, unknown> = { ...input }
  if (input.status === "APPROVED") { data.approvedById = actorId; data.approvedAt = new Date() }
  await orgDb(orgId).workOrder.updateMany({ where: { id }, data })
  return orgDb(orgId).workOrder.findFirst({ where: { id } })
}

/**
 * Convert a work order into a scheduled, BILLABLE manual job — atomically. The
 * job carries its own rate (the provided rate, else the quoted amount), so it
 * flows through normal invoicing. One-shot: a converted work order is read-only.
 */
export async function convertWorkOrderToJob(orgId: string, id: string, input: ConvertInput) {
  const wo = await orgDb(orgId).workOrder.findFirst({ where: { id } })
  assertFound(wo, "Work order")
  if (wo!.convertedJobId) throw new ForbiddenActionError("This work order has already been converted")
  if (wo!.status === "DECLINED") throw new ForbiddenActionError("A declined work order can't be scheduled")
  if (!wo!.serviceLocationId) throw new RequirementsError("A site is required to schedule the work", ["Set the work order's service location first"])
  const rate = input.rate ?? wo!.quotedAmount
  if (rate == null) throw new RequirementsError("A rate is required to schedule billable work", ["Quote the work order, or enter a rate when scheduling"])

  const orgTz = await getOrgTimezone(orgId)
  const site = await orgDb(orgId).serviceLocation.findFirst({ where: { id: wo!.serviceLocationId! }, select: { timezone: true } })
  const tz = site?.timezone ?? orgTz
  const start = wallTimeToInstant(input.date, input.startTime, tz)
  const end = input.durationMin ? new Date(start.getTime() + input.durationMin * 60_000) : null

  const jobId = await orgDb(orgId).$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        organizationId: orgId, serviceLocationId: wo!.serviceLocationId!, servicePlanId: null,
        title: wo!.description.slice(0, 200), status: "SCHEDULED",
        scheduledStart: start, scheduledEnd: end, crewSize: input.crewSize,
        billingType: input.billingType ?? "FLAT_PER_JOB", rate, currency: "USD",
      },
      select: { id: true },
    })
    await tx.workOrder.updateMany({ where: { id }, data: { convertedJobId: job.id, status: "SCHEDULED" } })
    return job.id
  })
  return { jobId }
}

/**
 * Turn a complaint (Issue) into a billable WorkOrder — a complaint becomes
 * billable remediation where appropriate. One work order per issue (unique).
 */
export async function convertIssueToWorkOrder(orgId: string, issueId: string, input: IssueConvertInput, createdById: string) {
  const issue = await orgDb(orgId).issue.findFirst({
    where: { id: issueId },
    select: { id: true, description: true, serviceLocationId: true, workOrder: { select: { id: true } }, serviceLocation: { select: { customerId: true } }, job: { select: { serviceLocation: { select: { customerId: true, id: true } } } } },
  })
  assertFound(issue, "Issue")
  if (issue!.workOrder) throw new ConflictError("This issue already has a work order")
  const customerId = issue!.serviceLocation?.customerId ?? issue!.job?.serviceLocation.customerId
  const serviceLocationId = issue!.serviceLocationId ?? issue!.job?.serviceLocation.id ?? undefined
  if (!customerId) throw new RequirementsError("Can't tell which customer this is for", ["Link the issue to a site or job first"])

  return orgDb(orgId).workOrder.create({
    data: {
      organizationId: orgId, customerId, serviceLocationId,
      type: input.type ?? "ADDITIONAL", description: input.description ?? issue!.description,
      priority: input.priority ?? "NORMAL", quotedAmount: input.quotedAmount ?? null,
      status: input.quotedAmount != null ? "QUOTED" : "REQUESTED",
      issueId: issue!.id, createdById,
    },
  })
}
