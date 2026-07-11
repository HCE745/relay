import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { sendPushNotification } from "@/lib/push-notifications"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const broadcasts = await prisma.emergencyBroadcast.findMany({
    where: { orgId: session.organizationId },
    include: {
      createdBy:  { select: { id: true, name: true, role: true } },
      resolvedBy: { select: { id: true, name: true } },
      acknowledgments: {
        where: { userId: session.userId },
        select: { userId: true, acknowledgedAt: true },
      },
      _count: { select: { acknowledgments: true } },
    },
    orderBy: [{ resolvedAt: "asc" }, { createdAt: "desc" }],
  })

  return NextResponse.json({ broadcasts })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canCreate = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json() as {
    type:       string
    title:      string
    body:       string
    scopeType?: string
    scopeId?:   string
  }

  if (!body.title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 })
  if (!body.body?.trim())  return NextResponse.json({ error: "Body required" }, { status: 400 })
  if (!body.type)          return NextResponse.json({ error: "Type required" }, { status: 400 })

  const broadcast = await prisma.emergencyBroadcast.create({
    data: {
      orgId:       session.organizationId,
      type:        body.type as never,
      title:       body.title.trim(),
      body:        body.body.trim(),
      scopeType:   (body.scopeType as never) ?? "org",
      scopeId:     body.scopeId,
      createdById: session.userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  // Notify all org members immediately with push
  const members = await prisma.user.findMany({
    where: { organizationId: session.organizationId, id: { not: session.userId } },
    select: { id: true },
  })

  await Promise.all(
    members.map(async m => {
      await prisma.notification.create({
        data: {
          userId:         m.id,
          organizationId: session.organizationId,
          type:           "EMERGENCY_BROADCAST",
          title:          `EMERGENCY: ${body.title}`,
          message:        body.body.substring(0, 160),
        },
      })
      sendPushNotification(m.id, `EMERGENCY: ${body.title}`, body.body.substring(0, 160), {
        type:        "EMERGENCY_BROADCAST",
        broadcastId: broadcast.id,
      }).catch(() => {})
    })
  )

  return NextResponse.json({ broadcast }, { status: 201 })
}
