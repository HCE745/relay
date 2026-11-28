import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string; badgeId: string }> }

// DELETE /api/team/[id]/badges/[badgeId]
// Revokes (soft-deletes) a badge credential.
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "HR"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, badgeId } = await params

  const badge = await prisma.employeeBadge.findFirst({
    where: { id: badgeId, userId: id, organizationId: session.organizationId },
  })
  if (!badge) return NextResponse.json({ error: "Badge not found" }, { status: 404 })

  await prisma.employeeBadge.update({
    where: { id: badgeId },
    data:  { isActive: false, revokedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
