import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"
import type { Prisma } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

const VALID_BASE_ROLES = ["EMPLOYEE", "SUPERVISOR", "MANAGER", "HR", "ADMIN"] as const
type BaseRole = typeof VALID_BASE_ROLES[number]

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/employee-types]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── GET /api/super-admin/onboarding/[id]/configure/employee-types ────────────
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { organizationId: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const types = await prisma.employeeType.findMany({
    where:   { organizationId: record.organizationId },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(types)
}

// ── POST /api/super-admin/onboarding/[id]/configure/employee-types ───────────
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const body = await req.json() as {
    name?:          string
    description?:   string
    baseRole?:      string
    pageAccess?:    unknown
    actions?:       unknown
    canInvite?:     boolean
    canChangeEmail?: boolean
    isPreset?:      boolean
    presetKey?:     string
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (!body.baseRole || !VALID_BASE_ROLES.includes(body.baseRole as BaseRole)) {
    return NextResponse.json(
      { error: `baseRole must be one of: ${VALID_BASE_ROLES.join(", ")}` },
      { status: 400 },
    )
  }

  const empType = await prisma.employeeType.create({
    data: {
      organizationId: access.orgId,
      name:           body.name.trim(),
      description:    body.description?.trim()  ?? undefined,
      baseRole:       body.baseRole,
      pageAccess:     (body.pageAccess as Prisma.InputJsonValue) ?? [],
      actions:        (body.actions    as Prisma.InputJsonValue) ?? [],
      canInvite:      body.canInvite      ?? false,
      canChangeEmail: body.canChangeEmail ?? true,
      isPreset:       body.isPreset       ?? false,
      presetKey:      body.presetKey      ?? undefined,
    },
  })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "CREATE_EMPLOYEE_TYPE",
    targetModel:   "EmployeeType",
    targetId:      empType.id,
    after:         { name: empType.name, baseRole: empType.baseRole },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(empType, { status: 201 })
}
