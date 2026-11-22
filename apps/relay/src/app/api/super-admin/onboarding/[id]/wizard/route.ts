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
// org/contact info for the header, and overall progress counts.
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

  const progress = (record.wizardProgress ?? null) as WizardProgress | null
  const stepsWithStatus = getStepWithStatuses(progress)

  const completedCount = stepsWithStatus.filter(s => s.status === "completed").length
  const skippedCount   = stepsWithStatus.filter(s => s.status === "skipped").length

  return NextResponse.json({
    id:                   record.id,
    organizationId:       record.organizationId,
    organizationName:     record.organization.name,
    plan:                 record.plan,
    status:               record.status,
    primaryContactName:   record.primaryContactName,
    primaryContactEmail:  record.primaryContactEmail,
    trialStartDate:       record.trialStartDate?.toISOString() ?? null,
    isDemo:               record.organization.isDemo,
    isPostLaunch:         record.status === "invitation_sent" || record.status === "live",
    steps:                stepsWithStatus,
    totalSteps:           WIZARD_STEPS.length,
    completedCount,
    skippedCount,
    progress: progress ?? defaultProgress(),
  })
}
