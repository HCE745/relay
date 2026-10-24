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

  const { organizationId, userId } = session

  const savedLayout = await prisma.dashboardLayout.findFirst({
    where: {
      organizationId,
      OR: [{ createdById: userId }, { layoutType: "SHARED" }],
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  })

  const initialLayout = savedLayout
    ? { id: savedLayout.id, name: savedLayout.name, widgets: savedLayout.widgets as unknown as WidgetConfig[] }
    : null

  return (
    <div>
      <Header title="Analytics Dashboard" />
      <DashboardClient initialLayout={initialLayout} templates={DASHBOARD_TEMPLATES} />
    </div>
  )
}
