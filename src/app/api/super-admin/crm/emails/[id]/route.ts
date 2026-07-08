import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// PATCH /api/super-admin/crm/emails/[id]
// actions: set_followup, clear_followup, mark_followup_done
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id }   = await params
  const body     = await req.json() as { action: string; followUpDate?: string; isRead?: boolean }

  const email = await prisma.crmEmail.findUnique({ where: { id } })
  if (!email) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (body.action === "set_followup") {
    if (!body.followUpDate) return NextResponse.json({ error: "followUpDate required" }, { status: 400 })
    const updated = await prisma.crmEmail.update({
      where: { id },
      data:  { followUpDate: new Date(body.followUpDate), followUpDoneAt: null },
    })
    return NextResponse.json({ email: updated })
  }

  if (body.action === "clear_followup") {
    const updated = await prisma.crmEmail.update({
      where: { id },
      data:  { followUpDate: null, followUpDoneAt: null },
    })
    return NextResponse.json({ email: updated })
  }

  if (body.action === "mark_followup_done") {
    const updated = await prisma.crmEmail.update({
      where: { id },
      data:  { followUpDoneAt: new Date() },
    })
    return NextResponse.json({ email: updated })
  }

  if (body.action === "mark_read") {
    const updated = await prisma.crmEmail.update({
      where: { id },
      data:  { isRead: body.isRead ?? true },
    })
    return NextResponse.json({ email: updated })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
