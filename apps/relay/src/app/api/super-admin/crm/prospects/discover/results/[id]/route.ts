import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// PATCH /api/super-admin/crm/prospects/discover/results/[id]
// Accepts:
//   { prospectId: string }             — link result to a CRM prospect
//   { isDone: boolean }                — manually mark company done/not-done
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

  const body = await req.json() as { prospectId?: string; isDone?: boolean }

  // ── Link to CRM prospect ─────────────────────────────────────────────────────
  if (typeof body.prospectId === "string") {
    if (!body.prospectId.trim()) {
      return NextResponse.json({ error: "prospectId cannot be empty" }, { status: 400 })
    }
    const updated = await prisma.prospectResearchResult.update({
      where: { id },
      data:  { prospectId: body.prospectId.trim() },
      select: { id: true, prospectId: true, isDone: true },
    })
    return NextResponse.json(updated)
  }

  // ── Manual done / not-done toggle ────────────────────────────────────────────
  if (typeof body.isDone === "boolean") {
    const now = new Date()
    const updated = await prisma.prospectResearchResult.update({
      where: { id },
      data:  { isDone: body.isDone, doneAt: body.isDone ? now : null },
      select: { id: true, isDone: true, doneAt: true, listId: true },
    })

    if (body.isDone) {
      // Check if this completes the whole list
      const [total, done] = await Promise.all([
        prisma.prospectResearchResult.count({ where: { listId: updated.listId } }),
        prisma.prospectResearchResult.count({ where: { listId: updated.listId, isDone: true } }),
      ])
      if (total > 0 && total === done) {
        await prisma.prospectResearchList.updateMany({
          where: { id: updated.listId, status: "active" },
          data:  { status: "completed", completedAt: now },
        })
        return NextResponse.json({ ...updated, listAutoCompleted: true })
      }
    } else {
      // Marking not-done: reopen auto-completed lists (but not manually completed ones)
      await prisma.prospectResearchList.updateMany({
        where: { id: updated.listId, status: "completed", manuallyCompleted: false },
        data:  { status: "active", completedAt: null },
      })
    }

    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: "prospectId or isDone required" }, { status: 400 })
}
