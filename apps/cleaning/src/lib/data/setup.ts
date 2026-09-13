import { orgDb } from "../org-db"

// First-run setup progress, derived entirely from real tenant data (never a
// stored flag). Powers the Dashboard setup guide; each step maps to a real
// object the org must create.
export type SetupProgress = {
  steps: {
    customer: boolean
    location: boolean
    scope: boolean
    team: boolean
    plan: boolean
    assignedJob: boolean
  }
  completed: number
  total: number
  allComplete: boolean
  // Deep-link helpers so steps point at the right screen once data exists.
  firstCustomerId: string | null
  firstSiteId: string | null
  firstSiteCustomerId: string | null
}

export async function getSetupProgress(orgId: string): Promise<SetupProgress> {
  const db = orgDb(orgId)

  const [customers, locations, scopes, team, plans, assignedJobs, firstCustomer, firstSite] = await Promise.all([
    db.customer.count(),
    db.serviceLocation.count(),
    db.checklistTemplate.count(),
    db.user.count({ where: { role: { not: "OWNER" } } }),
    db.servicePlan.count(),
    db.job.count({ where: { assignments: { some: {} } } }),
    db.customer.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }),
    db.serviceLocation.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, customerId: true } }),
  ])

  const steps = {
    customer: customers > 0,
    location: locations > 0,
    scope: scopes > 0,
    team: team > 0,
    plan: plans > 0,
    assignedJob: assignedJobs > 0,
  }
  const values = Object.values(steps)
  const completed = values.filter(Boolean).length

  return {
    steps,
    completed,
    total: values.length,
    allComplete: completed === values.length,
    firstCustomerId: firstCustomer?.id ?? null,
    firstSiteId: firstSite?.id ?? null,
    firstSiteCustomerId: firstSite?.customerId ?? null,
  }
}
