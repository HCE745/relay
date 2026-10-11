import { orgDb } from "../org-db"
import { assertFound, ConflictError, ReferenceError, RequirementsError } from "./errors"
import { updateJob, cancelJob } from "./jobs"

// Portal self-service requests (Phase 28). A customer asks to reschedule/cancel;
// staff approve, which performs the real schedule change — never direct mutation.

type CreateInput = { jobId: string; type: "RESCHEDULE" | "CANCEL"; requestedDate?: string; requestedTime?: string; note?: string }

/** Portal-initiated. Verifies the job belongs to THIS customer. */
export async function createServiceRequest(orgId: string, customerId: string, input: CreateInput) {
  const job = await orgDb(orgId).job.findFirst({
    where: { id: input.jobId, serviceLocation: { customerId }, status: { in: ["SCHEDULED", "ASSIGNED"] } },
    select: { id: true },
  })
  if (!job) throw new ReferenceError("That job isn't available to change")
  if (input.type === "RESCHEDULE" && (!input.requestedDate || !input.requestedTime)) {
    throw new RequirementsError("A requested date and time are required to reschedule", ["Pick a new date and time"])
  }
  // Collapse duplicate open requests for the same job.
  const open = await orgDb(orgId).serviceRequest.findFirst({ where: { jobId: input.jobId, status: "PENDING" }, select: { id: true } })
  if (open) throw new ConflictError("There's already a pending request for this visit")
  return orgDb(orgId).serviceRequest.create({
    data: { organizationId: orgId, customerId, jobId: input.jobId, type: input.type, requestedDate: input.requestedDate, requestedTime: input.requestedTime, note: input.note },
  })
}

export function listServiceRequests(orgId: string, opts: { status?: string } = {}) {
  return orgDb(orgId).serviceRequest.findMany({
    where: opts.status ? { status: opts.status as "PENDING" } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { customer: { select: { name: true } }, job: { select: { title: true, scheduledStart: true, serviceLocation: { select: { name: true } } } } },
  })
}

export function listPortalServiceRequests(orgId: string, customerId: string) {
  return orgDb(orgId).serviceRequest.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, jobId: true, type: true, status: true, requestedDate: true, createdAt: true } })
}

export function countPendingServiceRequests(orgId: string) {
  return orgDb(orgId).serviceRequest.count({ where: { status: "PENDING" } })
}

/** Staff review. Approving performs the real reschedule/cancel. */
export async function reviewServiceRequest(orgId: string, id: string, approve: boolean, reviewerId: string) {
  const req = await orgDb(orgId).serviceRequest.findFirst({ where: { id }, select: { id: true, type: true, jobId: true, requestedDate: true, requestedTime: true, status: true } })
  assertFound(req, "Service request")
  if (req!.status !== "PENDING") throw new ConflictError("This request was already reviewed")

  if (approve) {
    if (req!.type === "RESCHEDULE" && req!.requestedDate && req!.requestedTime) {
      await updateJob(orgId, req!.jobId, { date: req!.requestedDate, startTime: req!.requestedTime })
    } else if (req!.type === "CANCEL") {
      await cancelJob(orgId, req!.jobId)
    }
  }
  await orgDb(orgId).serviceRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: approve ? "APPROVED" : "DECLINED", reviewedByUserId: reviewerId, reviewedAt: new Date() },
  })
  return orgDb(orgId).serviceRequest.findFirst({ where: { id } })
}
