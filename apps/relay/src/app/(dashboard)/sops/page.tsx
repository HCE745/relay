import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { SopLibrary } from "./sop-library"
import { PlanGateContent } from "@/components/layout/plan-gate"
import { isProfessional } from "@/lib/pricing"

export const dynamic = "force-dynamic"

export default async function SopsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  if (!isProfessional(session.plan ?? "essentials")) {
    return (
      <div>
        <Header title="SOPs" />
        <PlanGateContent feature="sops" />
      </div>
    )
  }

  const isAdminLevel = ["ADMIN", "MANAGER"].includes(session.role)

  const [sops, departments] = await Promise.all([
    prisma.sOP.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      include: {
        department: { select: { id: true, name: true } },
        _count:     { select: { issues: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.department.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div>
      <Header title="SOP Library" />
      <div className="p-4 md:p-6 max-w-5xl">
        <SopLibrary
          initialSops={sops.map(s => ({
            id:               s.id,
            title:            s.title,
            description:      s.description,
            category:         s.category,
            assetType:        s.assetType,
            version:          s.version,
            department:       s.department,
            linkedIssueCount: s._count.issues,
            updatedAt:        s.updatedAt.toISOString(),
            uploadedFilename: s.uploadedFilename,
          }))}
          departments={departments}
          isAdminLevel={isAdminLevel}
        />
      </div>
    </div>
  )
}
