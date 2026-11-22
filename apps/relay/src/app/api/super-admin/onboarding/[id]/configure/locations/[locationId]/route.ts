import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string; locationId: string }> }

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/locations/[id]]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

async function resolveLocation(locationId: string, orgId: string) {
  const loc = await prisma.location.findUnique({
    where:  { id: locationId },
    select: { id: true, name: true, locationType: true, organizationId: true, isActive: true },
  })
  if (!loc || loc.organizationId !== orgId) return null
  return loc
}

// ── PATCH /api/super-admin/onboarding/[id]/configure/locations/[locationId] ──
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, locationId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const loc = await resolveLocation(locationId, access.orgId)
  if (!loc) return NextResponse.json({ error: "Location not found" }, { status: 404 })

  const body = await req.json() as {
    name?:         string
    locationType?: string | null
    address?:      string | null
    city?:         string | null
    state?:        string | null
    country?:      string | null
    isActive?:     boolean
    parentId?:     string | null
  }

  const data: Record<string, unknown> = {}
  const before: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const v = body.name.trim()
    if (!v) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 })
    before.name = loc.name; data.name = v
  }
  if ("locationType" in body) { before.locationType = loc.locationType; data.locationType = body.locationType ?? null }
  if ("isActive"     in body) { data.isActive = body.isActive }
  if ("address"      in body) { data.address  = body.address  ?? null }
  if ("city"         in body) { data.city     = body.city     ?? null }
  if ("state"        in body) { data.state    = body.state    ?? null }
  if ("country"      in body) { data.country  = body.country  ?? null }

  if ("parentId" in body) {
    if (body.parentId) {
      const parent = await prisma.location.findUnique({
        where:  { id: body.parentId },
        select: { organizationId: true },
      })
      if (!parent || parent.organizationId !== access.orgId) {
        return NextResponse.json({ error: "Parent location not found in this organization" }, { status: 400 })
      }
      if (body.parentId === locationId) {
        return NextResponse.json({ error: "A location cannot be its own parent" }, { status: 400 })
      }
    }
    data.parentId = body.parentId ?? null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 })
  }

  const updated = await prisma.location.update({ where: { id: locationId }, data })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "UPDATE_LOCATION",
    targetModel:   "Location",
    targetId:      locationId,
    before,
    after:         data,
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(updated)
}

// ── DELETE /api/super-admin/onboarding/[id]/configure/locations/[locationId] ─
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, locationId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const loc = await resolveLocation(locationId, access.orgId)
  if (!loc) return NextResponse.json({ error: "Location not found" }, { status: 404 })

  await prisma.location.delete({ where: { id: locationId } })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "DELETE_LOCATION",
    targetModel:   "Location",
    targetId:      locationId,
    before:        { name: loc.name },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json({ ok: true })
}
