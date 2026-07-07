import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { FeatureFlagGate } from "@/components/layout/feature-flag-gate"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import {
  AlertCircle, CheckCircle2, ChevronUp, AlertTriangle,
  MapPin, TrendingUp, Clock,
} from "lucide-react"

export const dynamic = "force-dynamic"

async function getCorporateData(orgId: string) {
  const [
    openIssues, resolvedIssues, escalatedIssues, criticalIssues, totalIssues,
    injuryReports, repeatIssues, locationBreakdown, regionBreakdown, deptBreakdown,
    avgResolutionHours,
  ] = await Promise.all([
    prisma.issue.count({ where: { organizationId: orgId, status: "OPEN" } }),
    prisma.issue.count({ where: { organizationId: orgId, status: "RESOLVED" } }),
    prisma.issue.count({ where: { organizationId: orgId, isEscalated: true } }),
    prisma.issue.count({ where: { organizationId: orgId, priority: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.issue.count({ where: { organizationId: orgId } }),
    prisma.injuryReport.count({ where: { organizationId: orgId, status: { not: "CLOSED" } } }),
    // Issues that match title of another open issue from same org (rough repeat detection)
    prisma.issue.groupBy({
      by: ["title"],
      where: { organizationId: orgId },
      having: { title: { _count: { gt: 1 } } },
      _count: { id: true },
    }),
    prisma.issue.groupBy({
      by: ["locationId"],
      where: { organizationId: orgId, locationId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    }),
    prisma.region.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { locations: true } },
        locations: {
          include: { _count: { select: { issues: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.issue.groupBy({
      by: ["departmentId"],
      where: { organizationId: orgId, departmentId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 6,
    }),
    prisma.issue.findMany({
      where: { organizationId: orgId, resolvedAt: { not: undefined } },
      select: { createdAt: true, resolvedAt: true },
      take: 200,
      orderBy: { resolvedAt: "desc" },
    }),
  ])

  // Compute avg resolution time in hours
  const resolvedWithTime = avgResolutionHours.filter(i => i.resolvedAt)
  const avgHours = resolvedWithTime.length > 0
    ? resolvedWithTime.reduce((sum, i) => {
        const ms = new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()
        return sum + ms / 3600000
      }, 0) / resolvedWithTime.length
    : null

  // Enrich location breakdown with names
  const locationIds = locationBreakdown.map(l => l.locationId).filter(Boolean) as string[]
  const locationNames = locationIds.length > 0
    ? await prisma.location.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, name: true, regionId: true },
      })
    : []
  const locMap = Object.fromEntries(locationNames.map(l => [l.id, l]))

  // Enrich dept breakdown with names
  const deptIds = deptBreakdown.map(d => d.departmentId).filter(Boolean) as string[]
  const deptNames = deptIds.length > 0
    ? await prisma.department.findMany({
        where: { id: { in: deptIds } },
        select: { id: true, name: true },
      })
    : []
  const deptMap = Object.fromEntries(deptNames.map(d => [d.id, d]))

  return {
    openIssues, resolvedIssues, escalatedIssues, criticalIssues, totalIssues,
    injuryReports, repeatIssueCount: repeatIssues.length,
    avgHours,
    locationBreakdown: locationBreakdown.map(l => ({
      locationId: l.locationId!,
      name: locMap[l.locationId!]?.name ?? "Unknown",
      count: l._count.id,
    })),
    regionBreakdown: regionBreakdown.map(r => ({
      id: r.id,
      name: r.name,
      locationCount: r._count.locations,
      issueCount: r.locations.reduce((sum, loc) => sum + loc._count.issues, 0),
    })),
    deptBreakdown: deptBreakdown.map(d => ({
      deptId: d.departmentId!,
      name: deptMap[d.departmentId!]?.name ?? "Unknown",
      count: d._count.id,
    })),
  }
}

export default async function CorporateDashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER"].includes(session.role)) redirect("/dashboard")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { corporate_dashboard_enabled: true },
  })

  if (!org?.corporate_dashboard_enabled) {
    return (
      <div>
        <Header title="Corporate Dashboard" />
        <FeatureFlagGate
          featureName="Corporate Dashboard"
          description="The Corporate Dashboard shows company-wide metrics across all regions, locations, and departments. Contact support to enable this feature."
        />
      </div>
    )
  }

  const data = await getCorporateData(session.organizationId)

  const fmtHours = (h: number | null) => {
    if (h === null) return "—"
    if (h < 1) return `${Math.round(h * 60)}m`
    if (h < 24) return `${h.toFixed(1)}h`
    return `${(h / 24).toFixed(1)}d`
  }

  const stats = [
    { label: "Open Issues",     value: data.openIssues,       icon: AlertCircle,  color: "text-blue-600",   bg: "bg-blue-50",   href: "/issues?status=OPEN" },
    { label: "Escalated",       value: data.escalatedIssues,  icon: ChevronUp,    color: "text-orange-600", bg: "bg-orange-50", href: "/issues?status=ESCALATED" },
    { label: "Critical",        value: data.criticalIssues,   icon: AlertTriangle,color: "text-red-600",    bg: "bg-red-50",    href: "/issues?priority=CRITICAL" },
    { label: "Resolved",        value: data.resolvedIssues,   icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-50",  href: "/issues?status=RESOLVED" },
    { label: "Injury Reports",  value: data.injuryReports,    icon: AlertTriangle,color: "text-amber-600",  bg: "bg-amber-50",  href: "/injury-reports" },
    { label: "Repeat Issues",   value: data.repeatIssueCount, icon: TrendingUp,   color: "text-purple-600", bg: "bg-purple-50", href: "/issues" },
  ]

  return (
    <div>
      <Header title="Corporate Dashboard" />
      <div className="p-6 space-y-6">
        {/* Avg resolution time */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          Avg. resolution time: <strong className="text-gray-900">{fmtHours(data.avgHours)}</strong>
          <span className="mx-2 text-gray-300">·</span>
          Total issues: <strong className="text-gray-900">{data.totalIssues}</strong>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
            <Link key={label} href={href} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-sm text-gray-500 mt-0.5">{label}</div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Region breakdown */}
          {data.regionBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Issues by Region</h2>
              </div>
              <div className="px-6 py-4 space-y-3">
                {data.regionBreakdown.map(r => {
                  const pct = data.totalIssues ? Math.round((r.issueCount / data.totalIssues) * 100) : 0
                  return (
                    <div key={r.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">{r.name}</span>
                        <span className="text-sm font-medium text-gray-900">{r.issueCount}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{r.locationCount} locations</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Location breakdown */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" /> Issues by Location
              </h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              {data.locationBreakdown.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No location data yet</p>
              ) : data.locationBreakdown.map(l => {
                const pct = data.totalIssues ? Math.round((l.count / data.totalIssues) * 100) : 0
                return (
                  <div key={l.locationId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 truncate">{l.name}</span>
                      <span className="text-sm font-medium text-gray-900 ml-2">{l.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Department breakdown */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Issues by Department</h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              {data.deptBreakdown.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No department data yet</p>
              ) : data.deptBreakdown.map(d => {
                const pct = data.totalIssues ? Math.round((d.count / data.totalIssues) * 100) : 0
                return (
                  <div key={d.deptId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 truncate">{d.name}</span>
                      <span className="text-sm font-medium text-gray-900 ml-2">{d.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
