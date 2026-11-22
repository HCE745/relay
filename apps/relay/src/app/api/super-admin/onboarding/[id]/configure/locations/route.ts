import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"
import { generateSlug } from "@/lib/slug"
// slug is optional on Location (unique per-org feedback URL); generate one at creation

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/locations]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── GET /api/super-admin/onboarding/[id]/configure/locations ─────────────────
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { organizationId: true, status: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const locations = await prisma.location.findMany({
    where:   { organizationId: record.organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { qrCodes: true } }, parent: { select: { id: true, name: true } } },
  })

  return NextResponse.json(locations)
}

// ── POST /api/super-admin/onboarding/[id]/configure/locations ────────────────
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const body = await req.json() as {
    name?:          string
    locationType?:  string
    address?:       string
    city?:          string
    state?:         string
    country?:       string
    parentId?:      string
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  // Validate parent belongs to same org if supplied
  if (body.parentId) {
    const parent = await prisma.location.findUnique({
      where:  { id: body.parentId },
      select: { organizationId: true },
    })
    if (!parent || parent.organizationId !== access.orgId) {
      return NextResponse.json({ error: "Parent location not found in this organization" }, { status: 400 })
    }
  }

  const slug = generateSlug(body.name.trim())

  const location = await prisma.location.create({
    data: {
      organizationId: access.orgId,
      name:           body.name.trim(),
      locationType:   body.locationType   ?? undefined,
      address:        body.address?.trim() ?? undefined,
      city:           body.city?.trim()    ?? undefined,
      state:          body.state?.trim()   ?? undefined,
      country:        body.country?.trim() ?? undefined,
      parentId:       body.parentId        ?? undefined,
      slug,
    },
  })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "CREATE_LOCATION",
    targetModel:   "Location",
    targetId:      location.id,
    after:         { name: location.name, locationType: location.locationType },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(location, { status: 201 })
}
