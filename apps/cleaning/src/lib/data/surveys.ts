import { orgDb } from "../org-db"
import { ReferenceError, ConflictError } from "./errors"

// Post-service satisfaction surveys (Phase 28): one rating (1–5) + comment per
// completed job, submitted by the customer in the portal. Results roll up per
// site and per cleaner for staff.

export async function submitSurvey(orgId: string, customerId: string, jobId: string, rating: number, comment?: string) {
  if (rating < 1 || rating > 5) throw new ConflictError("Rating must be 1–5")
  const job = await orgDb(orgId).job.findFirst({ where: { id: jobId, status: "COMPLETED", serviceLocation: { customerId } }, select: { id: true } })
  if (!job) throw new ReferenceError("That visit isn't available to rate")
  const existing = await orgDb(orgId).surveyResponse.findFirst({ where: { jobId }, select: { id: true } })
  if (existing) throw new ConflictError("You've already rated this visit")
  return orgDb(orgId).surveyResponse.create({ data: { organizationId: orgId, jobId, customerId, rating, comment } })
}

/** Completed jobs for this customer still awaiting a rating (portal prompt). */
export async function listSurveyableJobs(orgId: string, customerId: string) {
  return orgDb(orgId).job.findMany({
    where: { status: "COMPLETED", serviceLocation: { customerId }, survey: { is: null } },
    orderBy: { actualEnd: "desc" },
    take: 10,
    select: { id: true, title: true, actualEnd: true, scheduledStart: true, serviceLocation: { select: { name: true } } },
  })
}

/** Average rating + count per site and per cleaner over a period (staff report). */
export async function getSatisfactionReport(orgId: string, window?: { start: Date; end: Date }) {
  const responses = await orgDb(orgId).surveyResponse.findMany({
    where: window ? { createdAt: { gte: window.start, lte: window.end } } : {},
    select: {
      rating: true,
      job: { select: { serviceLocation: { select: { id: true, name: true } }, assignments: { select: { user: { select: { id: true, name: true } } } } } },
    },
  })
  const bySite = new Map<string, { id: string; name: string; sum: number; n: number }>()
  const byCleaner = new Map<string, { id: string; name: string; sum: number; n: number }>()
  for (const r of responses) {
    const site = r.job.serviceLocation
    const s = bySite.get(site.id) ?? { id: site.id, name: site.name, sum: 0, n: 0 }
    s.sum += r.rating; s.n++; bySite.set(site.id, s)
    for (const a of r.job.assignments) {
      const c = byCleaner.get(a.user.id) ?? { id: a.user.id, name: a.user.name, sum: 0, n: 0 }
      c.sum += r.rating; c.n++; byCleaner.set(a.user.id, c)
    }
  }
  const finalize = (m: Map<string, { id: string; name: string; sum: number; n: number }>) =>
    [...m.values()].map((x) => ({ id: x.id, name: x.name, count: x.n, avg: Math.round((x.sum / x.n) * 100) / 100 })).sort((a, b) => b.avg - a.avg)
  const overall = responses.length ? Math.round((responses.reduce((a, r) => a + r.rating, 0) / responses.length) * 100) / 100 : null
  return { overall, count: responses.length, bySite: finalize(bySite), byCleaner: finalize(byCleaner) }
}
