import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"
import type { Prisma } from "@/generated/prisma/client"
import type { OrgFeatureFlags } from "@/lib/pricing"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// Real Boolean feature flags on Organization (subset relevant to wizard setup)
const WIZARD_FLAGS: (keyof OrgFeatureFlags)[] = [
  "qr_codes_enabled",
  "regions_enabled",
  "advanced_escalations_enabled",
  "recognition_enabled",
  "executive_briefings_enabled",
  "health_scores_enabled",
  "trend_detection_enabled",
]

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/org-settings]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── GET /api/super-admin/onboarding/[id]/configure/org-settings ──────────────
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { organizationId: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const org = await prisma.organization.findUnique({
    where:  { id: record.organizationId },
    select: {
      priorityRulesConfig:     true,
      terminologyConfig:       true,
      notificationRulesConfig: true,
      ackEscalationConfig:     true,
      sopMatchSensitivity:     true,
      injuryAlertEmails:       true,
      qr_codes_enabled:        true,
      regions_enabled:         true,
      advanced_escalations_enabled: true,
      recognition_enabled:          true,
      executive_briefings_enabled:  true,
      health_scores_enabled:        true,
      trend_detection_enabled:      true,
    },
  })
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  const { qr_codes_enabled, regions_enabled, advanced_escalations_enabled,
          recognition_enabled, executive_briefings_enabled, health_scores_enabled,
          trend_detection_enabled, ...jsonConfigs } = org

  return NextResponse.json({
    ...jsonConfigs,
    featureFlags: {
      qr_codes_enabled, regions_enabled, advanced_escalations_enabled,
      recognition_enabled, executive_briefings_enabled, health_scores_enabled,
      trend_detection_enabled,
    },
  })
}

// ── PATCH /api/super-admin/onboarding/[id]/configure/org-settings ─────────────
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const body = await req.json() as {
    priorityRulesConfig?:     unknown
    terminologyConfig?:       unknown
    notificationRulesConfig?: unknown
    ackEscalationConfig?:     unknown
    sopMatchSensitivity?:     string
    injuryAlertEmails?:       unknown
    featureFlags?:            Partial<Record<keyof OrgFeatureFlags, boolean>>
  }

  const data: Record<string, unknown> = {}
  const before: Record<string, unknown> = {}

  const org = await prisma.organization.findUnique({
    where:  { id: access.orgId },
    select: {
      priorityRulesConfig: true, terminologyConfig: true,
      notificationRulesConfig: true, ackEscalationConfig: true,
      sopMatchSensitivity: true,
    },
  })
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  if ("priorityRulesConfig"     in body) { before.priorityRulesConfig     = org.priorityRulesConfig;     data.priorityRulesConfig     = body.priorityRulesConfig     as Prisma.InputJsonValue ?? null }
  if ("terminologyConfig"       in body) { before.terminologyConfig       = org.terminologyConfig;       data.terminologyConfig       = body.terminologyConfig       as Prisma.InputJsonValue ?? null }
  if ("notificationRulesConfig" in body) { before.notificationRulesConfig = org.notificationRulesConfig; data.notificationRulesConfig = body.notificationRulesConfig as Prisma.InputJsonValue ?? null }
  if ("ackEscalationConfig"     in body) { before.ackEscalationConfig     = org.ackEscalationConfig;     data.ackEscalationConfig     = body.ackEscalationConfig     as Prisma.InputJsonValue ?? null }
  if ("sopMatchSensitivity"     in body && body.sopMatchSensitivity) {
    if (!["LOW", "MEDIUM", "HIGH"].includes(body.sopMatchSensitivity)) {
      return NextResponse.json({ error: "sopMatchSensitivity must be LOW, MEDIUM, or HIGH" }, { status: 400 })
    }
    before.sopMatchSensitivity = org.sopMatchSensitivity
    data.sopMatchSensitivity   = body.sopMatchSensitivity
  }
  if ("injuryAlertEmails" in body) {
    data.injuryAlertEmails = body.injuryAlertEmails as Prisma.InputJsonValue ?? null
  }

  // Boolean feature flags
  if (body.featureFlags && typeof body.featureFlags === "object") {
    for (const key of WIZARD_FLAGS) {
      if (key in body.featureFlags && typeof body.featureFlags[key] === "boolean") {
        data[key] = body.featureFlags[key]
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 })
  }

  await prisma.organization.update({ where: { id: access.orgId }, data })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "UPDATE_ORG_SETTINGS",
    targetModel:   "Organization",
    targetId:      access.orgId,
    before,
    after:         data,
    sessionId:     access.onboardingId,
  })

  return NextResponse.json({ ok: true })
}
