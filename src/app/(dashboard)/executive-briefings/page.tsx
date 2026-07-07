import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { FeatureFlagGate } from "@/components/layout/feature-flag-gate"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { ExecutiveBriefingsClient } from "./executive-briefings-client"

export const dynamic = "force-dynamic"

export default async function ExecutiveBriefingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER"].includes(session.role)) redirect("/dashboard")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { executive_briefings_enabled: true },
  })

  if (!org?.executive_briefings_enabled) {
    return (
      <div>
        <Header title="Executive AI Briefings" />
        <FeatureFlagGate
          featureName="Executive AI Briefings"
          description="Executive AI Briefings automatically generate daily, weekly, and monthly operational summaries using AI. Contact support to enable this feature."
        />
      </div>
    )
  }

  const briefings = await prisma.executiveBriefing.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    take: 30,
  })

  return (
    <div>
      <Header title="Executive AI Briefings" />
      <ExecutiveBriefingsClient briefings={briefings} orgId={session.organizationId} />
    </div>
  )
}
