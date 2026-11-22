import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"
import { type WizardProgress, type StagedEmployee, defaultProgress } from "@/lib/wizard-steps"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/staged-employees]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

function parseProgress(raw: unknown): WizardProgress {
  const p = (raw ?? {}) as Partial<WizardProgress>
  return {
    currentStepKey:  p.currentStepKey  ?? null,
    completedSteps:  Array.isArray(p.completedSteps) ? p.completedSteps : [],
    skippedSteps:    Array.isArray(p.skippedSteps)   ? p.skippedSteps   : [],
    lastSavedAt:     p.lastSavedAt     ?? null,
    stagedEmployees: Array.isArray(p.stagedEmployees) ? p.stagedEmployees : [],
  }
}

const VALID_ROLES = ["EMPLOYEE", "SUPERVISOR", "MANAGER", "HR", "ADMIN"] as const

// ── GET /api/super-admin/onboarding/[id]/configure/staged-employees ───────────
// Returns the list of staged employees from wizardProgress.
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { wizardProgress: true, primaryContactEmail: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const progress = parseProgress(record.wizardProgress)
  return NextResponse.json({
    stagedEmployees:     progress.stagedEmployees,
    primaryContactEmail: record.primaryContactEmail,
  })
}

// ── POST /api/super-admin/onboarding/[id]/configure/staged-employees ──────────
// Adds a staged employee. Does NOT create an Invitation — stores in wizardProgress JSON.
export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id }  = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { wizardProgress: true, primaryContactEmail: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as {
    name?:           string
    email?:          string
    role?:           string
    employeeTypeId?: string | null
    departmentId?:   string | null
    locationId?:     string | null
    managerId?:      string | null
  }

  if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 })
  if (!body.email?.trim()) return NextResponse.json({ error: "email is required" }, { status: 400 })

  const email = body.email.trim().toLowerCase()
  const role  = body.role ?? "EMPLOYEE"

  if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 })
  }

  // Block conflicts with the primary contact email
  if (email === record.primaryContactEmail?.toLowerCase()) {
    return NextResponse.json(
      { error: "Cannot stage an invitation for the primary contact — they will receive the launch invitation." },
      { status: 409 },
    )
  }

  const progress = parseProgress(record.wizardProgress)

  // Duplicate check: reject if same email already staged
  if (progress.stagedEmployees.some(e => e.email.toLowerCase() === email)) {
    return NextResponse.json(
      { error: `${email} is already in the staged invitation list.` },
      { status: 409 },
    )
  }

  // Validate department and location belong to this org (if provided)
  if (body.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: body.departmentId }, select: { organizationId: true } })
    if (!dept || dept.organizationId !== access.orgId) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }
  }
  if (body.locationId) {
    const loc = await prisma.location.findUnique({ where: { id: body.locationId }, select: { organizationId: true } })
    if (!loc || loc.organizationId !== access.orgId) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 })
    }
  }
  if (body.employeeTypeId) {
    const et = await prisma.employeeType.findUnique({ where: { id: body.employeeTypeId }, select: { organizationId: true } })
    if (!et || et.organizationId !== access.orgId) {
      return NextResponse.json({ error: "Employee type not found" }, { status: 404 })
    }
  }

  const staged: StagedEmployee = {
    id:             randomUUID(),
    name:           body.name.trim(),
    email,
    role,
    employeeTypeId: body.employeeTypeId ?? null,
    departmentId:   body.departmentId   ?? null,
    locationId:     body.locationId     ?? null,
    managerId:      body.managerId      ?? null,
    createdAt:      new Date().toISOString(),
  }

  const updated: WizardProgress = {
    ...progress,
    stagedEmployees: [...progress.stagedEmployees, staged],
    lastSavedAt:     new Date().toISOString(),
  }

  await prisma.customerOnboarding.update({
    where: { id },
    data:  { wizardProgress: updated as object },
  })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "STAGE_EMPLOYEE",
    targetModel:   "CustomerOnboarding",
    targetId:      id,
    after:         { stagedId: staged.id, email: staged.email, role: staged.role },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(staged, { status: 201 })
}
