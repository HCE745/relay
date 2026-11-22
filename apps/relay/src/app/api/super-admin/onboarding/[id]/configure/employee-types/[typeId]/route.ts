import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"
import type { Prisma } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string; typeId: string }> }

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/employee-types/[id]]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── PATCH /api/super-admin/onboarding/[id]/configure/employee-types/[typeId] ─
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, typeId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const empType = await prisma.employeeType.findUnique({
    where:  { id: typeId },
    select: { id: true, organizationId: true, name: true, baseRole: true },
  })
  if (!empType || empType.organizationId !== access.orgId) {
    return NextResponse.json({ error: "Employee type not found" }, { status: 404 })
  }

  const body = await req.json() as {
    name?:          string
    description?:   string | null
    pageAccess?:    unknown
    actions?:       unknown
    canInvite?:     boolean
    canChangeEmail?: boolean
  }

  const data: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const v = body.name.trim()
    if (!v) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 })
    data.name = v
  }
  if ("description"   in body) data.description   = body.description   ?? null
  if ("pageAccess"    in body) data.pageAccess    = body.pageAccess    as Prisma.InputJsonValue
  if ("actions"       in body) data.actions       = body.actions       as Prisma.InputJsonValue
  if ("canInvite"     in body) data.canInvite     = body.canInvite
  if ("canChangeEmail" in body) data.canChangeEmail = body.canChangeEmail

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 })
  }

  const updated = await prisma.employeeType.update({ where: { id: typeId }, data })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "UPDATE_EMPLOYEE_TYPE",
    targetModel:   "EmployeeType",
    targetId:      typeId,
    after:         data,
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(updated)
}

// ── DELETE /api/super-admin/onboarding/[id]/configure/employee-types/[typeId] ─
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, typeId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const empType = await prisma.employeeType.findUnique({
    where:  { id: typeId },
    select: { id: true, name: true, organizationId: true },
  })
  if (!empType || empType.organizationId !== access.orgId) {
    return NextResponse.json({ error: "Employee type not found" }, { status: 404 })
  }

  await prisma.employeeType.delete({ where: { id: typeId } })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "DELETE_EMPLOYEE_TYPE",
    targetModel:   "EmployeeType",
    targetId:      typeId,
    before:        { name: empType.name },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json({ ok: true })
}
