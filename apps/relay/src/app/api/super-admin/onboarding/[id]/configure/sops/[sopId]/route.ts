import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string; sopId: string }> }

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/sops/[sopId]]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── PATCH /api/super-admin/onboarding/[id]/configure/sops/[sopId] ─────────────
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, sopId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const existing = await prisma.sOP.findUnique({
    where:  { id: sopId },
    select: { organizationId: true, title: true },
  })
  if (!existing || existing.organizationId !== access.orgId) {
    return NextResponse.json({ error: "SOP not found" }, { status: 404 })
  }

  const body = await req.json() as {
    title?:        string
    description?:  string | null
    category?:     string | null
    content?:      string
    version?:      string
    departmentId?: string | null
    isActive?:     boolean
  }

  if (body.departmentId) {
    const dept = await prisma.department.findUnique({
      where:  { id: body.departmentId },
      select: { organizationId: true },
    })
    if (!dept || dept.organizationId !== access.orgId) {
      return NextResponse.json({ error: "Department not found in this organization" }, { status: 400 })
    }
  }

  const data: Record<string, unknown> = {}
  if (body.title       !== undefined) data.title       = body.title?.trim()       || existing.title
  if (body.description !== undefined) data.description = body.description?.trim() ?? null
  if ("category"     in body)         data.category    = body.category            ?? null
  if (body.content   !== undefined)   data.content     = body.content?.trim()     || undefined
  if (body.version   !== undefined)   data.version     = body.version             ?? "1.0"
  if ("departmentId" in body)         data.departmentId = body.departmentId       ?? null
  if (body.isActive  !== undefined)   data.isActive    = body.isActive

  const updated = await prisma.sOP.update({ where: { id: sopId }, data })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "UPDATE_SOP",
    targetModel:   "SOP",
    targetId:      sopId,
    after:         data,
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(updated)
}

// ── DELETE /api/super-admin/onboarding/[id]/configure/sops/[sopId] ───────────
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, sopId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const existing = await prisma.sOP.findUnique({
    where:  { id: sopId },
    select: { organizationId: true, title: true },
  })
  if (!existing || existing.organizationId !== access.orgId) {
    return NextResponse.json({ error: "SOP not found" }, { status: 404 })
  }

  await prisma.sOP.delete({ where: { id: sopId } })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "DELETE_SOP",
    targetModel:   "SOP",
    targetId:      sopId,
    before:        { title: existing.title },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json({ ok: true })
}
