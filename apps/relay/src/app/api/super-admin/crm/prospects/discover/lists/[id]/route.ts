import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function canAccess(
  list: { salesUserId: string | null; superAdminId: string | null; isShared: boolean },
  session: { salesUserId?: string; superAdminId?: string },
): boolean {
  if (list.isShared) return true
  if (session.superAdminId && list.superAdminId === session.superAdminId) return true
  if (session.salesUserId  && list.salesUserId  === session.salesUserId)  return true
  return false
}

function isOwner(
  list: { salesUserId: string | null; superAdminId: string | null },
  session: { salesUserId?: string; superAdminId?: string },
): boolean {
  if (session.superAdminId && list.superAdminId === session.superAdminId) return true
  if (session.salesUserId  && list.salesUserId  === session.salesUserId)  return true
  return false
}

type RouteCtx = { params: Promise<{ id: string }> }

// ── GET /api/super-admin/crm/prospects/discover/lists/[id] ───────────────────
// Returns a list with all its results (accessible to owner or if shared).
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdminId && !session?.salesUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const list = await prisma.prospectResearchList.findUnique({
    where: { id },
    include: { results: { orderBy: [{ fitScore: "desc" }, { companyName: "asc" }] } },
  })

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canAccess(list, session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(list)
}

// ── DELETE /api/super-admin/crm/prospects/discover/lists/[id] ────────────────
// Deletes a list (and cascades to its results). Owner only.
// Results with prospectId set are preserved via ON DELETE SET NULL on that FK.
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdminId && !session?.salesUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const list = await prisma.prospectResearchList.findUnique({
    where: { id },
    select: { salesUserId: true, superAdminId: true, isShared: true },
  })

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!isOwner(list, session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.prospectResearchList.delete({ where: { id } })

  return NextResponse.json({ deleted: true })
}
