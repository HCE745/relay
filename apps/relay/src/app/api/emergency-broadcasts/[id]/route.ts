import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const broadcast = await prisma.emergencyBroadcast.findFirst({
    where: { id, orgId: session.organizationId },
    include: {
      createdBy:  { select: { id: true, name: true, role: true } },
      resolvedBy: { select: { id: true, name: true } },
      acknowledgments: {
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { acknowledgedAt: "asc" },
      },
    },
  })

  if (!broadcast) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ broadcast })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canResolve = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(session.role)
  if (!canResolve) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const { action } = await req.json() as { action: "resolve" }

  if (action !== "resolve") return NextResponse.json({ error: "Unknown action" }, { status: 400 })

  const broadcast = await prisma.emergencyBroadcast.updateMany({
    where: { id, orgId: session.organizationId, resolvedAt: null },
    data: { resolvedAt: new Date(), resolvedById: session.userId },
  })

  return NextResponse.json({ updated: broadcast.count > 0 })
}
