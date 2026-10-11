import { orgDb } from "../org-db"
import { assertFound, ForbiddenActionError, ReferenceError } from "./errors"
import type { z } from "zod"
import type { changeOrderCreateSchema } from "../zod-schemas"

type CreateInput = z.infer<typeof changeOrderCreateSchema>

export function listChangeOrders(orgId: string, opts: { jobId?: string; contractId?: string; status?: string } = {}) {
  return orgDb(orgId).changeOrder.findMany({
    where: {
      ...(opts.jobId ? { jobId: opts.jobId } : {}),
      ...(opts.contractId ? { contractId: opts.contractId } : {}),
      ...(opts.status ? { status: opts.status as "PENDING" } : {}),
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function createChangeOrder(orgId: string, input: CreateInput, createdById: string) {
  // Validate the parent belongs to this org (org-scoped findFirst → null if not).
  if (input.jobId) {
    const job = await orgDb(orgId).job.findFirst({ where: { id: input.jobId }, select: { id: true } })
    if (!job) throw new ReferenceError("That job doesn't exist")
  }
  if (input.contractId) {
    const contract = await orgDb(orgId).contract.findFirst({ where: { id: input.contractId }, select: { id: true } })
    if (!contract) throw new ReferenceError("That contract doesn't exist")
  }
  return orgDb(orgId).changeOrder.create({
    data: {
      organizationId: orgId, jobId: input.jobId, contractId: input.contractId,
      description: input.description, amount: input.amount,
      requiresCustomerApproval: input.requiresCustomerApproval ?? true,
      createdById,
    },
  })
}

/** Manager records the decision (approve/decline). The fallback when the
 *  customer portal isn't in use — the staff approval of record. */
export async function recordChangeOrderDecision(orgId: string, id: string, decision: "APPROVED" | "DECLINED", actorUserId: string) {
  const co = await orgDb(orgId).changeOrder.findFirst({ where: { id }, select: { status: true } })
  assertFound(co, "Change order")
  if (co!.status !== "PENDING") throw new ForbiddenActionError(`This extra is already ${co!.status.toLowerCase()}`)
  await orgDb(orgId).changeOrder.updateMany({
    where: { id, status: "PENDING" },
    data: decision === "APPROVED"
      ? { status: "APPROVED", approvedByUserId: actorUserId, approvedByPortal: false, approvedAt: new Date() }
      : { status: "DECLINED", declinedAt: new Date() },
  })
  return orgDb(orgId).changeOrder.findFirst({ where: { id } })
}

/** Customer self-service approval via the portal. Verifies the extra belongs to
 *  THIS customer (through its job's site or its contract) before deciding. */
export async function portalDecideChangeOrder(orgId: string, customerId: string, id: string, decision: "APPROVED" | "DECLINED") {
  const co = await orgDb(orgId).changeOrder.findFirst({
    where: {
      id,
      requiresCustomerApproval: true,
      OR: [
        { job: { serviceLocation: { customerId } } },
        { contract: { customerId } },
      ],
    },
    select: { id: true, status: true },
  })
  if (!co) throw new ReferenceError("That extra isn't available to approve")
  if (co.status !== "PENDING") throw new ForbiddenActionError(`This extra is already ${co.status.toLowerCase()}`)
  await orgDb(orgId).changeOrder.updateMany({
    where: { id, status: "PENDING" },
    data: decision === "APPROVED"
      ? { status: "APPROVED", approvedByPortal: true, approvedAt: new Date() }
      : { status: "DECLINED", declinedAt: new Date() },
  })
  return orgDb(orgId).changeOrder.findFirst({ where: { id }, select: { id: true, status: true } })
}

/** Pending extras a customer can act on in the portal. */
export function listPendingExtrasForCustomer(orgId: string, customerId: string) {
  return orgDb(orgId).changeOrder.findMany({
    where: {
      status: "PENDING", requiresCustomerApproval: true,
      OR: [{ job: { serviceLocation: { customerId } } }, { contract: { customerId } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, description: true, amount: true, createdAt: true },
  })
}
