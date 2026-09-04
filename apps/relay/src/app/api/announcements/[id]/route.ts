import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const announcement = await prisma.announcement.findFirst({
    where: { id, orgId: session.organizationId },
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      acknowledgments: {
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { acknowledgedAt: "asc" },
      },
    },
  })

  if (!announcement) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ announcement })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canEdit = ["ADMIN", "MANAGER"].includes(session.role)
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const announcement = await prisma.announcement.updateMany({
    where: { id, orgId: session.organizationId },
    data: {
      ...(body.title    !== undefined ? { title:     body.title    as string } : {}),
      ...(body.body     !== undefined ? { body:      body.body     as string } : {}),
      ...(body.priority !== undefined ? { priority:  body.priority as never  } : {}),
      ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ? new Date(body.expiresAt as string) : null } : {}),
    },
  })

  return NextResponse.json({ updated: announcement.count > 0 })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canDelete = ["ADMIN", "MANAGER"].includes(session.role)
  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  await prisma.announcement.deleteMany({ where: { id, orgId: session.organizationId } })
  return NextResponse.json({ ok: true })
}
