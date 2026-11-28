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
  console.error("[wizard/routing-rules]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── GET /api/super-admin/onboarding/[id]/configure/routing-rules ──────────────
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { organizationId: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const rules = await prisma.routingRule.findMany({
    where:   { organizationId: record.organizationId },
    orderBy: { createdAt: "asc" },
    include: {
      condLocation: { select: { id: true, name: true } },
      condDept:     { select: { id: true, name: true } },
      assignToUser: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(rules)
}

// ── POST /api/super-admin/onboarding/[id]/configure/routing-rules ─────────────
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const body = await req.json() as {
    name?:          string
    description?:   string
    condCategory?:  string
    condLocationId?: string
    condDeptId?:    string
    condPriority?:  string
    assignToRole?:  string
    assignToUserId?: string
    isActive?:      boolean
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (!body.assignToRole && !body.assignToUserId) {
    return NextResponse.json({ error: "assignToRole or assignToUserId is required" }, { status: 400 })
  }

  if (body.condLocationId) {
    const loc = await prisma.location.findUnique({
      where:  { id: body.condLocationId },
      select: { organizationId: true },
    })
    if (!loc || loc.organizationId !== access.orgId) {
      return NextResponse.json({ error: "Location not found in this organization" }, { status: 400 })
    }
  }

  if (body.condDeptId) {
    const dept = await prisma.department.findUnique({
      where:  { id: body.condDeptId },
      select: { organizationId: true },
    })
    if (!dept || dept.organizationId !== access.orgId) {
      return NextResponse.json({ error: "Department not found in this organization" }, { status: 400 })
    }
  }

  if (body.assignToUserId) {
    const user = await prisma.user.findUnique({
      where:  { id: body.assignToUserId },
      select: { organizationId: true },
    })
    if (!user || user.organizationId !== access.orgId) {
      return NextResponse.json({ error: "User not found in this organization" }, { status: 400 })
    }
  }

  const rule = await prisma.routingRule.create({
    data: {
      organizationId:  access.orgId,
      name:            body.name.trim(),
      description:     body.description?.trim() ?? undefined,
      condCategory:    body.condCategory         ?? undefined,
      condLocationId:  body.condLocationId       ?? undefined,
      condDeptId:      body.condDeptId           ?? undefined,
      condPriority:    body.condPriority         ?? undefined,
      assignToRole:    body.assignToRole         ?? undefined,
      assignToUserId:  body.assignToUserId       ?? undefined,
      isActive:        body.isActive             ?? true,
    },
  })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "CREATE_ROUTING_RULE",
    targetModel:   "RoutingRule",
    targetId:      rule.id,
    after:         { name: rule.name, condCategory: rule.condCategory, assignToRole: rule.assignToRole },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(rule, { status: 201 })
}
