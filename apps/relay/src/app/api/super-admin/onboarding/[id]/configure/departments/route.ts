import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/departments]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── GET /api/super-admin/onboarding/[id]/configure/departments ───────────────
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { organizationId: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const departments = await prisma.department.findMany({
    where:   { organizationId: record.organizationId },
    orderBy: { name: "asc" },
    include: { location: { select: { id: true, name: true } } },
  })

  return NextResponse.json(departments)
}

// ── POST /api/super-admin/onboarding/[id]/configure/departments ──────────────
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const body = await req.json() as { name?: string; locationId?: string }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
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

  const dept = await prisma.department.create({
    data: {
      organizationId: access.orgId,
      name:           body.name.trim(),
      locationId:     body.locationId ?? undefined,
    },
  })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "CREATE_DEPARTMENT",
    targetModel:   "Department",
    targetId:      dept.id,
    after:         { name: dept.name, locationId: dept.locationId },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(dept, { status: 201 })
}
