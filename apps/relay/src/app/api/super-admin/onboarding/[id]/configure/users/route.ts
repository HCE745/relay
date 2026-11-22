import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// ── GET /api/super-admin/onboarding/[id]/configure/users ─────────────────────
//
// Read-only view of existing org users and pending invitations.
// Used by the wizard Step 5 (Employee Invitation List) to show the SA what
// staff is already present in the customer's environment.
//
// No writes here — existing org users are managed separately and new employee
// invitations are prepared by the customer admin after they accept their own
// invitation (Phase D/E). This endpoint never creates or emails invitations.
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const record = await prisma.customerOnboarding.findUnique({
    where:  { id },
    select: { organizationId: true, primaryContactEmail: true },
  })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const orgId = record.organizationId

  const [users, invitations] = await Promise.all([
    prisma.user.findMany({
      where:   { organizationId: orgId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, email: true, role: true,
        department: { select: { id: true, name: true } },
        location:   { select: { id: true, name: true } },
        createdAt:  true, lastLoginAt: true,
      },
    }),
    prisma.invitation.findMany({
      where:   { organizationId: orgId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, email: true, role: true, expiresAt: true, createdAt: true,
        department: { select: { id: true, name: true } },
        location:   { select: { id: true, name: true } },
      },
    }),
  ])

  return NextResponse.json({
    users,
    invitations,
    primaryContactEmail: record.primaryContactEmail,
  })
}
