import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/session"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  const user = await prisma.hceUser.findFirst({
    where: { email },
    include: { entityAccess: true },
  })

  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }
  if (!user.active) {
    return NextResponse.json({ error: "Account is deactivated" }, { status: 403 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  // OWNER + ADMIN see all entities in the tenant automatically.
  // Other roles only see their explicitly granted EntityAccess rows.
  let entityIds: string[]
  if (user.role === "OWNER" || user.role === "ADMIN") {
    const allEntities = await prisma.entity.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true },
    })
    entityIds = allEntities.map((e) => e.id)
  } else {
    entityIds = user.entityAccess.map((a) => a.entityId)
  }

  const token = await createSession({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    entityIds,
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set("hce-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
  // Keep existing hce-theme cookie if present; set default on first login
  if (!req.cookies.get("hce-theme")) {
    res.cookies.set("hce-theme", "contemporary", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
  }
  return res
}
