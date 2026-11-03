import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"

const VALID_LOCALES = ["en", "es", "fr", "de", "pt", "it", "pl", "nl"]

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { language?: unknown }
  const language = typeof body.language === "string" ? body.language : ""

  if (!VALID_LOCALES.includes(language)) {
    return NextResponse.json({ error: "Invalid language" }, { status: 400 })
  }

  await prisma.userSettings.upsert({
    where:  { userId: session.userId },
    create: { userId: session.userId, language },
    update: { language },
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set("locale", language, {
    path:     "/",
    maxAge:   60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  })
  return res
}
