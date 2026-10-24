import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { hasWashOrProfessional } from "@/lib/pricing"
import { PlanGateContent } from "@/components/layout/plan-gate"
import { DashboardClient } from "./DashboardClient"
import { DASHBOARD_TEMPLATES } from "@/lib/analytics/types"
import type { WidgetConfig } from "@/lib/analytics/types"

export const dynamic = "force-dynamic"

function getRoleDefaultTemplate(role: string) {
  if (role === "ADMIN" || role === "EXECUTIVE") {
    return DASHBOARD_TEMPLATES.find(t => t.key === "operations_overview") ?? DASHBOARD_TEMPLATES[0]
  }
  if (role === "MANAGER") {
    return DASHBOARD_TEMPLATES.find(t => t.key === "team_performance") ?? DASHBOARD_TEMPLATES[0]
  }
  // SUPERVISOR / EMPLOYEE — simplified operations view
  return DASHBOARD_TEMPLATES.find(t => t.key === "operations_overview") ?? DASHBOARD_TEMPLATES[0]
}

export default async function AnalyticsDashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)) redirect("/dashboard")

  if (!session.isDemo && !hasWashOrProfessional(session.plan ?? "essentials", session.productLine)) {
    return (
      <div>
        <Header title="Dashboard" />
        <PlanGateContent feature="analytics" />
      </div>
    )
  }

  const { organizationId, userId, role } = session

  // 1. Look for user's own saved layout
  const personalLayout = await prisma.dashboardLayout.findFirst({
    where: { organizationId, createdById: userId, layoutType: "PERSONAL", isDefault: true },
  })

  // 2. If none, check for an org-wide default
  const orgDefault = !personalLayout
    ? await prisma.dashboardLayout.findFirst({
        where: { organizationId, isOrgDefault: true },
      })
    : null

  // 3. Fall back to any personal layout the user has
  const anyPersonal = (!personalLayout && !orgDefault)
    ? await prisma.dashboardLayout.findFirst({
        where: { organizationId, createdById: userId },
        orderBy: { updatedAt: "desc" },
      })
    : null

  const raw = personalLayout ?? orgDefault ?? anyPersonal
  const roleDefault = getRoleDefaultTemplate(role)

  const initialLayout = raw
    ? {
        id:          raw.id,
        name:        raw.name,
        layoutType:  raw.layoutType,
        isOrgDefault: raw.isOrgDefault,
        createdById: raw.createdById,
        widgets:     raw.widgets as unknown as WidgetConfig[],
      }
    : {
        name:       roleDefault.name,
        layoutType: "PERSONAL",
        isOrgDefault: false,
        createdById: userId,
        widgets:    roleDefault.widgets,
      }

  // Fetch team members for recipient selection (admin only)
  const teamMembers = role === "ADMIN"
    ? await prisma.user.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      })
    : []

  return (
    <div>
      <Header title="Analytics Dashboard" />
      <DashboardClient
        initialLayout={initialLayout}
        templates={DASHBOARD_TEMPLATES}
        role={role}
        userId={userId}
        teamMembers={teamMembers}
      />
    </div>
  )
}
