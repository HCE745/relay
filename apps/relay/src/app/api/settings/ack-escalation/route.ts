import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.enabled !== "boolean" || typeof body.delayMinutes !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  await prisma.organization.update({
    where: { id: session.organizationId },
    data: {
      ackEscalationConfig: {
        enabled:      body.enabled,
        delayMinutes: Math.max(1, Math.round(body.delayMinutes)),
        recipients:   body.recipients ?? { roles: [], userIds: [] },
      },
    },
  })

  return NextResponse.json({ ok: true })
}
