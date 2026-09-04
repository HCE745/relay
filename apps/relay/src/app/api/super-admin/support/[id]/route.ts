import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Resend } from "resend"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// GET /api/super-admin/support/[id] — conversation + all messages
export async function GET(_: Request, { params }: Params) {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const conv = await prisma.supportConversation.findUnique({
    where:   { id },
    include: {
      organization: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          senderUser:  { select: { id: true, name: true } },
          senderAdmin: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Mark user messages as read
  await prisma.supportMessage.updateMany({
    where: { supportConversationId: id, senderType: "user", isRead: false },
    data:  { isRead: true },
  })

  // Get org users for context
  const orgUsers = await prisma.user.findMany({
    where:  { organizationId: conv.orgId },
    select: { id: true, name: true, email: true, role: true },
    take:   20,
  })

  return NextResponse.json({ conversation: conv, orgUsers })
}

// POST /api/super-admin/support/[id] — SA reply or status change
export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id }                       = await params
  const { body, status, internalNotes, assignedToSAId } = await req.json() as {
    body?: string; status?: string; internalNotes?: string; assignedToSAId?: string | null
  }

  const conv = await prisma.supportConversation.findUnique({
    where:   { id },
    include: { organization: { select: { users: { select: { email: true, name: true } } } } },
  })
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (body?.trim()) {
    await prisma.supportMessage.create({
      data: {
        supportConversationId: id,
        senderType:            "admin",
        senderSAId:            session.superAdminId ?? undefined,
        body:                  body.trim(),
        isRead:                false,
      },
    })

    await prisma.supportConversation.update({
      where: { id },
      data:  { lastAdminReplyAt: new Date(), lastMessageAt: new Date() },
    })

    // Email org users
    notifyOrgUsers(
      conv.organization.users,
      body.trim(),
    ).catch(console.error)

    // In-app notification for org users
    const orgUsers = await prisma.user.findMany({
      where:  { organizationId: conv.orgId },
      select: { id: true },
    })
    await prisma.notification.createMany({
      data: orgUsers.map(u => ({
        userId:         u.id,
        organizationId: conv.orgId,
        type:           "NEW_MESSAGE",
        title:          "Support team replied",
        message:        body.trim().slice(0, 100),
      })),
      skipDuplicates: true,
    })
  }

  // Status, notes, assignment updates
  const updateData: Record<string, unknown> = {}
  if (status)                        updateData.status          = status
  if (internalNotes !== undefined)   updateData.internalNotes   = internalNotes
  if (assignedToSAId !== undefined)  updateData.assignedToSAId  = assignedToSAId ?? null

  if (Object.keys(updateData).length > 0) {
    await prisma.supportConversation.update({ where: { id }, data: updateData })
  }

  return NextResponse.json({ ok: true })
}

async function notifyOrgUsers(
  users: { email: string; name: string }[],
  body: string,
) {
  if (!users.length) return
  const resend  = new Resend(process.env.RESEND_API_KEY)
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? ""
  await Promise.allSettled(users.map(u =>
    resend.emails.send({
      from:    "support@getrelay.software",
      to:      u.email,
      subject: "Your support request has been updated",
      html: `<p>Hi ${u.name},</p>
             <p>Our support team replied to your request:</p>
             <blockquote>${body}</blockquote>
             <p><a href="${appUrl}/dashboard">Open Relay to continue the conversation →</a></p>`,
    })
  ))
}
