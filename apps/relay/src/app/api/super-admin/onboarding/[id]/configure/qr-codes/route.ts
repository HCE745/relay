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
  console.error("[wizard/qr-codes]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── GET /api/super-admin/onboarding/[id]/configure/qr-codes ──────────────────
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { organizationId: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const codes = await prisma.qrCode.findMany({
    where:   { organizationId: record.organizationId },
    orderBy: { createdAt: "asc" },
    include: {
      location:   { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(codes)
}

// ── POST /api/super-admin/onboarding/[id]/configure/qr-codes ─────────────────
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const body = await req.json() as {
    name?:            string
    description?:     string
    locationId?:      string
    departmentId?:    string
    defaultCategory?: string
    reportingMode?:   string
  }

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

  if (body.departmentId) {
    const dept = await prisma.department.findUnique({
      where:  { id: body.departmentId },
      select: { organizationId: true },
    })
    if (!dept || dept.organizationId !== access.orgId) {
      return NextResponse.json({ error: "Department not found in this organization" }, { status: 400 })
    }
  }

  const code = await prisma.qrCode.create({
    data: {
      organizationId:  access.orgId,
      name:            body.name.trim(),
      description:     body.description?.trim() ?? undefined,
      locationId:      body.locationId          ?? undefined,
      departmentId:    body.departmentId        ?? undefined,
      defaultCategory: body.defaultCategory     ?? "GENERAL",
      reportingMode:   body.reportingMode       ?? "PUBLIC_ISSUE",
      // createdById is a plain denormalized string (no FK); SA ID used as creator
      createdById:     session!.superAdminId!,
      isActive:        true,
      allowedCategories: [],
      enabledActions:    [],
    },
  })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "CREATE_QR_CODE",
    targetModel:   "QrCode",
    targetId:      code.id,
    after:         { name: code.name, locationId: code.locationId, departmentId: code.departmentId },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(code, { status: 201 })
}
