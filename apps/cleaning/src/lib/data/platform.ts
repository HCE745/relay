import "server-only"
import { systemDb } from "../org-db"

// CleanWare PLATFORM administration data — cross-tenant reads for the internal
// Super Admin portal. Every function here intentionally bypasses org scoping
// (that is the whole point of platform administration), so it must ONLY be
// imported by pages already gated with isPlatformAdmin(). No impersonation and
// no cross-tenant customer-data writes live here — the portal is read-only over
// real records (the one exception, feedback status, lives in data/feedback.ts).

export async function platformOverview() {
  const now = new Date()
  const [totalOrgs, demoOrgs, active, trialing, pastDue, canceled, users, customers, feedbackOpen] = await Promise.all([
    systemDb.organization.count({ where: { isDemo: false } }),
    systemDb.organization.count({ where: { isDemo: true, demoExpiresAt: { gt: now } } }),
    systemDb.organization.count({ where: { isDemo: false, subscriptionStatus: "active" } }),
    systemDb.organization.count({ where: { isDemo: false, subscriptionStatus: "trialing" } }),
    systemDb.organization.count({ where: { isDemo: false, subscriptionStatus: "past_due" } }),
    systemDb.organization.count({ where: { isDemo: false, subscriptionStatus: "canceled" } }),
    systemDb.user.count({ where: { role: { not: "CLIENT" }, organization: { isDemo: false } } }),
    systemDb.customer.count({ where: { organization: { isDemo: false } } }),
    systemDb.feedbackSubmission.count({ where: { status: { in: ["NEW", "IN_REVIEW"] } } }),
  ])
  return { totalOrgs, demoOrgs, active, trialing, pastDue, canceled, users, customers, feedbackOpen }
}

export async function listOrganizations(opts: { includeDemo?: boolean } = {}) {
  const orgs = await systemDb.organization.findMany({
    where: opts.includeDemo ? {} : { isDemo: false },
    orderBy: [{ isDemo: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, name: true, slug: true, packageTier: true, subscriptionStatus: true,
      isDemo: true, demoExpiresAt: true, trialEndsAt: true, createdAt: true, stripeCustomerId: true,
      _count: { select: { users: true, customers: true } },
    },
    take: 500,
  })
  return orgs
}

export async function getOrganizationDetail(id: string) {
  const org = await systemDb.organization.findUnique({
    where: { id },
    select: {
      id: true, name: true, slug: true, packageTier: true, subscriptionStatus: true,
      isDemo: true, demoExpiresAt: true, trialEndsAt: true, createdAt: true, stripeCustomerId: true,
      onboardingCompletedAt: true, timezone: true,
      _count: { select: { customers: true, serviceLocations: true, jobs: true, invoices: true } },
    },
  })
  if (!org) return null
  const [users, feedback] = await Promise.all([
    systemDb.user.findMany({
      where: { organizationId: id, role: { not: "CLIENT" } },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      take: 200,
    }),
    systemDb.feedbackSubmission.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, type: true, status: true, createdAt: true },
    }),
  ])
  return { org, users, feedback }
}

export async function listActiveDemos() {
  const now = new Date()
  return systemDb.organization.findMany({
    where: { isDemo: true, demoExpiresAt: { gt: now } },
    orderBy: { demoExpiresAt: "asc" },
    select: { id: true, name: true, slug: true, createdAt: true, demoExpiresAt: true, _count: { select: { users: true, customers: true } } },
    take: 300,
  })
}
