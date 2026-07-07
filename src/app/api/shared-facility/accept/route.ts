import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as { token: string }
  if (!body.token) return NextResponse.json({ error: "Token required" }, { status: 400 })

  const rel = await prisma.organizationRelationship.findUnique({
    where: { inviteToken: body.token },
  })

  if (!rel) return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 })
  if (rel.status !== "pending") return NextResponse.json({ error: "Invitation already used" }, { status: 400 })
  if (rel.orgIdA === session.organizationId) {
    return NextResponse.json({ error: "Cannot accept your own invitation" }, { status: 400 })
  }

  const updated = await prisma.organizationRelationship.update({
    where: { id: rel.id },
    data: {
      orgIdB: session.organizationId,
      status: "active",
      inviteToken: null, // consume token
    },
  })

  return NextResponse.json({ relationship: updated })
}
