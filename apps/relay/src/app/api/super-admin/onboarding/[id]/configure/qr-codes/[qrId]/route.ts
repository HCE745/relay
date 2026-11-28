import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string; qrId: string }> }

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/qr-codes/[qrId]]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── PATCH /api/super-admin/onboarding/[id]/configure/qr-codes/[qrId] ─────────
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, qrId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const existing = await prisma.qrCode.findUnique({
    where:  { id: qrId },
    select: { organizationId: true, name: true },
  })
  if (!existing || existing.organizationId !== access.orgId) {
    return NextResponse.json({ error: "QR code not found" }, { status: 404 })
  }

  const body = await req.json() as {
    name?:            string
    description?:     string
    locationId?:      string | null
    departmentId?:    string | null
    defaultCategory?: string
    reportingMode?:   string
    isActive?:        boolean
  }

  if (body.locationId) {
    const loc = await prisma.location.findUnique({
      where:  { id: body.locationId },
      select: { organizationId: true },
    })
    if (!loc || loc.organizationId !== access.orgId) {
      return NextResponse.json({ error: "Location not found in this organization" }, { status: 400 })
    }
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
  if (body.name            !== undefined) data.name            = body.name?.trim() || existing.name
  if (body.description     !== undefined) data.description     = body.description?.trim() ?? null
  if ("locationId"   in body)             data.locationId      = body.locationId   ?? null
  if ("departmentId" in body)             data.departmentId    = body.departmentId ?? null
  if (body.defaultCategory !== undefined) data.defaultCategory = body.defaultCategory
  if (body.reportingMode   !== undefined) data.reportingMode   = body.reportingMode
  if (body.isActive        !== undefined) data.isActive        = body.isActive

  const updated = await prisma.qrCode.update({ where: { id: qrId }, data })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "UPDATE_QR_CODE",
    targetModel:   "QrCode",
    targetId:      qrId,
    after:         data,
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(updated)
}

// ── DELETE /api/super-admin/onboarding/[id]/configure/qr-codes/[qrId] ────────
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, qrId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const existing = await prisma.qrCode.findUnique({
    where:  { id: qrId },
    select: { organizationId: true, name: true },
  })
  if (!existing || existing.organizationId !== access.orgId) {
    return NextResponse.json({ error: "QR code not found" }, { status: 404 })
  }

  await prisma.qrCode.delete({ where: { id: qrId } })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "DELETE_QR_CODE",
    targetModel:   "QrCode",
    targetId:      qrId,
    before:        { name: existing.name },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json({ ok: true })
}
