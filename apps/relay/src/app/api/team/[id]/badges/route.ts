import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { normalizeCredential, computeCredentialIndex, maskCredential } from "@/lib/credential-hmac"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// ── GET /api/team/[id]/badges ─────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "HR"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const user = await prisma.user.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const badges = await prisma.employeeBadge.findMany({
    where:   { userId: id, organizationId: session.organizationId },
    select:  { id: true, badgeType: true, maskedDisplay: true, isActive: true, createdAt: true, revokedAt: true },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json({ badges })
}

// ── POST /api/team/[id]/badges ────────────────────────────────────────────────
// Adds a third-party badge credential for an employee.
//
// Body: { badgeType: "THIRD_PARTY", credentialValue: string }
// For Relay-generated badges, use POST /api/team/[id]/credentials/generate.
export async function POST(request: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "HR"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const user = await prisma.user.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, role: true },
  })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await request.json() as { badgeType?: string; credentialValue?: string }

  if (body.badgeType !== "THIRD_PARTY") {
    return NextResponse.json({ error: "badgeType must be THIRD_PARTY (use /generate for Relay badges)" }, { status: 400 })
  }
  if (!body.credentialValue?.trim()) {
    return NextResponse.json({ error: "credentialValue is required" }, { status: 400 })
  }

  const normalized = normalizeCredential(body.credentialValue)
  const credIndex  = computeCredentialIndex(normalized)
  const orgId      = session.organizationId

  // Check for collision within this org
  const existing = await prisma.employeeBadge.findFirst({
    where: { organizationId: orgId, credentialIndex: credIndex, isActive: true },
  })
  if (existing) {
    return NextResponse.json({ error: "This badge credential is already registered in your organization" }, { status: 409 })
  }

  const badge = await prisma.employeeBadge.create({
    data: {
      userId:          id,
      organizationId:  orgId,
      badgeType:       "THIRD_PARTY",
      credentialIndex: credIndex,
      credentialHash:  null,  // third-party: HMAC match is sufficient
      maskedDisplay:   maskCredential(body.credentialValue.trim()),
    },
    select: { id: true, badgeType: true, maskedDisplay: true, isActive: true, createdAt: true },
  })

  return NextResponse.json({ ok: true, badge }, { status: 201 })
}
