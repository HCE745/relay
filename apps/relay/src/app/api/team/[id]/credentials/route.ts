import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { normalizeCredential, computeCredentialIndex, maskCredential } from "@/lib/credential-hmac"
import { clearUserSingleCodeLookups, reserveSingleCodeLookup } from "@/lib/single-code-lookup"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

function canManage(sessionRole: string, targetRole: string): boolean {
  if (sessionRole === "ADMIN") return true
  if (sessionRole === "HR")    return targetRole !== "ADMIN"
  return false
}

// ── GET /api/team/[id]/credentials ────────────────────────────────────────────
// Returns the credential configuration for an employee.
// Requires ADMIN or HR role with manage rights over the target user.
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const user = await prisma.user.findFirst({
    where:  { id, organizationId: session.organizationId },
    select: {
      id: true, role: true, employeeId: true,
      employeeCredential: {
        select: {
          employeeIdEnabled:  true,
          accessCodeEnabled:  true,
          accessCodeMasked:   true,
        },
      },
      employeeBadges: {
        where:  { isActive: true },
        select: { id: true, badgeType: true, maskedDisplay: true, isActive: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canManage(session.role, user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json({
    employeeId:  user.employeeId ?? null,
    credential:  user.employeeCredential
      ? {
          employeeIdEnabled: user.employeeCredential.employeeIdEnabled,
          accessCodeEnabled: user.employeeCredential.accessCodeEnabled,
          accessCodeMasked:  user.employeeCredential.accessCodeMasked,
        }
      : { employeeIdEnabled: false, accessCodeEnabled: false, accessCodeMasked: null },
    badges: user.employeeBadges,
  })
}

// ── PATCH /api/team/[id]/credentials ─────────────────────────────────────────
// Updates employee ID and/or access code credentials.
// Atomically enforces cross-method uniqueness via SingleCodeLookup.
//
// Body (all optional):
//   employeeId:         string | null  — sets User.employeeId
//   employeeIdEnabled:  boolean        — enables Employee ID auth
//   accessCode:         string | null  — sets a specific access code (or null to clear)
//   accessCodeEnabled:  boolean        — enables access code auth
export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const user = await prisma.user.findFirst({
    where:  { id, organizationId: session.organizationId },
    select: {
      id: true, role: true, employeeId: true,
      employeeCredential: {
        select: {
          id: true,
          employeeIdEnabled: true,
          employeeIdIndex:   true,
          accessCodeEnabled: true,
          accessCodeIndex:   true,
        },
      },
    },
  })

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canManage(session.role, user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json() as {
    employeeId?:        string | null
    employeeIdEnabled?: boolean
    accessCode?:        string | null
    accessCodeEnabled?: boolean
  }

  const orgId = session.organizationId

  try {
    await prisma.$transaction(async (tx) => {
      const existing  = user.employeeCredential
      const updateCred: Record<string, unknown> = {}

      let newEmployeeIdIndex:  string | null = existing?.employeeIdIndex   ?? null
      let newAccessCodeIndex:  string | null = existing?.accessCodeIndex   ?? null

      // ── Employee ID change ──────────────────────────────────────────────────
      if ("employeeId" in body) {
        if (body.employeeId) {
          const normalized = normalizeCredential(body.employeeId)
          const newIdx     = computeCredentialIndex(normalized)

          if (newIdx !== existing?.employeeIdIndex) {
            // Release old entry first
            await clearUserSingleCodeLookups(tx, orgId, existing?.employeeIdIndex ?? null, null)
            // Reserve new entry — throws P2002 on collision
            await reserveSingleCodeLookup(tx, orgId, body.employeeId)
            updateCred.employeeIdIndex = newIdx
            newEmployeeIdIndex = newIdx
          }

          await tx.user.update({ where: { id }, data: { employeeId: body.employeeId } })
        } else {
          // Clearing employee ID
          if (existing?.employeeIdIndex) {
            await clearUserSingleCodeLookups(tx, orgId, existing.employeeIdIndex, null)
          }
          updateCred.employeeIdIndex = null
          newEmployeeIdIndex = null
          await tx.user.update({ where: { id }, data: { employeeId: null } })
        }
      }

      if (body.employeeIdEnabled !== undefined) {
        updateCred.employeeIdEnabled = body.employeeIdEnabled
      }

      // ── Access code change ──────────────────────────────────────────────────
      if ("accessCode" in body) {
        if (body.accessCode) {
          const normalized = normalizeCredential(body.accessCode)
          const newIdx     = computeCredentialIndex(normalized)

          if (newIdx !== existing?.accessCodeIndex) {
            await clearUserSingleCodeLookups(tx, orgId, null, existing?.accessCodeIndex ?? null)
            await reserveSingleCodeLookup(tx, orgId, body.accessCode)
            updateCred.accessCodeIndex  = newIdx
            newAccessCodeIndex = newIdx
          }

          updateCred.accessCodeHash   = await hash(body.accessCode, 12)
          updateCred.accessCodeMasked = maskCredential(body.accessCode)
        } else {
          // Clearing access code
          if (existing?.accessCodeIndex) {
            await clearUserSingleCodeLookups(tx, orgId, null, existing.accessCodeIndex)
          }
          updateCred.accessCodeIndex  = null
          updateCred.accessCodeHash   = null
          updateCred.accessCodeMasked = null
          newAccessCodeIndex = null
        }
      }

      if (body.accessCodeEnabled !== undefined) {
        updateCred.accessCodeEnabled = body.accessCodeEnabled
      }

      // ── Upsert EmployeeCredential ───────────────────────────────────────────
      if (Object.keys(updateCred).length > 0) {
        await tx.employeeCredential.upsert({
          where:  { userId: id },
          create: { userId: id, organizationId: orgId, ...updateCred },
          update: updateCred,
        })
      }

      void newEmployeeIdIndex; void newAccessCodeIndex  // used in side effects above
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint failed")) {
      return NextResponse.json(
        { error: "This credential value is already in use by another employee in your organization" },
        { status: 409 },
      )
    }
    throw err
  }

  return NextResponse.json({ ok: true })
}
