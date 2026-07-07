import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { FeatureFlagGate } from "@/components/layout/feature-flag-gate"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { SharedFacilityClient } from "./shared-facility-client"

export const dynamic = "force-dynamic"

export default async function SharedFacilityPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.role !== "ADMIN") redirect("/dashboard")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { shared_facility_enabled: true, name: true },
  })

  if (!org?.shared_facility_enabled) {
    return (
      <div>
        <Header title="Shared Facility" />
        <FeatureFlagGate
          featureName="Shared Facility / Multi-Organization"
          description="Link your organization with partner organizations sharing the same facility. Route issues to the correct organization automatically. Contact support to enable."
        />
      </div>
    )
  }

  const relationships = await prisma.organizationRelationship.findMany({
    where: {
      OR: [
        { orgIdA: session.organizationId },
        { orgIdB: session.organizationId },
      ],
    },
    include: {
      orgA: { select: { id: true, name: true } },
      orgB: { select: { id: true, name: true } },
      sharedFacilityRules: {
        include: {
          relationship: { select: { orgIdA: true, orgIdB: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const departments = await prisma.department.findMany({
    where: { organizationId: session.organizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return (
    <div>
      <Header title="Shared Facility" />
      <div className="p-6">
        <SharedFacilityClient
          orgId={session.organizationId}
          orgName={org.name}
          relationships={relationships.map(r => ({
            id: r.id,
            orgIdA: r.orgIdA,
            orgAName: r.orgA.name,
            orgIdB: r.orgIdB,
            orgBName: r.orgB?.name ?? r.orgBName ?? "Pending acceptance",
            relationshipType: r.relationshipType,
            status: r.status,
            inviteEmail: r.inviteEmail,
            rules: r.sharedFacilityRules.map(rule => ({
              id: rule.id,
              issueCategories: rule.issueCategories,
              routingOrgId: rule.routingOrgId,
              routingDeptId: rule.routingDeptId,
            })),
          }))}
          departments={departments}
        />
      </div>
    </div>
  )
}
