import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/session"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  const user = await prisma.hceUser.findFirst({ where: { email } })
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const access = await prisma.entityAccess.findMany({ where: { userId: user.id } })
  const token = await createSession({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    entityIds: access.map((a) => a.entityId),
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set("hce-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
