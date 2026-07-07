import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { FeatureFlagGate } from "@/components/layout/feature-flag-gate"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { AlertCircle, CheckCircle2, ChevronUp, AlertTriangle, MapPin } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function RegionalDashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)) redirect("/dashboard")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { corporate_dashboard_enabled: true },
  })

  if (!org?.corporate_dashboard_enabled) {
    return (
      <div>
        <Header title="Regional Dashboard" />
        <FeatureFlagGate
          featureName="Regional Dashboard"
          description="The Regional Dashboard shows metrics scoped to your assigned region(s). Contact support to enable this feature."
        />
      </div>
    )
  }

  const orgId = session.organizationId

  // Get user's assigned region (if any)
  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { regionId: true },
  })

  // Admins see all regions; regional managers see only their assigned region
  const isAdmin = session.role === "ADMIN"
  const userRegionId = currentUser?.regionId ?? null

  const regions = await prisma.region.findMany({
    where: {
      organizationId: orgId,
      ...((!isAdmin && userRegionId) ? { id: userRegionId } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      locations: {
        select: { id: true, name: true },
      },
    },
  })

  if (regions.length === 0 && !isAdmin) {
    return (
      <div>
        <Header title="Regional Dashboard" />
        <div className="p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center max-w-md mx-auto">
            <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-900 font-semibold mb-1">No region assigned</p>
            <p className="text-gray-500 text-sm">
              You are not assigned to a region yet. Contact your administrator to be assigned to a region.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (regions.length === 0 && isAdmin) {
    return (
      <div>
        <Header title="Regional Dashboard" />
        <div className="p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center max-w-md mx-auto">
            <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-900 font-semibold mb-1">No regions created yet</p>
            <p className="text-gray-500 text-sm mb-4">
              Create regions to start using the Regional Dashboard.
            </p>
            <Link href="/regions" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Manage Regions →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // For each region, get metrics from its locations
  const regionMetrics = await Promise.all(regions.map(async (r) => {
    const locationIds = r.locations.map(l => l.id)
    if (locationIds.length === 0) {
      return {
        region: r,
        open: 0, resolved: 0, escalated: 0, critical: 0, total: 0,
        locationBreakdown: [],
      }
    }

    const [open, resolved, escalated, critical, total, locationBreakdown] = await Promise.all([
      prisma.issue.count({ where: { organizationId: orgId, locationId: { in: locationIds }, status: "OPEN" } }),
      prisma.issue.count({ where: { organizationId: orgId, locationId: { in: locationIds }, status: "RESOLVED" } }),
      prisma.issue.count({ where: { organizationId: orgId, locationId: { in: locationIds }, isEscalated: true } }),
      prisma.issue.count({ where: { organizationId: orgId, locationId: { in: locationIds }, priority: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      prisma.issue.count({ where: { organizationId: orgId, locationId: { in: locationIds } } }),
      prisma.issue.groupBy({
        by: ["locationId"],
        where: { organizationId: orgId, locationId: { in: locationIds } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
    ])

    return {
      region: r,
      open, resolved, escalated, critical, total,
      locationBreakdown: locationBreakdown.map(lb => ({
        locationId: lb.locationId!,
        name: r.locations.find(l => l.id === lb.locationId)?.name ?? "Unknown",
        count: lb._count.id,
      })),
    }
  }))

  return (
    <div>
      <Header title="Regional Dashboard" />
      <div className="p-6 space-y-8">
        {regionMetrics.map(({ region, open, resolved, escalated, critical, total, locationBreakdown }) => (
          <div key={region.id} className="space-y-4">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-gray-900">{region.name}</h2>
              <span className="text-xs text-gray-400">{region.locations.length} locations</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Open",      value: open,      icon: AlertCircle,   color: "text-blue-600",   bg: "bg-blue-50" },
                { label: "Escalated", value: escalated, icon: ChevronUp,     color: "text-orange-600", bg: "bg-orange-50" },
                { label: "Critical",  value: critical,  icon: AlertTriangle, color: "text-red-600",    bg: "bg-red-50" },
                { label: "Resolved",  value: resolved,  icon: CheckCircle2,  color: "text-green-600",  bg: "bg-green-50" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div className="text-xl font-bold text-gray-900">{value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {locationBreakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Location Breakdown</h3>
                <div className="space-y-2">
                  {locationBreakdown.map(l => {
                    const pct = total ? Math.round((l.count / total) * 100) : 0
                    return (
                      <div key={l.locationId}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700">{l.name}</span>
                          <span className="text-sm font-medium text-gray-900">{l.count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="border-b border-gray-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
