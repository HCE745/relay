import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { FeatureFlagGate } from "@/components/layout/feature-flag-gate"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { TrendAlertsClient } from "./trend-alerts-client"

export const dynamic = "force-dynamic"

export default async function TrendAlertsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER"].includes(session.role)) redirect("/dashboard")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { trend_detection_enabled: true },
  })

  if (!org?.trend_detection_enabled) {
    return (
      <div>
        <Header title="Trend Alerts" />
        <FeatureFlagGate
          featureName="AI Trend Detection"
          description="Automatically detect operational trends: issue volume spikes, recurring assets, safety increases, and slow resolution times. Powered by AI. Contact support to enable."
        />
      </div>
    )
  }

  const alerts = await prisma.trendAlert.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ status: "asc" }, { detectedAt: "desc" }],
    take: 100,
  })

  return (
    <div>
      <Header title="Trend Alerts" />
      <TrendAlertsClient
        orgId={session.organizationId}
        initialAlerts={alerts.map(a => ({
          id:             a.id,
          trendType:      a.trendType,
          title:          a.title,
          description:    a.description,
          severity:       a.severity,
          supportingData: a.supportingData as Record<string, unknown>,
          recommendation: a.recommendation,
          status:         a.status,
          detectedAt:     a.detectedAt.toISOString(),
        }))}
      />
    </div>
  )
}
