import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import type { OrgFeatureFlags } from "@/lib/pricing"

const ALLOWED_FLAGS: (keyof OrgFeatureFlags)[] = [
  "regions_enabled",
  "corporate_dashboard_enabled",
  "cross_location_analytics_enabled",
  "advanced_escalations_enabled",
  "api_webhooks_enabled",
  "sso_foundation_enabled",
  "shared_facility_enabled",
  "qr_codes_enabled",
  "external_collaborators_enabled",
  "multi_org_enabled",
  "executive_briefings_enabled",
  "health_scores_enabled",
  "trend_detection_enabled",
  "executive_goals_enabled",
]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as Partial<OrgFeatureFlags>

  // Only allow known flag keys
  const updates: Partial<Record<keyof OrgFeatureFlags, boolean>> = {}
  for (const key of ALLOWED_FLAGS) {
    if (key in body && typeof body[key] === "boolean") {
      updates[key] = body[key]!
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid flags provided" }, { status: 400 })
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: updates,
    select: {
      regions_enabled: true,
      corporate_dashboard_enabled: true,
      cross_location_analytics_enabled: true,
      advanced_escalations_enabled: true,
      api_webhooks_enabled: true,
      sso_foundation_enabled: true,
      shared_facility_enabled: true,
      qr_codes_enabled: true,
      external_collaborators_enabled: true,
      multi_org_enabled: true,
      executive_briefings_enabled: true,
      health_scores_enabled: true,
      trend_detection_enabled: true,
      executive_goals_enabled: true,
    },
  })

  return NextResponse.json({ flags: updated })
}
