import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { PoliciesClient } from "./policies-client"
import { isProfessional } from "@/lib/pricing"
import { PlanGateContent } from "@/components/layout/plan-gate"

export const dynamic = "force-dynamic"

export default async function PoliciesPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER"].includes(session.role)) redirect("/dashboard")

  if (!isProfessional(session.plan ?? "essentials")) {
    return (
      <div>
        <Header title="Approval Policies" />
        <PlanGateContent feature="Approval Intelligence" />
      </div>
    )
  }

  const [policies, departments, locations, vendors, catalogItems] = await Promise.all([
    prisma.approvalPolicy.findMany({
      where: { organizationId: session.organizationId },
      include: {
        rules: { orderBy: { priority: "asc" } },
        _count: { select: { catalogItems: true, purchaseRequests: true } },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.department.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.vendor.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.approvedCatalogItem.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      select: { id: true, name: true, category: true, estimatedCost: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div>
      <Header title="Approval Policies" />
      <div className="p-4 md:p-6">
        <PoliciesClient
          initialPolicies={policies.map(p => ({
            id:                 p.id,
            name:               p.name,
            description:        p.description,
            isDefault:          p.isDefault,
            escalateAfterHours: p.escalateAfterHours,
            createdAt:          p.createdAt.toISOString(),
            rules:              p.rules.map(r => ({
              id: r.id, priority: r.priority,
              minAmount: r.minAmount, maxAmount: r.maxAmount,
              category: r.category, departmentId: r.departmentId,
              locationId: r.locationId, vendorId: r.vendorId,
              approvalPath: r.approvalPath, escalateAfterHours: r.escalateAfterHours,
            })),
            catalogItemCount:  p._count.catalogItems,
            requestCount:      p._count.purchaseRequests,
          }))}
          departments={departments}
          locations={locations}
          vendors={vendors}
          catalogItems={catalogItems}
        />
      </div>
    </div>
  )
}
