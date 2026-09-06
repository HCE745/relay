import { orgDb } from "../org-db"
import { assertFound } from "./errors"
import type { ReportProblemInput } from "../zod-schemas"

// Field "Report a Problem" — creates a minimal Cleaning Issue. Phase 5 expands
// this model (assignment, escalation, corrective actions); it is NOT replaced.

export async function reportProblem(orgId: string, jobId: string, reporterId: string, input: ReportProblemInput) {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({ where: { id: jobId }, select: { id: true, serviceLocationId: true } })
  assertFound(job, "Job")
  return db.issue.create({
    data: {
      organizationId: orgId,
      jobId,
      serviceLocationId: job!.serviceLocationId,
      reportedById: reporterId,
      category: input.category,
      title: input.title,
      description: input.description,
      status: "OPEN",
    },
  })
}

export function listJobIssues(orgId: string, jobId: string) {
  return orgDb(orgId).issue.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    include: { reportedBy: { select: { name: true } }, photos: { select: { id: true } } },
  })
}
