import { randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { orgDb, systemDb } from "../org-db"
import { assertFound, ForbiddenActionError, ReferenceError, ConflictError, RequirementsError } from "./errors"
import { enforceIntakeLimits, INTAKE_LIMITS } from "../public-intake"
import type { z } from "zod"
import type { jobPostingCreateSchema, applicantCreateSchema, publicApplicationSchema, interviewCreateSchema, convertApplicantSchema } from "../zod-schemas"

type PostingInput = z.infer<typeof jobPostingCreateSchema>
type ApplicantInput = z.infer<typeof applicantCreateSchema>
type PublicInput = z.infer<typeof publicApplicationSchema>
type InterviewInput = z.infer<typeof interviewCreateSchema>
type ConvertInput = z.infer<typeof convertApplicantSchema>

// ── Job postings ──
export function listJobPostings(orgId: string) {
  return orgDb(orgId).jobPosting.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { _count: { select: { applicants: true } } } })
}
export function createJobPosting(orgId: string, input: PostingInput) {
  return orgDb(orgId).jobPosting.create({ data: { ...input, organizationId: orgId } })
}
export async function updateJobPosting(orgId: string, id: string, input: Partial<PostingInput>) {
  const { count } = await orgDb(orgId).jobPosting.updateMany({ where: { id }, data: { ...input } })
  if (count === 0) return null
  return orgDb(orgId).jobPosting.findFirst({ where: { id } })
}

// ── Applicants ──
export function listApplicants(orgId: string, opts: { status?: string; jobPostingId?: string } = {}) {
  return orgDb(orgId).applicant.findMany({
    where: { ...(opts.status ? { status: opts.status as "NEW" } : {}), ...(opts.jobPostingId ? { jobPostingId: opts.jobPostingId } : {}) },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { jobPosting: { select: { title: true } }, interviews: { orderBy: { date: "desc" } } },
  })
}
export function createApplicant(orgId: string, input: ApplicantInput) {
  return orgDb(orgId).applicant.create({ data: { ...input, organizationId: orgId } })
}
export async function updateApplicant(orgId: string, id: string, input: { status?: string; notes?: string }) {
  const applicant = await orgDb(orgId).applicant.findFirst({ where: { id }, select: { convertedUserId: true } })
  if (!applicant) return null
  if (applicant.convertedUserId) throw new ForbiddenActionError("This applicant is hired and read-only")
  const data: Record<string, unknown> = {}
  if (input.status !== undefined) data.status = input.status
  if (input.notes !== undefined) data.notes = input.notes
  await orgDb(orgId).applicant.updateMany({ where: { id }, data })
  return orgDb(orgId).applicant.findFirst({ where: { id } })
}

export async function addInterview(orgId: string, applicantId: string, input: InterviewInput) {
  const applicant = await orgDb(orgId).applicant.findFirst({ where: { id: applicantId }, select: { id: true } })
  assertFound(applicant, "Applicant")
  return orgDb(orgId).interview.create({
    data: { organizationId: orgId, applicantId, date: new Date(`${input.date}T00:00:00.000Z`), interviewerId: input.interviewerId, outcomeNotes: input.outcomeNotes },
  })
}

/** Public job application (same hostile posture as online booking). */
export async function createPublicApplication(orgId: string, input: PublicInput, ipHash: string) {
  const db = orgDb(orgId)
  const now = Date.now()
  const [recentIp, recentOrg] = await Promise.all([
    db.applicant.count({ where: { ipHash, createdAt: { gt: new Date(now - INTAKE_LIMITS.ipWindowMs) } } }),
    db.applicant.count({ where: { createdAt: { gt: new Date(now - INTAKE_LIMITS.orgWindowMs) } } }),
  ])
  enforceIntakeLimits(recentIp, recentOrg)
  let appliedFor = input.appliedFor
  if (input.jobPostingId) {
    const posting = await db.jobPosting.findFirst({ where: { id: input.jobPostingId, status: "OPEN" }, select: { title: true } })
    if (!posting) throw new ReferenceError("That position is no longer open")
    appliedFor = posting.title
  }
  const created = await db.applicant.create({
    data: { organizationId: orgId, jobPostingId: input.jobPostingId, name: input.name, email: input.email, phone: input.phone, source: "ONLINE", appliedFor, resumeRef: input.resumeRef, availability: input.availability, status: "NEW", ipHash },
    select: { id: true },
  })
  return { id: created.id }
}

/**
 * Convert a HIRED applicant into a User + EmployeeProfile in ONE atomic
 * transaction. If the EmployeeProfile insert fails, the User insert rolls back —
 * never an orphaned user. Carries over name, contact and availability; links the
 * applicant permanently (convertedUserId) and makes it read-only.
 */
export async function convertApplicantToEmployee(orgId: string, id: string, input: ConvertInput) {
  const applicant = await orgDb(orgId).applicant.findFirst({ where: { id } })
  assertFound(applicant, "Applicant")
  if (applicant!.convertedUserId) throw new ForbiddenActionError("This applicant has already been hired")
  if (applicant!.status !== "HIRED") throw new ForbiddenActionError("Only a HIRED applicant can be converted to an employee")
  if (!applicant!.email) throw new RequirementsError("An email is required to create the employee account", ["Add the applicant's email first"])
  const existing = await systemDb.user.findUnique({ where: { email: applicant!.email }, select: { id: true } })
  if (existing) throw new ConflictError("A user with that email already exists")

  const password = await bcrypt.hash(randomBytes(24).toString("hex"), 10)
  const userId = await systemDb.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { organizationId: orgId, name: applicant!.name, email: applicant!.email!, phone: applicant!.phone, password, role: (input.role ?? "CLEANER") as "CLEANER", isActive: true },
      select: { id: true },
    })
    await tx.employeeProfile.create({
      data: { organizationId: orgId, userId: user.id, payType: (input.payType ?? "HOURLY") as "HOURLY", payRate: input.payRate ?? null, hireDate: new Date(), availability: applicant!.availability },
    })
    await tx.applicant.update({ where: { id }, data: { convertedUserId: user.id, convertedAt: new Date(), status: "HIRED" } })
    return user.id
  })
  return { userId }
}
