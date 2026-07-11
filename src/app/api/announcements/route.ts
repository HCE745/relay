import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const includeExpired = searchParams.get("includeExpired") === "true"

  const announcements = await prisma.announcement.findMany({
    where: {
      orgId: session.organizationId,
      ...(includeExpired ? {} : {
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      }),
    },
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      acknowledgments: {
        where: { userId: session.userId },
        select: { userId: true, acknowledgedAt: true },
      },
      _count: { select: { acknowledgments: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  })

  return NextResponse.json({ announcements })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canCreate = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)
  if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json() as {
    title:                  string
    body:                   string
    priority?:              string
    scopeType?:             string
    scopeId?:               string
    requiresAcknowledgment?: boolean
    expiresAt?:             string
  }

  if (!body.title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 })
  if (!body.body?.trim())  return NextResponse.json({ error: "Body required" }, { status: 400 })

  const announcement = await prisma.announcement.create({
    data: {
      orgId:                  session.organizationId,
      title:                  body.title.trim(),
      body:                   body.body.trim(),
      priority:               (body.priority as never) ?? "normal",
      scopeType:              (body.scopeType as never) ?? "org",
      scopeId:                body.scopeId,
      createdById:            session.userId,
      requiresAcknowledgment: body.requiresAcknowledgment ?? false,
      expiresAt:              body.expiresAt ? new Date(body.expiresAt) : undefined,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  })

  // Notify all org members
  const members = await prisma.user.findMany({
    where: { organizationId: session.organizationId, id: { not: session.userId } },
    select: { id: true },
  })
  if (members.length > 0) {
    await prisma.notification.createMany({
      data: members.map(m => ({
        userId:         m.id,
        organizationId: session.organizationId,
        type:           "ANNOUNCEMENT",
        title:          body.priority === "urgent" ? "Urgent Announcement" : "New Announcement",
        message:        body.title,
      })),
    })
  }

  return NextResponse.json({ announcement }, { status: 201 })
}
