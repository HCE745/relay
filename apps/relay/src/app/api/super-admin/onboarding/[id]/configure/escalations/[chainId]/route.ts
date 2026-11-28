import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string; chainId: string }> }

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/escalations/[chainId]]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── PATCH /api/super-admin/onboarding/[id]/configure/escalations/[chainId] ───
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, chainId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const existing = await prisma.escalationChain.findUnique({
    where:  { id: chainId },
    select: { organizationId: true, name: true },
  })
  if (!existing || existing.organizationId !== access.orgId) {
    return NextResponse.json({ error: "Escalation chain not found" }, { status: 404 })
  }

  const body = await req.json() as Record<string, unknown>
  const data: Record<string, unknown> = {}

  if (typeof body.name        === "string")  data.name        = body.name.trim() || existing.name
  if (typeof body.description === "string")  data.description = body.description.trim() || null
  if ("triggerPriority"     in body)         data.triggerPriority     = body.triggerPriority     ?? null
  if ("triggerCategory"     in body)         data.triggerCategory     = body.triggerCategory     ?? null
  if ("triggerLocationId"   in body)         data.triggerLocationId   = body.triggerLocationId   ?? null
  if ("triggerDepartmentId" in body)         data.triggerDepartmentId = body.triggerDepartmentId ?? null
  if (typeof body.hoursToFirst === "number") data.hoursToFirst        = Math.max(1, Math.round(body.hoursToFirst))
  if (typeof body.isActive === "boolean")    data.isActive            = body.isActive

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 })
  }

  const updated = await prisma.escalationChain.update({
    where:   { id: chainId },
    data,
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "UPDATE_ESCALATION_CHAIN",
    targetModel:   "EscalationChain",
    targetId:      chainId,
    after:         data,
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(updated)
}

// ── DELETE /api/super-admin/onboarding/[id]/configure/escalations/[chainId] ──
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, chainId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const existing = await prisma.escalationChain.findUnique({
    where:  { id: chainId },
    select: { organizationId: true, name: true },
  })
  if (!existing || existing.organizationId !== access.orgId) {
    return NextResponse.json({ error: "Escalation chain not found" }, { status: 404 })
  }

  await prisma.escalationChain.delete({ where: { id: chainId } })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "DELETE_ESCALATION_CHAIN",
    targetModel:   "EscalationChain",
    targetId:      chainId,
    before:        { name: existing.name },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json({ ok: true })
}
