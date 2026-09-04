import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN" && session.role !== "HR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const { newPassword } = await request.json()
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const user = await prisma.user.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Prevent non-admins from resetting an admin's password
  if (user.role === "ADMIN" && session.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can reset another admin's password" }, { status: 403 })
  }

  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id }, data: { password: hashed } })

  return NextResponse.json({ ok: true })
}
