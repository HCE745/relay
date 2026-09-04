import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { format, formatDistanceToNowStrict } from "date-fns"
import { Building2, ChevronRight } from "lucide-react"
import { LIFECYCLE_COLORS } from "@/lib/crm-lifecycle-constants"
import { LifecycleFilterSelect } from "@/components/super-admin/lifecycle-filter-select"

export const dynamic = "force-dynamic"

const PLAN_LABEL: Record<string, string> = {
  free: "Free", starter: "Starter", pro: "Pro", enterprise: "Enterprise",
}
const PLAN_COLOR: Record<string, string> = {
  free:       "bg-gray-800 text-gray-400 border-gray-700",
  starter:    "bg-blue-900/50 text-blue-300 border-blue-700",
  pro:        "bg-indigo-900/50 text-indigo-300 border-indigo-700",
  enterprise: "bg-purple-900/50 text-purple-300 border-purple-700",
}

function calcHealthScore(
  lastLogin: Date | null | undefined,
  issueCount: number,
  userCount: number,
  routingRules: number,
  subscriptionStatus: string,
): number {
  const now = Date.now()
  let score = 0

  // Last login (25 pts)
  if (lastLogin) {
    const daysSince = (now - new Date(lastLogin).getTime()) / 86_400_000
    if (daysSince <= 7)   score += 25
    else if (daysSince <= 30)  score += 15
    else if (daysSince <= 90)  score += 5
  }

  // Issues (25 pts)
  if (issueCount > 10)     score += 25
  else if (issueCount > 5) score += 15
  else if (issueCount > 0) score += 5

  // Team members (20 pts)
  if (userCount > 10)      score += 20
  else if (userCount > 5)  score += 12
  else if (userCount > 1)  score += 5

  // Routing rules (15 pts)
  if (routingRules > 0) score += 15

  // Active subscription (15 pts)
  if (subscriptionStatus === "active")   score += 15
  else if (subscriptionStatus === "trialing") score += 5

  return Math.min(score, 100)
}

function HealthBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-green-900/60 text-green-300 border-green-800" :
    score >= 50 ? "bg-yellow-900/60 text-yellow-300 border-yellow-800" :
    score >= 25 ? "bg-orange-900/60 text-orange-300 border-orange-800" :
                  "bg-red-900/60 text-red-400 border-red-800"
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${color}`}>
      {score}
    </span>
  )
}

function StatusBadge({ org }: {
  org: { subscriptionStatus: string; trialEndsAt: Date | null; suspendedAt: Date | null }
}) {
  if (org.suspendedAt) {
    return <span className="text-xs px-2.5 py-1 rounded-full bg-red-950/80 text-red-400 font-medium border border-red-900">Suspended</span>
  }
  const now = new Date()
  if (org.subscriptionStatus === "active") {
    return <span className="text-xs px-2.5 py-1 rounded-full bg-green-900/60 text-green-300 font-medium border border-green-800">Active</span>
  }
  if (org.subscriptionStatus === "trialing" && org.trialEndsAt && org.trialEndsAt > now) {
    const days = Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / 86400000)
    return <span className="text-xs px-2.5 py-1 rounded-full bg-amber-900/60 text-amber-300 font-medium border border-amber-800">Trial · {days}d</span>
  }
  if (org.subscriptionStatus === "past_due") {
    return <span className="text-xs px-2.5 py-1 rounded-full bg-orange-900/60 text-orange-300 font-medium border border-orange-800">Past Due</span>
  }
  if (org.subscriptionStatus === "canceled") {
    return <span className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-500 font-medium border border-gray-700">Canceled</span>
  }
  return <span className="text-xs px-2.5 py-1 rounded-full bg-red-900/60 text-red-400 font-medium border border-red-800">Expired</span>
}

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; plan?: string; lifecycle?: string }>
}) {
  const { q, status, plan, lifecycle } = await searchParams

  const where: Record<string, unknown> = { isDemo: false }
  if (q)         where.name = { contains: q, mode: "insensitive" }
  if (plan)      where.plan = plan
  if (lifecycle) where.lifecycleStatus = lifecycle
  if (status === "active")    { where.subscriptionStatus = "active"; where.suspendedAt = null }
  if (status === "trialing")  { where.subscriptionStatus = "trialing"; where.trialEndsAt = { gt: new Date() }; where.suspendedAt = null }
  if (status === "expired")   { where.subscriptionStatus = "trialing"; where.trialEndsAt = { lt: new Date() }; where.suspendedAt = null }
  if (status === "suspended") { where.suspendedAt = { not: null } }

  const [orgs, activeCountByOrg, lastLoginByOrg, routingCountByOrg] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      where,
      select: {
        id: true, name: true, slug: true, industry: true, plan: true,
        createdAt: true, trialEndsAt: true, subscriptionStatus: true, suspendedAt: true, lifecycleStatus: true,
        _count: { select: { users: true, issues: true, locations: true, routingRules: true } },
        users: {
          where: { role: "ADMIN" },
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { name: true, email: true },
        },
      },
    }),
    prisma.user.groupBy({
      by: ["organizationId"],
      where: { isActive: true },
      _count: { id: true },
    }),
    prisma.user.groupBy({
      by: ["organizationId"],
      _max: { lastLoginAt: true },
    }),
    prisma.routingRule.groupBy({
      by: ["organizationId"],
      _count: { id: true },
    }),
  ])

  const activeMap  = new Map(activeCountByOrg.map((r) => [r.organizationId, r._count.id]))
  const loginMap   = new Map(lastLoginByOrg.map((r)  => [r.organizationId, r._max.lastLoginAt]))
  const routingMap = new Map(routingCountByOrg.map((r) => [r.organizationId, r._count.id]))

  const STATUS_FILTERS = [
    { key: "",          label: "All" },
    { key: "trialing",  label: "Trial" },
    { key: "active",    label: "Active" },
    { key: "expired",   label: "Expired" },
    { key: "suspended", label: "Suspended" },
  ]

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-gray-400 text-sm mt-1">{orgs.length} total</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <form method="GET" className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search by name…"
            className="px-3.5 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52" />
          {status    && <input type="hidden" name="status"    value={status} />}
          {plan      && <input type="hidden" name="plan"      value={plan} />}
          {lifecycle && <input type="hidden" name="lifecycle" value={lifecycle} />}
        </form>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const params = new URLSearchParams({ ...(f.key ? { status: f.key } : {}), ...(q ? { q } : {}), ...(plan ? { plan } : {}), ...(lifecycle ? { lifecycle } : {}) })
            return (
              <Link key={f.key}
                href={`/super-admin/organizations${params.toString() ? `?${params}` : ""}`}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${(status ?? "") === f.key ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"}`}>
                {f.label}
              </Link>
            )
          })}
        </div>
        {/* Lifecycle filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Lifecycle:</span>
          <LifecycleFilterSelect current={lifecycle} />
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="border-b border-gray-800">
              {["Organization", "Owner", "Plan", "Lifecycle", "Signed Up", "Active / Total Users", "Locations", "Issues", "Last Login", "Health", "Status", ""].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {orgs.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-5 py-12 text-center">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                  <p className="text-gray-500 text-sm">No customers found</p>
                </td>
              </tr>
            ) : orgs.map((org) => {
              const admin         = org.users[0]
              const activeCount   = activeMap.get(org.id) ?? 0
              const lastLogin     = loginMap.get(org.id) ?? null
              const routingCount  = routingMap.get(org.id) ?? 0
              const healthScore   = calcHealthScore(lastLogin, org._count.issues, org._count.users, routingCount, org.subscriptionStatus)
              return (
                <tr key={org.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white text-sm font-semibold">{org.name}</p>
                    <p className="text-gray-500 text-xs">{org.industry ?? org.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    {admin ? (
                      <>
                        <p className="text-gray-300 text-sm">{admin.name}</p>
                        <p className="text-gray-500 text-xs truncate max-w-[160px]">{admin.email}</p>
                      </>
                    ) : <span className="text-gray-600 text-sm">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PLAN_COLOR[org.plan] ?? PLAN_COLOR.free}`}>
                      {PLAN_LABEL[org.plan] ?? org.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LIFECYCLE_COLORS[org.lifecycleStatus] ?? "bg-gray-100 text-gray-600"}`}>
                      {org.lifecycleStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                    {format(new Date(org.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-green-400 font-semibold">{activeCount}</span>
                    <span className="text-gray-600"> / {org._count.users}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-sm">{org._count.locations}</td>
                  <td className="px-4 py-3 text-gray-300 text-sm">{org._count.issues}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {lastLogin ? formatDistanceToNowStrict(new Date(lastLogin), { addSuffix: true }) : "Never"}
                  </td>
                  <td className="px-4 py-3"><HealthBadge score={healthScore} /></td>
                  <td className="px-4 py-3"><StatusBadge org={org} /></td>
                  <td className="px-4 py-3">
                    <Link href={`/super-admin/organizations/${org.id}`}
                      className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-sm font-medium whitespace-nowrap">
                      View <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
