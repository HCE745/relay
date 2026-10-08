// Phase 18 integration verification. Focus: applicant pipeline; public
// application path is rate-limited per IP + per org and drops honeypot bots;
// CONVERT TO EMPLOYEE is atomic — a HIRED applicant becomes a User +
// EmployeeProfile in one transaction, links back permanently, and becomes
// read-only. Critically: a FORCED mid-transaction failure (payRate overflowing
// Decimal(10,2)) must leave NO orphaned user.
//
// Usage: DATABASE_URL=... tsx scripts/verify-phase18-hiring.ts  (after migrate)

import { systemDb } from "../src/lib/org-db"
import {
  createJobPosting, listJobPostings, createApplicant, listApplicants, updateApplicant,
  addInterview, convertApplicantToEmployee, createPublicApplication,
} from "../src/lib/data/hiring"
import { INTAKE_LIMITS, IntakeRejected } from "../src/lib/public-intake"

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}
async function threw(fn: () => Promise<unknown>) { try { await fn(); return null } catch (e) { return e } }

async function main() {
  const stamp = Date.now()
  const org = await systemDb.organization.create({ data: { name: "Hire Co", slug: `h-${stamp}`, packageTier: "TEAM", timezone: "UTC" } })

  console.log("Job postings + applicant pipeline:")
  const posting = await createJobPosting(org.id, { title: "Cleaner", status: "OPEN", employmentType: "Full-time", payRange: "$18-$22/hr" })
  check("posting created OPEN", posting.status === "OPEN")
  const a = await createApplicant(org.id, { name: "Dana Hire", email: `dana-${stamp}@a.co`, phone: "555-0101", jobPostingId: posting.id, availability: "Weekdays" })
  check("applicant created NEW", a.status === "NEW")
  const moved = await updateApplicant(org.id, a.id, { status: "INTERVIEW" })
  check("status advances", moved?.status === "INTERVIEW")
  const iv = await addInterview(org.id, a.id, { date: "2026-10-01", interviewerId: undefined, outcomeNotes: "Good" })
  check("interview recorded", !!iv.id)
  const listed = await listApplicants(org.id)
  check("applicant lists with interview", listed.length === 1 && listed[0].interviews.length === 1)

  console.log("Convert requires HIRED status:")
  const tooEarly = await threw(() => convertApplicantToEmployee(org.id, a.id, {}))
  check("non-HIRED conversion refused", tooEarly !== null)
  await updateApplicant(org.id, a.id, { status: "HIRED" })

  console.log("Atomic convert — happy path creates User + EmployeeProfile linked read-only:")
  const usersBefore = await systemDb.user.count({ where: { organizationId: org.id } })
  const { userId } = await convertApplicantToEmployee(org.id, a.id, { role: "CLEANER", payType: "HOURLY", payRate: "20.00" })
  const user = await systemDb.user.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true } })
  const profile = await systemDb.employeeProfile.findFirst({ where: { userId }, select: { availability: true, payRate: true } })
  check("user created", !!user)
  check("employee profile created", !!profile)
  check("carried over name + contact", user?.name === "Dana Hire" && user?.email === `dana-${stamp}@a.co` && user?.phone === "555-0101")
  check("carried over availability", profile?.availability === "Weekdays")
  const linked = await systemDb.applicant.findUniqueOrThrow({ where: { id: a.id } })
  check("applicant links to the user permanently", linked.convertedUserId === userId && !!linked.convertedAt)
  check("exactly one new user created", (await systemDb.user.count({ where: { organizationId: org.id } })) === usersBefore + 1)

  console.log("Converted applicant is read-only + one-shot:")
  const ro = await threw(() => updateApplicant(org.id, a.id, { status: "REJECTED" }))
  check("editing a converted applicant is refused", ro !== null)
  const twice = await threw(() => convertApplicantToEmployee(org.id, a.id, {}))
  check("re-converting is refused", twice !== null)

  console.log("FAILURE PATH — forced mid-transaction failure leaves NO orphaned user:")
  const b = await createApplicant(org.id, { name: "Rollback Rae", email: `rae-${stamp}@a.co`, phone: "555-0102", jobPostingId: posting.id })
  await updateApplicant(org.id, b.id, { status: "HIRED" })
  const usersBeforeFail = await systemDb.user.count({ where: { organizationId: org.id } })
  // payRate overflows Decimal(10,2) → EmployeeProfile insert throws AFTER User insert.
  const failed = await threw(() => convertApplicantToEmployee(org.id, b.id, { payRate: "123456789012.00" }))
  check("conversion threw", failed !== null, failed ? String((failed as Error).message).slice(0, 60) : "")
  check("NO orphaned user — count unchanged", (await systemDb.user.count({ where: { organizationId: org.id } })) === usersBeforeFail)
  check("no user with that email exists", (await systemDb.user.count({ where: { organizationId: org.id, email: `rae-${stamp}@a.co` } })) === 0)
  const bAfter = await systemDb.applicant.findUniqueOrThrow({ where: { id: b.id } })
  check("applicant NOT marked converted", bAfter.convertedUserId === null)

  console.log("Public application: honeypot + rate limit + source ONLINE:")
  const r1 = await createPublicApplication(org.id, { name: "Online Applicant", email: `o-${stamp}@a.co`, jobPostingId: posting.id, website: "" }, "ip-A")
  check("accepted online application", !!r1.id)
  const onlineRow = await systemDb.applicant.findFirst({ where: { id: r1.id } })
  check("stored source ONLINE + ipHash + title", onlineRow?.source === "ONLINE" && onlineRow?.ipHash === "ip-A" && onlineRow?.appliedFor === "Cleaner")
  for (let i = 1; i < INTAKE_LIMITS.ipMax; i++) await createPublicApplication(org.id, { name: `A${i}`, email: `a${i}-${stamp}@a.co`, website: "" }, "ip-A")
  const limited = await threw(() => createPublicApplication(org.id, { name: "Over", email: `over-${stamp}@a.co`, website: "" }, "ip-A"))
  check("per-IP rate limit kicks in", limited instanceof IntakeRejected && (limited as IntakeRejected).code === "rate_limit")

  console.log("Postings list reflects applicant counts:")
  const postings = await listJobPostings(org.id)
  check("posting lists with applicant count", postings.length === 1 && postings[0]._count.applicants >= 2, `count=${postings[0]?._count.applicants}`)

  await systemDb.organization.delete({ where: { id: org.id } })
  console.log(`\n${failures === 0 ? "ALL HIRING CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
