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
  console.error("[wizard/escalations]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── GET /api/super-admin/onboarding/[id]/configure/escalations ────────────────
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { organizationId: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const chains = await prisma.escalationChain.findMany({
    where:   { organizationId: record.organizationId },
    orderBy: { createdAt: "asc" },
    include: {
      steps: { orderBy: { stepOrder: "asc" } },
    },
  })

  return NextResponse.json(chains)
}

// ── POST /api/super-admin/onboarding/[id]/configure/escalations ───────────────
// Creates an EscalationChain with optional initial steps.
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const body = await req.json() as {
    name?:                string
    description?:         string
    triggerPriority?:     string
    triggerCategory?:     string
    triggerLocationId?:   string
    triggerDepartmentId?: string
    hoursToFirst?:        number
    steps?:               Array<{
      stepOrder:          number
      label?:             string
      role?:              string
      userId?:            string
      notifyVia?:         string
      hoursAfterPrevious?: number
    }>
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  if (body.triggerLocationId) {
    const loc = await prisma.location.findUnique({
      where:  { id: body.triggerLocationId },
      select: { organizationId: true },
    })
    if (!loc || loc.organizationId !== access.orgId) {
      return NextResponse.json({ error: "Location not found in this organization" }, { status: 400 })
    }
  }

  if (body.triggerDepartmentId) {
    const dept = await prisma.department.findUnique({
      where:  { id: body.triggerDepartmentId },
      select: { organizationId: true },
    })
    if (!dept || dept.organizationId !== access.orgId) {
      return NextResponse.json({ error: "Department not found in this organization" }, { status: 400 })
    }
  }

  const chain = await prisma.escalationChain.create({
    data: {
      organizationId:       access.orgId,
      name:                 body.name.trim(),
      description:          body.description?.trim()   ?? undefined,
      triggerPriority:      body.triggerPriority       ?? undefined,
      triggerCategory:      body.triggerCategory       ?? undefined,
      triggerLocationId:    body.triggerLocationId     ?? undefined,
      triggerDepartmentId:  body.triggerDepartmentId   ?? undefined,
      hoursToFirst:         body.hoursToFirst          ?? 24,
      isActive:             true,
      steps: body.steps?.length
        ? {
            create: body.steps.map(s => ({
              stepOrder:          s.stepOrder,
              label:              s.label              ?? undefined,
              role:               s.role               ?? undefined,
              userId:             s.userId             ?? undefined,
              notifyVia:          s.notifyVia          ?? "EMAIL",
              hoursAfterPrevious: s.hoursAfterPrevious ?? 24,
            })),
          }
        : undefined,
    },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "CREATE_ESCALATION_CHAIN",
    targetModel:   "EscalationChain",
    targetId:      chain.id,
    after:         { name: chain.name, triggerPriority: chain.triggerPriority, stepsCount: chain.steps.length },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(chain, { status: 201 })
}
