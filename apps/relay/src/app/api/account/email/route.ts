import { NextRequest, NextResponse } from "next/server"
import { getSession, createSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Check canChangeEmail flag
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { canChangeEmail: true, name: true, role: true, organizationId: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  if (!user.canChangeEmail) {
    return NextResponse.json({ error: "Email changes are disabled for your account" }, { status: 403 })
  }

  const body = await request.json()
  const { email } = body
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing && existing.id !== session.userId) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 })
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { email },
  })

  // Refresh session with new email
  await createSession({
    userId: session.userId,
    email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
  })

  return NextResponse.json({ ok: true })
}
