import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { FeatureFlagGate } from "@/components/layout/feature-flag-gate"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { EscalationChainsClient } from "./escalation-chains-client"

export const dynamic = "force-dynamic"

export default async function EscalationsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER"].includes(session.role)) redirect("/dashboard")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { advanced_escalations_enabled: true },
  })

  if (!org?.advanced_escalations_enabled) {
    return (
      <div>
        <Header title="Advanced Escalation Chains" />
        <FeatureFlagGate
          featureName="Advanced Escalation Trees"
          description="Build multi-step escalation chains triggered by issue priority, category, location, or time. Contact support to enable."
        />
      </div>
    )
  }

  const [chains, locations, departments, users] = await Promise.all([
    prisma.escalationChain.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    }),
    prisma.location.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      select: { id: true, name: true, role: true, email: true, department: { select: { name: true } }, location: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div>
      <Header title="Advanced Escalation Chains" />
      <div className="p-6">
        <EscalationChainsClient
          chains={chains.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            isActive: c.isActive,
            triggerPriority: c.triggerPriority,
            triggerCategory: c.triggerCategory,
            triggerLocationId: c.triggerLocationId,
            triggerDepartmentId: c.triggerDepartmentId,
            hoursToFirst: c.hoursToFirst,
            steps: c.steps,
          }))}
          locations={locations}
          departments={departments}
          users={users.map(u => ({ id: u.id, name: u.name, role: u.role, email: u.email, department: u.department?.name ?? undefined, location: u.location?.name ?? undefined }))}
        />
      </div>
    </div>
  )
}
