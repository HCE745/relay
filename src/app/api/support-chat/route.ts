import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Resend } from "resend"

export const dynamic = "force-dynamic"

function isBusinessHours() {
  const hour = new Date().getUTCHours()
  const day  = new Date().getUTCDay()
  return day >= 1 && day <= 5 && hour >= 9 && hour < 17
}

// GET /api/support-chat?since=ISO — poll for new messages in org's support conversation
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const since = new URL(req.url).searchParams.get("since")

  const conv = await prisma.supportConversation.findFirst({
    where:   { orgId: session.organizationId, status: { not: "resolved" } },
    orderBy: { createdAt: "desc" },
  })

  if (!conv) {
    return NextResponse.json({ conversation: null, messages: [], online: isBusinessHours() })
  }

  const messages = await prisma.supportMessage.findMany({
    where: {
      supportConversationId: conv.id,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  })

  // Mark admin messages as read
  await prisma.supportMessage.updateMany({
    where: {
      supportConversationId: conv.id,
      senderType:            { not: "user" },
      isRead:                false,
    },
    data: { isRead: true },
  })

  return NextResponse.json({
    conversation: { id: conv.id, status: conv.status },
    messages,
    online: isBusinessHours(),
  })
}

// POST /api/support-chat — send a message (user → support)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { body } = await req.json() as { body: string }
  if (!body?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 })

  let conv = await prisma.supportConversation.findFirst({
    where:   { orgId: session.organizationId, status: { not: "resolved" } },
    orderBy: { createdAt: "desc" },
  })

  if (!conv) {
    conv = await prisma.supportConversation.create({
      data: {
        orgId:  session.organizationId,
        status: "open",
      },
    })
  }

  const message = await prisma.supportMessage.create({
    data: {
      supportConversationId: conv.id,
      senderType:            "user",
      senderUserId:          session.userId,
      body:                  body.trim(),
      isRead:                false,
    },
  })

  await prisma.supportConversation.update({
    where: { id: conv.id },
    data:  { lastMessageAt: new Date() },
  })

  if (!isBusinessHours()) {
    await prisma.supportMessage.create({
      data: {
        supportConversationId: conv.id,
        senderType:            "system",
        body:                  "Thanks for reaching out! Our support team is currently offline. We'll get back to you during business hours (Mon–Fri, 9am–5pm UTC).",
        isRead:                false,
      },
    })
  } else {
    notifySupportTeam(session.name, session.organizationId, conv.id, body.trim()).catch(console.error)
  }

  return NextResponse.json({ message, conversationId: conv.id })
}

async function notifySupportTeam(userName: string, orgId: string, convId: string, preview: string) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const org    = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } })
  const admins = await prisma.superAdmin.findMany({ select: { email: true } })
  if (!admins.length) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  await resend.emails.send({
    from:    "support@getrelay.software",
    to:      admins.map(a => a.email),
    subject: `Support message from ${userName} (${org?.name ?? orgId})`,
    html: `<p><strong>${userName}</strong> sent a support message:</p>
           <blockquote>${preview}</blockquote>
           <p><a href="${appUrl}/super-admin/support/${convId}">Reply in Support Inbox →</a></p>`,
  })
}
