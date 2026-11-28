import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import type { AuthPolicyConfig } from "@/lib/employee-session"

export const dynamic = "force-dynamic"

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

// ── GET /api/settings/auth-policy ────────────────────────────────────────────
// Returns the organization's current auth policy config.
// Requires ADMIN role.
export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session)               return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { authPolicyConfig: true },
  })

  const policy = (org?.authPolicyConfig ?? null) as AuthPolicyConfig | null
  return NextResponse.json({ policy })
}

// ── PATCH /api/settings/auth-policy ──────────────────────────────────────────
// Merges partial updates into the existing auth policy config.
// Unknown keys are rejected. Requires ADMIN role.
export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session)               return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const parsed = AuthPolicySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid auth policy", details: parsed.error.flatten() }, { status: 400 })
  }

  // Load existing config and merge
  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { authPolicyConfig: true },
  })
  const existing = (org?.authPolicyConfig ?? {}) as Partial<AuthPolicyConfig>
  const merged: AuthPolicyConfig = {
    permittedMethods:          parsed.data.permittedMethods          ?? existing.permittedMethods          ?? ["EMPLOYEE_ID", "ACCESS_CODE", "BADGE"],
    inactivityTimeoutSeconds:  parsed.data.inactivityTimeoutSeconds  !== undefined
      ? parsed.data.inactivityTimeoutSeconds
      : (existing.inactivityTimeoutSeconds  ?? null),
    maxSessionDurationSeconds: parsed.data.maxSessionDurationSeconds !== undefined
      ? parsed.data.maxSessionDurationSeconds
      : (existing.maxSessionDurationSeconds ?? null),
    disableInactivityTimeout:  parsed.data.disableInactivityTimeout  ?? existing.disableInactivityTimeout  ?? false,
    disableMaxSessionDuration: parsed.data.disableMaxSessionDuration ?? existing.disableMaxSessionDuration ?? false,
  }

  await prisma.organization.update({
    where: { id: session.organizationId },
    data:  { authPolicyConfig: merged as unknown as Prisma.InputJsonValue },
  })

  return NextResponse.json({ ok: true, policy: merged })
}
