import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { FeatureFlagGate } from "@/components/layout/feature-flag-gate"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { RegionsClient } from "./regions-client"

export const dynamic = "force-dynamic"

export default async function RegionsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER"].includes(session.role)) redirect("/dashboard")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { regions_enabled: true },
  })

  if (!org?.regions_enabled) {
    return (
      <div>
        <Header title="Regions" />
        <FeatureFlagGate
          featureName="Regions"
          description="The Regions feature groups your locations into regional hierarchies for better reporting and management. Contact support to enable it for your organization."
        />
      </div>
    )
  }

  const [regions, locations] = await Promise.all([
    prisma.region.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { name: "asc" },
      include: {
        locations: { select: { id: true, name: true } },
        _count: { select: { users: true } },
      },
    }),
    prisma.location.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, regionId: true },
    }),
  ])

  const canEdit = ["ADMIN", "MANAGER"].includes(session.role)

  return (
    <div>
      <Header title="Regions" />
      <div className="p-6">
        <RegionsClient
          regions={regions.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            locationCount: r.locations.length,
            userCount: r._count.users,
            locations: r.locations,
          }))}
          allLocations={locations}
          canEdit={canEdit}
        />
      </div>
    </div>
  )
}
