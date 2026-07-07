import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"

export const dynamic = "force-dynamic"

// POST — generate (or return existing) calendar feed token for the current user
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { calendarToken: true },
  })

  if (!user?.calendarToken) {
    const token = randomBytes(24).toString("hex")
    user = await prisma.user.update({
      where: { id: session.userId },
      data: { calendarToken: token },
      select: { calendarToken: true },
    })
  }

  return NextResponse.json({ token: user!.calendarToken })
}

// DELETE — revoke token
export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.user.update({
    where: { id: session.userId },
    data: { calendarToken: null },
  })
  return NextResponse.json({ ok: true })
}
