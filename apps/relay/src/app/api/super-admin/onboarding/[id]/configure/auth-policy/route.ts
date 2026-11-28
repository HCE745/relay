import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireWizardAccess, logWizardAction, WizardAccessError } from "@/lib/onboarding-wizard"
import { DEFAULT_AUTH_POLICY, type AuthPolicyConfig } from "@/lib/employee-session"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

const VALID_METHODS = ["EMPLOYEE_ID", "ACCESS_CODE", "BADGE"] as const

const AuthPolicySchema = z.object({
  permittedMethods: z
    .array(z.enum(VALID_METHODS))
    .optional(),
  inactivityTimeoutSeconds: z
    .number().int().positive().nullable()
    .optional(),
  maxSessionDurationSeconds: z
    .number().int().positive().nullable()
    .optional(),
  disableInactivityTimeout: z
    .boolean()
    .optional(),
  disableMaxSessionDuration: z
    .boolean()
    .optional(),
})

function routeError(e: unknown) {
  if (e instanceof WizardAccessError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[wizard/auth-policy]", e)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── GET /api/super-admin/onboarding/[id]/configure/auth-policy ────────────────
// Returns the customer organization's current authPolicyConfig.
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return routeError(e) }

  const org = await prisma.organization.findUnique({
    where:  { id: access.orgId },
    select: { authPolicyConfig: true },
  })
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  const policy = (org.authPolicyConfig ?? null) as AuthPolicyConfig | null
  return NextResponse.json({ policy: policy ?? DEFAULT_AUTH_POLICY })
}

// ── PATCH /api/super-admin/onboarding/[id]/configure/auth-policy ──────────────
// Merges partial updates into the customer organization's authPolicyConfig.
// Uses the same AuthPolicySchema as /api/settings/auth-policy so validation is consistent.
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  const { id } = await params

  let access: { orgId: string; onboardingId: string }
  try { access = await requireWizardAccess(id, session) }
  catch (e) { return routeError(e) }

  const body = await req.json()
  const parsed = AuthPolicySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid auth policy", details: parsed.error.flatten() }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({
    where:  { id: access.orgId },
    select: { authPolicyConfig: true },
  })
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

  const existing = (org.authPolicyConfig ?? {}) as Partial<AuthPolicyConfig>
  const before   = { ...existing }

  const merged: AuthPolicyConfig = {
    permittedMethods:          parsed.data.permittedMethods          ?? existing.permittedMethods          ?? DEFAULT_AUTH_POLICY.permittedMethods,
    inactivityTimeoutSeconds:  parsed.data.inactivityTimeoutSeconds  !== undefined
      ? parsed.data.inactivityTimeoutSeconds
      : (existing.inactivityTimeoutSeconds  ?? DEFAULT_AUTH_POLICY.inactivityTimeoutSeconds),
    maxSessionDurationSeconds: parsed.data.maxSessionDurationSeconds !== undefined
      ? parsed.data.maxSessionDurationSeconds
      : (existing.maxSessionDurationSeconds ?? DEFAULT_AUTH_POLICY.maxSessionDurationSeconds),
    disableInactivityTimeout:  parsed.data.disableInactivityTimeout  ?? existing.disableInactivityTimeout  ?? DEFAULT_AUTH_POLICY.disableInactivityTimeout,
    disableMaxSessionDuration: parsed.data.disableMaxSessionDuration ?? existing.disableMaxSessionDuration ?? DEFAULT_AUTH_POLICY.disableMaxSessionDuration,
  }

  await prisma.organization.update({
    where: { id: access.orgId },
    data:  { authPolicyConfig: merged as unknown as Prisma.InputJsonValue },
  })

  await logWizardAction({
    orgId:         access.orgId,
    actorId:       session!.superAdminId!,
    operationType: "UPDATE_AUTH_POLICY",
    targetModel:   "Organization",
    targetId:      access.orgId,
    before,
    after:         merged,
    sessionId:     access.onboardingId,
  })

  return NextResponse.json({ ok: true, policy: merged })
}
