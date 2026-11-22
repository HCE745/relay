import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import {
  WIZARD_STEPS, getStepWithStatuses, defaultProgress,
  type WizardProgress,
} from "@/lib/wizard-steps"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// ── GET /api/super-admin/onboarding/[id]/wizard ──────────────────────────────
//
// Returns the wizard shell data: step definitions with computed statuses,
// org/contact info for the header, resource counts, and data-readiness flags.
// Allowed in all statuses (including post-launch) so SAs can review the record.
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const record = await prisma.customerOnboarding.findUnique({
    where:   { id },
    include: {
      organization: {
        select: { id: true, name: true, plan: true, isDemo: true, subscriptionStatus: true },
      },
    },
  })

  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const orgId = record.organizationId

  // Parallel counts for data-driven step completion
  const [locationCount, deptCount, empTypeCount, userCount, pendingInviteCount] = await Promise.all([
    prisma.location.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.department.count({ where: { organizationId: orgId } }),
    prisma.employeeType.count({ where: { organizationId: orgId } }),
    prisma.user.count({ where: { organizationId: orgId, isActive: true } }),
    prisma.invitation.count({
      where: { organizationId: orgId, usedAt: null, expiresAt: { gt: new Date() } },
    }),
  ])

  // Data-readiness: completion criteria for Steps 1–5 (data-driven, not manual)
  const dataReadiness: Record<string, boolean> = {
    overview:         !!record.primaryContactEmail?.trim() && !!record.trialStartDate,
    locations:        locationCount >= 1,
    departments:      deptCount >= 1,
    "employee-types": empTypeCount >= 1,
    "employee-list":  userCount >= 1,
  }

  const progress = (record.wizardProgress ?? null) as WizardProgress | null
  const stepsWithStatus = getStepWithStatuses(progress)

  // For data-driven steps, override completion with actual data readiness
  const DATA_DRIVEN = new Set(Object.keys(dataReadiness))
  const stepsResolved = stepsWithStatus.map(s => {
    if (s.key !== (progress?.currentStepKey ?? WIZARD_STEPS[0].key) && DATA_DRIVEN.has(s.key)) {
      return { ...s, status: (dataReadiness[s.key] ? "completed" : "incomplete") as typeof s.status }
    }
    return s
  })

  const completedCount = stepsResolved.filter(s => s.status === "completed").length
  const skippedCount   = stepsResolved.filter(s => s.status === "skipped").length

  return NextResponse.json({
    id:                   record.id,
    organizationId:       record.organizationId,
    organizationName:     record.organization.name,
    plan:                 record.plan,
    status:               record.status,
    primaryContactName:   record.primaryContactName,
    primaryContactEmail:  record.primaryContactEmail,
    trialStartDate:       record.trialStartDate?.toISOString() ?? null,
    internalNotes:        record.internalNotes ?? null,
    isDemo:               record.organization.isDemo,
    isPostLaunch:         record.status === "invitation_sent" || record.status === "live",
    steps:                stepsResolved,
    totalSteps:           WIZARD_STEPS.length,
    completedCount,
    skippedCount,
    progress: progress ?? defaultProgress(),
    counts: { locationCount, deptCount, empTypeCount, userCount, pendingInviteCount },
    dataReadiness,
  })
}
