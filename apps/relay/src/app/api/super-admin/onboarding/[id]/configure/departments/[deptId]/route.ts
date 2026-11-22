import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string; deptId: string }> }

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/departments/[id]]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── PATCH /api/super-admin/onboarding/[id]/configure/departments/[deptId] ────
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, deptId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const dept = await prisma.department.findUnique({
    where:  { id: deptId },
    select: { id: true, name: true, locationId: true, organizationId: true },
  })
  if (!dept || dept.organizationId !== access.orgId) {
    return NextResponse.json({ error: "Department not found" }, { status: 404 })
  }

  const body = await req.json() as { name?: string; locationId?: string | null }
  const data: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const v = body.name.trim()
    if (!v) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 })
    data.name = v
  }

  if ("locationId" in body) {
    if (body.locationId) {
      const loc = await prisma.location.findUnique({
        where:  { id: body.locationId },
        select: { organizationId: true },
      })
      if (!loc || loc.organizationId !== access.orgId) {
        return NextResponse.json({ error: "Location not found in this organization" }, { status: 400 })
      }
    }
    data.locationId = body.locationId ?? null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 })
  }

  const updated = await prisma.department.update({ where: { id: deptId }, data })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "UPDATE_DEPARTMENT",
    targetModel:   "Department",
    targetId:      deptId,
    after:         data,
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(updated)
}

// ── DELETE /api/super-admin/onboarding/[id]/configure/departments/[deptId] ───
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, deptId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const dept = await prisma.department.findUnique({
    where:  { id: deptId },
    select: { id: true, name: true, organizationId: true },
  })
  if (!dept || dept.organizationId !== access.orgId) {
    return NextResponse.json({ error: "Department not found" }, { status: 404 })
  }

  await prisma.department.delete({ where: { id: deptId } })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "DELETE_DEPARTMENT",
    targetModel:   "Department",
    targetId:      deptId,
    before:        { name: dept.name },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json({ ok: true })
}
