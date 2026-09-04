import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Resend } from "resend"

export const dynamic = "force-dynamic"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// GET /api/super-admin/broadcast — list past broadcasts
export async function GET() {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const broadcasts = await prisma.broadcast.findMany({
    where:   { sentBySAId: session.superAdminId! },
    orderBy: { sentAt: "desc" },
    take:    50,
  })

  return NextResponse.json({ broadcasts })
}

// POST /api/super-admin/broadcast — send broadcast
export async function POST(req: NextRequest) {
  const session = await requireSA()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const {
    title,
    body,
    targetType,  // "all" | "plan" | "trial" | "org"
    targetPlan,
    targetOrgId,
    sendEmail,
  } = await req.json() as {
    title:        string
    body:         string
    targetType:   string
    targetPlan?:  string
    targetOrgId?: string
    sendEmail?:   boolean
  }

  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Title and body required" }, { status: 400 })
  }

  // Resolve target users (with their orgId for notifications)
  let users: { id: string; organizationId: string }[] = []

  if (targetType === "all") {
    users = await prisma.user.findMany({ select: { id: true, organizationId: true } })
  } else if (targetType === "trial") {
    const orgs = await prisma.organization.findMany({ where: { plan: "trial" }, select: { id: true } })
    users = await prisma.user.findMany({
      where:  { organizationId: { in: orgs.map(o => o.id) } },
      select: { id: true, organizationId: true },
    })
  } else if (targetType === "plan" && targetPlan) {
    const orgs = await prisma.organization.findMany({ where: { plan: targetPlan }, select: { id: true } })
    users = await prisma.user.findMany({
      where:  { organizationId: { in: orgs.map(o => o.id) } },
      select: { id: true, organizationId: true },
    })
  } else if (targetType === "org" && targetOrgId) {
    users = await prisma.user.findMany({
      where:  { organizationId: targetOrgId },
      select: { id: true, organizationId: true },
    })
  }

  const userIds = users.map(u => u.id)

  const broadcast = await prisma.broadcast.create({
    data: {
      sentBySAId:     session.superAdminId!,
      title:          title.trim(),
      body:           body.trim(),
      targetType,
      targetPlan:     targetPlan ?? null,
      targetOrgId:    targetOrgId ?? null,
      recipientCount: userIds.length,
    },
  })

  // In-app notifications
  if (users.length > 0) {
    await prisma.notification.createMany({
      data: users.map(u => ({
        userId:         u.id,
        organizationId: u.organizationId,
        type:           "NEW_MESSAGE",
        title:          title.trim().slice(0, 100),
        message:        body.trim().slice(0, 200),
      })),
      skipDuplicates: true,
    })
  }

  // Email (fire-and-forget)
  if (sendEmail && userIds.length > 0) {
    sendBroadcastEmails(title.trim(), body.trim(), userIds).catch(console.error)
  }

  return NextResponse.json({ broadcast, recipientCount: userIds.length })
}

async function sendBroadcastEmails(title: string, body: string, userIds: string[]) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const users  = await prisma.user.findMany({
    where:  { id: { in: userIds } },
    select: { email: true, name: true },
  })

  for (let i = 0; i < users.length; i += 100) {
    const chunk = users.slice(i, i + 100)
    await Promise.allSettled(chunk.map(u =>
      resend.emails.send({
        from:    "will@getrelay.software",
        to:      u.email,
        subject: title,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                 <p>Hi ${u.name ?? "there"},</p>
                 <div style="white-space:pre-wrap">${body}</div>
                 <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
                 <p style="font-size:12px;color:#9ca3af">
                   You're receiving this because you have an account on Relay.<br>
                   <a href="${appUrl}/dashboard">Open Relay</a>
                 </p>
               </div>`,
      })
    ))
  }
}
