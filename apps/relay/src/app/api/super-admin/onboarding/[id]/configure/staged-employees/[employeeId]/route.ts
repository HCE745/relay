import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"
import { type WizardProgress, type StagedEmployee } from "@/lib/wizard-steps"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string; employeeId: string }> }

function wizardError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/staged-employees/[id]]", e)
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

// ── PATCH /configure/staged-employees/[employeeId] ───────────────────────────
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, employeeId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { wizardProgress: true, primaryContactEmail: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const progress = parseProgress(record.wizardProgress)
  const idx      = progress.stagedEmployees.findIndex(e => e.id === employeeId)
  if (idx === -1) return NextResponse.json({ error: "Staged employee not found" }, { status: 404 })

  const body = await req.json() as Partial<StagedEmployee>
  const existing = progress.stagedEmployees[idx]!

  let email = existing.email
  if (body.email !== undefined) {
    email = body.email.trim().toLowerCase()
    if (!email) return NextResponse.json({ error: "email cannot be empty" }, { status: 400 })
    if (email === record.primaryContactEmail?.toLowerCase()) {
      return NextResponse.json(
        { error: "Cannot assign the primary contact email to a staged employee." },
        { status: 409 },
      )
    }
    // Duplicate check (excluding current record)
    const conflict = progress.stagedEmployees.find((e, i) => i !== idx && e.email.toLowerCase() === email)
    if (conflict) {
      return NextResponse.json({ error: `${email} is already in the staged invitation list.` }, { status: 409 })
    }
  }

  const role = body.role !== undefined ? body.role : existing.role
  if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 })
  }

  // Validate FK refs
  const empTypeId = "employeeTypeId" in body ? (body.employeeTypeId ?? null) : existing.employeeTypeId
  const deptId    = "departmentId"   in body ? (body.departmentId   ?? null) : existing.departmentId
  const locId     = "locationId"     in body ? (body.locationId     ?? null) : existing.locationId

  if (empTypeId) {
    const et = await prisma.employeeType.findUnique({ where: { id: empTypeId }, select: { organizationId: true } })
    if (!et || et.organizationId !== access.orgId) return NextResponse.json({ error: "Employee type not found" }, { status: 404 })
  }
  if (deptId) {
    const dept = await prisma.department.findUnique({ where: { id: deptId }, select: { organizationId: true } })
    if (!dept || dept.organizationId !== access.orgId) return NextResponse.json({ error: "Department not found" }, { status: 404 })
  }
  if (locId) {
    const loc = await prisma.location.findUnique({ where: { id: locId }, select: { organizationId: true } })
    if (!loc || loc.organizationId !== access.orgId) return NextResponse.json({ error: "Location not found" }, { status: 404 })
  }

  const updated_emp: StagedEmployee = {
    ...existing,
    name:           body.name?.trim() ?? existing.name,
    email,
    role,
    employeeTypeId: empTypeId,
    departmentId:   deptId,
    locationId:     locId,
    managerId:      "managerId" in body ? (body.managerId ?? null) : existing.managerId,
  }

  const newEmployees = [...progress.stagedEmployees]
  newEmployees[idx]  = updated_emp

  const updated_progress: WizardProgress = {
    ...progress,
    stagedEmployees: newEmployees,
    lastSavedAt:     new Date().toISOString(),
  }

  await prisma.customerOnboarding.update({
    where: { id },
    data:  { wizardProgress: updated_progress as object },
  })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "UPDATE_STAGED_EMPLOYEE",
    targetModel:   "CustomerOnboarding",
    targetId:      id,
    after:         { stagedId: employeeId, email: updated_emp.email },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json(updated_emp)
}

// ── DELETE /configure/staged-employees/[employeeId] ──────────────────────────
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id, employeeId } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return wizardError(e) }

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { wizardProgress: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const progress = parseProgress(record.wizardProgress)
  const before   = progress.stagedEmployees.find(e => e.id === employeeId)
  if (!before) return NextResponse.json({ error: "Staged employee not found" }, { status: 404 })

  const updated_progress: WizardProgress = {
    ...progress,
    stagedEmployees: progress.stagedEmployees.filter(e => e.id !== employeeId),
    lastSavedAt:     new Date().toISOString(),
  }

  await prisma.customerOnboarding.update({
    where: { id },
    data:  { wizardProgress: updated_progress as object },
  })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "REMOVE_STAGED_EMPLOYEE",
    targetModel:   "CustomerOnboarding",
    targetId:      id,
    before:        { stagedId: employeeId, email: before.email },
    sessionId:     access.onboardingId,
  })

  return NextResponse.json({ ok: true })
}
