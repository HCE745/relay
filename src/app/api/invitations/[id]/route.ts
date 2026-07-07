import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "HR"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const invitation = await prisma.invitation.findUnique({ where: { id } })
  if (!invitation || invitation.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.invitation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
