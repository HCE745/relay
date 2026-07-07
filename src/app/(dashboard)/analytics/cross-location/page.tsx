import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { FeatureFlagGate } from "@/components/layout/feature-flag-gate"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { CrossLocationClient } from "./cross-location-client"
import { isProfessional } from "@/lib/pricing"
import { PlanGateContent } from "@/components/layout/plan-gate"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function CrossLocationAnalyticsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER"].includes(session.role)) redirect("/dashboard")

  if (!isProfessional(session.plan ?? "essentials")) {
    return (
      <div>
        <Header title="Cross-Location Analytics" />
        <PlanGateContent feature="analytics" />
      </div>
    )
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { cross_location_analytics_enabled: true },
  })

  if (!org?.cross_location_analytics_enabled) {
    return (
      <div>
        <Header title="Cross-Location Analytics" />
        <FeatureFlagGate
          featureName="Cross-Location Analytics"
          description="Compare issue volume, resolution times, and escalation rates side-by-side across locations, regions, and departments. Contact support to enable."
        />
      </div>
    )
  }

  const orgId = session.organizationId
  const [locations, departments, regions] = await Promise.all([
    prisma.location.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, regionId: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.region.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div>
      <Header
        title="Cross-Location Analytics"
        actions={
          <Link href="/analytics" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Analytics
          </Link>
        }
      />
      <div className="p-6">
        <CrossLocationClient
          locations={locations}
          departments={departments}
          regions={regions}
          organizationId={orgId}
        />
      </div>
    </div>
  )
}
