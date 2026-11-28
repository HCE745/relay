import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string; ruleId: string }> }

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/routing-rules/[ruleId]]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── PATCH /api/super-admin/onboarding/[id]/configure/routing-rules/[ruleId] ──
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, ruleId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const existing = await prisma.routingRule.findUnique({
    where:  { id: ruleId },
    select: { organizationId: true, name: true },
  })
  if (!existing || existing.organizationId !== access.orgId) {
    return NextResponse.json({ error: "Routing rule not found" }, { status: 404 })
  }

  const body = await req.json() as Record<string, unknown>
  const data: Record<string, unknown> = {}

  if (typeof body.name        === "string") data.name        = body.name.trim() || existing.name
  if (typeof body.description === "string") data.description = body.description.trim() || null
  if ("condCategory"   in body)             data.condCategory   = body.condCategory   ?? null
  if ("condLocationId" in body)             data.condLocationId = body.condLocationId ?? null
  if ("condDeptId"     in body)             data.condDeptId     = body.condDeptId     ?? null
  if ("condPriority"   in body)             data.condPriority   = body.condPriority   ?? null
  if ("assignToRole"   in body)             data.assignToRole   = body.assignToRole   ?? null
  if ("assignToUserId" in body)             data.assignToUserId = body.assignToUserId ?? null
  if (typeof body.isActive === "boolean")   data.isActive       = body.isActive

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 })
  }

  const updated = await prisma.routingRule.update({ where: { id: ruleId }, data })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "UPDATE_ROUTING_RULE",
    targetModel:   "RoutingRule",
    targetId:      ruleId,
    after:         data,
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(updated)
}

// ── DELETE /api/super-admin/onboarding/[id]/configure/routing-rules/[ruleId] ─
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, ruleId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const existing = await prisma.routingRule.findUnique({
    where:  { id: ruleId },
    select: { organizationId: true, name: true },
  })
  if (!existing || existing.organizationId !== access.orgId) {
    return NextResponse.json({ error: "Routing rule not found" }, { status: 404 })
  }

  await prisma.routingRule.delete({ where: { id: ruleId } })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "DELETE_ROUTING_RULE",
    targetModel:   "RoutingRule",
    targetId:      ruleId,
    before:        { name: existing.name },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json({ ok: true })
}
