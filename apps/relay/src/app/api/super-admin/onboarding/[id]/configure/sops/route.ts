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
  console.error("[wizard/sops]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── GET /api/super-admin/onboarding/[id]/configure/sops ──────────────────────
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { organizationId: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const sops = await prisma.sOP.findMany({
    where:   { organizationId: record.organizationId, isActive: true },
    orderBy: { title: "asc" },
    select:  { id: true, title: true, description: true, category: true, version: true, isActive: true, createdAt: true },
  })

  return NextResponse.json(sops)
}

// ── POST /api/super-admin/onboarding/[id]/configure/sops ─────────────────────
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const body = await req.json() as {
    title?:        string
    description?:  string
    category?:     string
    content?:      string
    version?:      string
    departmentId?: string
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 })
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

  const sop = await prisma.sOP.create({
    data: {
      organizationId: access.orgId,
      title:          body.title.trim(),
      description:    body.description?.trim()  ?? undefined,
      category:       body.category             ?? undefined,
      content:        body.content.trim(),
      version:        body.version              ?? "1.0",
      departmentId:   body.departmentId         ?? undefined,
      isActive:       true,
    },
  })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "CREATE_SOP",
    targetModel:   "SOP",
    targetId:      sop.id,
    after:         { title: sop.title, category: sop.category },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(sop, { status: 201 })
}
