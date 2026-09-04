import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Header } from "@/components/layout/header"
import { CatalogClient } from "./catalog-client"
import { isProfessional } from "@/lib/pricing"
import { PlanGateContent } from "@/components/layout/plan-gate"

export const dynamic = "force-dynamic"

export default async function CatalogPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER"].includes(session.role)) redirect("/dashboard")

  if (!isProfessional(session.plan ?? "essentials")) {
    return (
      <div>
        <Header title="Approved Item Catalog" />
        <PlanGateContent feature="Approval Intelligence" />
      </div>
    )
  }

  const [items, vendors, policies] = await Promise.all([
    prisma.approvedCatalogItem.findMany({
      where: { organizationId: session.organizationId },
      include: {
        preferredVendor: { select: { id: true, name: true } },
        approvalPolicy:  { select: { id: true, name: true } },
        _count: { select: { purchaseRequests: true } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.vendor.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.approvalPolicy.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div>
      <Header title="Approved Item Catalog" />
      <div className="p-4 md:p-6">
        <CatalogClient
          initialItems={items.map(i => ({
            id:               i.id,
            name:             i.name,
            category:         i.category,
            description:      i.description,
            vendorSku:        i.vendorSku,
            manufacturer:     i.manufacturer,
            modelNumber:      i.modelNumber,
            estimatedCost:    i.estimatedCost,
            replacementUrl:   i.replacementUrl,
            autoApproveBelow: i.autoApproveBelow,
            notes:            i.notes,
            isActive:         i.isActive,
            createdAt:        i.createdAt.toISOString(),
            preferredVendor:  i.preferredVendor,
            approvalPolicy:   i.approvalPolicy,
            requestCount:     i._count.purchaseRequests,
          }))}
          vendors={vendors}
          policies={policies}
        />
      </div>
    </div>
  )
}
