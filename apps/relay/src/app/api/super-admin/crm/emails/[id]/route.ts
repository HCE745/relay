import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// PATCH /api/super-admin/crm/emails/[id]
// actions: set_followup, clear_followup, mark_followup_done, mark_read,
//          archive, unarchive, delete
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body   = await req.json() as {
    action:         string
    followUpDate?:  string
    isRead?:        boolean
    deletedByName?: string
  }

  const email = await prisma.crmEmail.findUnique({
    where:   { id },
    include: { demoCall: { select: { organizationId: true } } },
  })
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

  if (body.action === "archive") {
    await prisma.crmEmail.update({ where: { id }, data: { isArchived: true } })
    return NextResponse.json({ ok: true })
  }

  if (body.action === "unarchive") {
    await prisma.crmEmail.update({ where: { id }, data: { isArchived: false } })
    return NextResponse.json({ ok: true })
  }

  if (body.action === "delete") {
    const now        = new Date()
    const deletedBy  = body.deletedByName ?? session.name ?? "Super Admin"
    const dateStr    = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

    await prisma.crmEmail.update({
      where: { id },
      data:  { isDeleted: true, deletedAt: now, deletedByName: deletedBy },
    })

    // Write tombstone to audit timeline if linked to an org
    const orgId = email.demoCall?.organizationId
    if (orgId) {
      await prisma.crmActivity.create({
        data: {
          organizationId:  orgId,
          eventType:       "email_record_deleted",
          description:     `Email record deleted by ${deletedBy} on ${dateStr} — Subject: "${email.subject}"`,
          createdBySAName: deletedBy,
          metadata:        { emailId: id, subject: email.subject, deletedAt: now.toISOString() },
        },
      }).catch(() => null)
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
