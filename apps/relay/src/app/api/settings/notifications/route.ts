import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const prefs = await req.json()

  await prisma.userSettings.upsert({
    where:  { userId: session.userId },
    create: { userId: session.userId, notificationPrefs: prefs },
    update: { notificationPrefs: prefs },
  })

  return NextResponse.json({ ok: true })
}
