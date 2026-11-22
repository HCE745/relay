import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"
import {
  WIZARD_STEP_KEYS, defaultProgress, getStepWithStatuses,
  type WizardProgress,
} from "@/lib/wizard-steps"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/progress]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── PATCH /api/super-admin/onboarding/[id]/wizard-progress ───────────────────
//
// Updates wizard step navigation state on the CustomerOnboarding record.
// Also auto-advances status from "draft" → "configuring" on first wizard open.
//
// Body:
//   currentStepKey?  — navigate to a step
//   markCompleted?   — key of a step to mark as completed
//   markSkipped?     — key of a step to mark as skipped
//   unmarkStep?      — remove a step from completed/skipped sets
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const body = await req.json() as {
    currentStepKey?: string
    markCompleted?:  string
    markSkipped?:    string
    unmarkStep?:     string
  }

  // Validate provided step keys
  for (const key of [body.currentStepKey, body.markCompleted, body.markSkipped, body.unmarkStep]) {
    if (key !== undefined && !WIZARD_STEP_KEYS.includes(key as never)) {
      return NextResponse.json({ error: `Invalid step key: ${key}` }, { status: 400 })
    }
  }

  if (
    body.currentStepKey === undefined &&
    body.markCompleted  === undefined &&
    body.markSkipped    === undefined &&
    body.unmarkStep     === undefined
  ) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 })
  }

  // Load current state
  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { status: true, wizardProgress: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const current: WizardProgress =
    (record.wizardProgress as WizardProgress | null) ?? defaultProgress()

  const completedSet = new Set(current.completedSteps)
  const skippedSet   = new Set(current.skippedSteps)

  if (body.markCompleted) {
    completedSet.add(body.markCompleted)
    skippedSet.delete(body.markCompleted)
  }
  if (body.markSkipped) {
    skippedSet.add(body.markSkipped)
    completedSet.delete(body.markSkipped)
  }
  if (body.unmarkStep) {
    completedSet.delete(body.unmarkStep)
    skippedSet.delete(body.unmarkStep)
  }

  const updated: WizardProgress = {
    currentStepKey:  body.currentStepKey ?? current.currentStepKey,
    completedSteps:  [...completedSet],
    skippedSteps:    [...skippedSet],
    lastSavedAt:     new Date().toISOString(),
    stagedEmployees: current.stagedEmployees ?? [],  // preserve staged employees on nav updates
  }

  const dbData: Record<string, unknown> = { wizardProgress: updated }

  // Auto-advance status from draft → configuring on first wizard interaction
  if (record.status === "draft") {
    dbData.status = "configuring"
  }

  await prisma.customerOnboarding.update({ where: { id }, data: dbData })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "UPDATE_WIZARD_PROGRESS",
    targetModel:   "CustomerOnboarding",
    targetId:      id,
    after:         { currentStepKey: updated.currentStepKey, ...body },
    sessionId:     id,
  })

  const stepsWithStatus = getStepWithStatuses(updated)
  const completedCount  = stepsWithStatus.filter(s => s.status === "completed").length

  return NextResponse.json({
    progress:       updated,
    completedCount,
    statusAdvanced: record.status === "draft" ? "configuring" : null,
  })
}
