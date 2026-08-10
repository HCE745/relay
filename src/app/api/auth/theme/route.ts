import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/session"

export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest) {
  const session = await requireSession()
  const { theme } = await req.json()

  if (theme !== "contemporary" && theme !== "heritage") {
    return NextResponse.json({ error: "Invalid theme" }, { status: 400 })
  }

  await prisma.hceUser.update({
    where: { id: session.userId },
    data: { themePreference: theme },
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set("hce-theme", theme, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
