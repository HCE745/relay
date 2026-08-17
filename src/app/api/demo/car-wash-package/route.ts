import { NextRequest, NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { setWorkforceCommsPlanFlags } from "@/lib/workforce-comms"

type CarWashPkg = "wash_essentials" | "full_relay"
const VALID_PKG = new Set<CarWashPkg>(["wash_essentials", "full_relay"])

const ALL_MODULES = [
  "issue_intelligence",
  "sop_intelligence",
  "asset_intelligence",
  "benchmark_intelligence",
  "purchase_intelligence",
]

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.isDemo) {
    return NextResponse.json({ error: "Not a demo session" }, { status: 403 })
  }

  const body = await request.json() as { package?: string }
  const pkg: CarWashPkg = VALID_PKG.has(body.package as CarWashPkg)
    ? (body.package as CarWashPkg)
    : "wash_essentials"

  const isFullRelay = pkg === "full_relay"
  const plan        = isFullRelay ? "professional_plus" : "wash_essentials"
  const productLine = isFullRelay ? "RELAY_STANDARD"    : "WASH_ESSENTIALS"
  const modules     = isFullRelay ? ALL_MODULES : []

  await setWorkforceCommsPlanFlags(session.organizationId, plan)

  await prisma.organization.update({
    where: { id: session.organizationId },
    data: {
      plan,
      regions_enabled:                  isFullRelay,
      corporate_dashboard_enabled:      isFullRelay,
      cross_location_analytics_enabled: isFullRelay,
      advanced_escalations_enabled:     isFullRelay,
      api_webhooks_enabled:             isFullRelay,
      sso_foundation_enabled:           isFullRelay,
      shared_facility_enabled:          isFullRelay,
      executive_briefings_enabled:      isFullRelay,
      health_scores_enabled:            isFullRelay,
      trend_detection_enabled:          isFullRelay,
      executive_goals_enabled:          isFullRelay,
      intelligenceModules:      modules,
      intelligenceSuiteEnabled: isFullRelay,
      aiSuggestionsAvailable:   isFullRelay,
      purchaseRequestEnabled:   isFullRelay,
    },
  })

  await createSession({
    userId:              session.userId,
    email:               session.email,
    name:                session.name,
    role:                session.role,
    organizationId:      session.organizationId,
    onboardingCompleted: true,
    subscriptionStatus:  "active",
    plan,
    productLine,
    isDemo:              true,
  })

  return NextResponse.json({ ok: true, plan, productLine })
}
