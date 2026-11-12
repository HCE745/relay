import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// PATCH /api/super-admin/crm/prospects/discover/results/[id]
// Links a research result to a CRM prospect after creation from a saved list.
// Only the list owner may update their own results.
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session?.superAdminId && !session?.salesUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const result = await prisma.prospectResearchResult.findUnique({
    where: { id },
    select: {
      id:     true,
      listId: true,
      list:   { select: { salesUserId: true, superAdminId: true } },
    },
  })

  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { list } = result
  const isOwner =
    (session.superAdminId && list.superAdminId === session.superAdminId) ||
    (session.salesUserId  && list.salesUserId  === session.salesUserId)
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json() as { prospectId?: string }
  if (typeof body.prospectId !== "string" || !body.prospectId.trim()) {
    return NextResponse.json({ error: "prospectId required" }, { status: 400 })
  }

  const updated = await prisma.prospectResearchResult.update({
    where: { id },
    data:  { prospectId: body.prospectId.trim() },
    select: { id: true, prospectId: true },
  })

  return NextResponse.json(updated)
}
