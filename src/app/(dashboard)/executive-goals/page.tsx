import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { FeatureFlagGate } from "@/components/layout/feature-flag-gate"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { ExecutiveGoalsClient } from "./executive-goals-client"

export const dynamic = "force-dynamic"

export default async function ExecutiveGoalsPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!["ADMIN", "MANAGER"].includes(session.role)) redirect("/dashboard")

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { executive_goals_enabled: true },
  })

  if (!org?.executive_goals_enabled) {
    return (
      <div>
        <Header title="Executive Goals" />
        <FeatureFlagGate
          featureName="Executive Goals"
          description="Executive Goals let you set and track strategic operational targets with AI-powered progress calculations. Contact support to enable this feature."
        />
      </div>
    )
  }

  const goals = await prisma.executiveGoal.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { targetDate: "asc" },
    include: {
      progress: {
        orderBy: { calculatedAt: "desc" },
        take: 10,
      },
    },
  })

  return (
    <div>
      <Header title="Executive Goals" />
      <ExecutiveGoalsClient
        goals={goals}
        orgId={session.organizationId}
        userRole={session.role}
      />
    </div>
  )
}
