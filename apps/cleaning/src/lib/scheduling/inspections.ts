import { orgDb, isUniqueViolation } from "../org-db"
import { assertFound, ConflictError, RequirementsError } from "../data/errors"
import { recordAudit } from "../data/audit"
import { scoreInspection, type ResultValue } from "./scoring"

// Inspection lifecycle. An Inspection snapshots its template + items at creation,
// so later template edits never change historical results. Finalization computes
// the score once (stored), and a FAIL creates exactly one linked QUALITY Issue
// (idempotent via the Issue.inspectionId unique constraint).

export async function createInspectionFromJob(orgId: string, jobId: string, inspectorId: string, templateId: string) {
  const db = orgDb(orgId)
  const job = await db.job.findFirst({ where: { id: jobId }, select: { id: true, serviceLocationId: true, status: true } })
  assertFound(job, "Job")
  if (job!.status === "CANCELLED") throw new ConflictError("Cannot inspect a cancelled job")

  const template = await db.inspectionTemplate.findFirst({
    where: { id: templateId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  })
  assertFound(template, "Inspection template")
  if (!template!.items.length) throw new ConflictError("This template has no items")

  return db.inspection.create({
    data: {
      organizationId: orgId,
      serviceLocationId: job!.serviceLocationId,
      jobId,
      inspectorId,
      templateId,
      templateName: template!.name,
      passThreshold: template!.passThreshold,
      status: "DRAFT",
      results: {
        create: template!.items.map((it) => ({
          label: it.label,
          instructions: it.instructions,
          points: it.points,
          isCritical: it.isCritical,
          requirePhoto: it.requirePhoto,
          sortOrder: it.sortOrder,
        })),
      },
    },
    include: { results: { orderBy: { sortOrder: "asc" } } },
  })
}

const inspectionInclude = {
  results: { orderBy: { sortOrder: "asc" }, include: { photos: { select: { id: true } } } },
  inspector: { select: { name: true } },
  serviceLocation: { select: { id: true, name: true, customerId: true, customer: { select: { name: true } } } },
  job: { select: { id: true, title: true } },
  issue: { select: { id: true } },
} as const

export function getInspection(orgId: string, id: string) {
  return orgDb(orgId).inspection.findFirst({ where: { id }, include: inspectionInclude })
}

export async function setInspectionItemResult(
  orgId: string,
  inspectionId: string,
  resultId: string,
  patch: { result?: ResultValue; note?: string },
) {
  const db = orgDb(orgId)
  const insp = await db.inspection.findFirst({ where: { id: inspectionId }, select: { status: true } })
  assertFound(insp, "Inspection")
  if (insp!.status === "FINALIZED") throw new ConflictError("This inspection is finalized and cannot be edited")

  const item = await db.inspectionItemResult.findFirst({ where: { id: resultId, inspectionId }, select: { id: true } })
  assertFound(item, "Inspection item")

  const data: Record<string, unknown> = {}
  if (patch.result !== undefined) data.result = patch.result
  if (patch.note !== undefined) data.note = patch.note
  await db.inspectionItemResult.updateMany({ where: { id: resultId, inspectionId }, data })
  return db.inspectionItemResult.findFirst({ where: { id: resultId, inspectionId } })
}

export type FinalizeResult = {
  score: number
  outcome: "PASS" | "FAIL"
  issueId: string | null
  alreadyFinalized: boolean
}

export async function finalizeInspection(
  orgId: string,
  inspectionId: string,
  actorId: string,
  comments?: string,
): Promise<FinalizeResult> {
  const db = orgDb(orgId)
  const insp = await db.inspection.findFirst({
    where: { id: inspectionId },
    include: { results: true, issue: { select: { id: true } } },
  })
  assertFound(insp, "Inspection")

  // Idempotent: finalizing again is a no-op that returns the stored outcome.
  if (insp!.status === "FINALIZED") {
    return { score: insp!.score ?? 0, outcome: insp!.outcome ?? "FAIL", issueId: insp!.issue?.id ?? null, alreadyFinalized: true }
  }

  // Every item must be scored, and photo-required items need a photo.
  const unscored = insp!.results.filter((r) => r.result === null).map((r) => `Score: ${r.label}`)
  if (unscored.length) throw new RequirementsError("Score every item before finalizing", unscored)

  const photoNeeded = insp!.results.filter((r) => r.requirePhoto && r.result !== "NA")
  if (photoNeeded.length) {
    const photos = await db.jobPhoto.findMany({
      where: { inspectionItemResultId: { in: photoNeeded.map((r) => r.id) } },
      select: { inspectionItemResultId: true },
    })
    const withPhoto = new Set(photos.map((p) => p.inspectionItemResultId))
    const unmet = photoNeeded.filter((r) => !withPhoto.has(r.id)).map((r) => `Photo required: ${r.label}`)
    if (unmet.length) throw new RequirementsError("Attach required photos before finalizing", unmet)
  }

  const { score, outcome } = scoreInspection(
    insp!.results.map((r) => ({ points: r.points, isCritical: r.isCritical, result: r.result })),
    insp!.passThreshold,
  )
  const now = new Date()
  await db.inspection.updateMany({
    where: { id: inspectionId },
    data: { status: "FINALIZED", score, outcome, comments, finalizedAt: now },
  })
  await recordAudit(orgId, actorId, "Inspection", inspectionId, "finalize", { metadata: { score, outcome } })

  // FAIL → create exactly one linked Issue (idempotent via unique inspectionId).
  let issueId: string | null = null
  if (outcome === "FAIL") {
    const failed = insp!.results.filter((r) => r.result === "FAIL")
    const description =
      `Failed inspection (${score}%). ` +
      (failed.length ? `Failed items: ${failed.map((f) => f.label).join(", ")}.` : "Below passing threshold.")
    try {
      const issue = await db.issue.create({
        data: {
          organizationId: orgId,
          jobId: insp!.jobId,
          serviceLocationId: insp!.serviceLocationId,
          inspectionId,
          reportedById: actorId,
          category: "QUALITY",
          title: "Failed inspection",
          description,
          status: "OPEN",
        },
      })
      issueId = issue.id
    } catch (e) {
      if (isUniqueViolation(e)) {
        const existing = await db.issue.findFirst({ where: { inspectionId }, select: { id: true } })
        issueId = existing?.id ?? null
      } else throw e
    }
  }

  return { score, outcome, issueId, alreadyFinalized: false }
}

export function listInspectionsForJob(orgId: string, jobId: string) {
  return orgDb(orgId).inspection.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    include: { inspector: { select: { name: true } } },
  })
}

export function listRecentInspections(orgId: string, take = 25) {
  return orgDb(orgId).inspection.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      inspector: { select: { name: true } },
      serviceLocation: { select: { name: true, customer: { select: { name: true } } } },
      job: { select: { id: true } },
    },
  })
}

export function listInspectionsForSite(orgId: string, serviceLocationId: string, take = 10) {
  return orgDb(orgId).inspection.findMany({
    where: { serviceLocationId, status: "FINALIZED" },
    orderBy: { finalizedAt: "desc" },
    take,
    include: { inspector: { select: { name: true } } },
  })
}
