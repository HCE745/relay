import { NextRequest, NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { setWorkforceCommsPlanFlags } from "@/lib/workforce-comms"

type DemoPkg = "essentials" | "professional" | "professional_plus"

const VALID_PACKAGES = new Set<DemoPkg>(["essentials", "professional", "professional_plus"])

const VALID_MODULES = new Set([
  "issue_intelligence",
  "sop_intelligence",
  "asset_intelligence",
  "benchmark_intelligence",
  "purchase_intelligence",
])

const ALL_MODULES = [
  "issue_intelligence",
  "sop_intelligence",
  "asset_intelligence",
  "benchmark_intelligence",
  "purchase_intelligence",
]

const PACKAGE_PLAN: Record<DemoPkg, string> = {
  essentials:        "essentials",
  professional:      "pro",
  professional_plus: "professional_plus",
}

const PACKAGE_PLUS_FLAGS: Record<DemoPkg, boolean> = {
  essentials:        false,
  professional:      false,
  professional_plus: true,
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.isDemo) {
    return NextResponse.json({ error: "Not a demo session" }, { status: 403 })
  }

  const body = await request.json() as { package?: string; modules?: string[] }

  const pkg: DemoPkg = VALID_PACKAGES.has(body.package as DemoPkg)
    ? (body.package as DemoPkg)
    : "professional"

  // Sanitise modules — essentials never gets intelligence modules
  const rawModules  = (body.modules ?? []).filter(m => VALID_MODULES.has(m))
  const modules     = pkg === "essentials" ? [] : rawModules
  const allEnabled  = modules.length === ALL_MODULES.length
  const plan        = PACKAGE_PLAN[pkg]
  const isPlusFlags = PACKAGE_PLUS_FLAGS[pkg]

  await setWorkforceCommsPlanFlags(session.organizationId, plan)

  await prisma.organization.update({
    where: { id: session.organizationId },
    data: {
      plan,
      // Professional Plus feature flags
      regions_enabled:                  isPlusFlags,
      corporate_dashboard_enabled:      isPlusFlags,
      cross_location_analytics_enabled: isPlusFlags,
      advanced_escalations_enabled:     isPlusFlags,
      api_webhooks_enabled:             isPlusFlags,
      sso_foundation_enabled:           isPlusFlags,
      shared_facility_enabled:          isPlusFlags,
      executive_briefings_enabled:      isPlusFlags,
      health_scores_enabled:            isPlusFlags,
      trend_detection_enabled:          isPlusFlags,
      executive_goals_enabled:          isPlusFlags,
      // Intelligence modules
      intelligenceModules:      modules,
      intelligenceSuiteEnabled: allEnabled && pkg !== "essentials",
      aiSuggestionsAvailable:   modules.length > 0,
      purchaseRequestEnabled:   modules.includes("purchase_intelligence"),
    },
  })

  // Re-issue session JWT so plan-based gating in page components picks up the change
  await createSession({
    userId:              session.userId,
    email:               session.email,
    name:                session.name,
    role:                session.role,
    organizationId:      session.organizationId,
    onboardingCompleted: true,
    subscriptionStatus:  "active",
    plan,
    isDemo:              true,
  })

  return NextResponse.json({ ok: true, plan, modules })
}
