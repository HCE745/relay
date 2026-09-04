import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { token?: string; platform?: string }
  const { token, platform } = body

  if (!token?.trim() || !platform?.trim()) {
    return NextResponse.json({ error: "token and platform are required" }, { status: 400 })
  }

  // Upsert: keep the token entry fresh and reassign if the same token switches user
  await prisma.deviceToken.upsert({
    where:  { token },
    update: { userId: session.userId, platform },
    create: { userId: session.userId, token, platform },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { token?: string }
  if (!body.token) return NextResponse.json({ error: "token is required" }, { status: 400 })

  await prisma.deviceToken.deleteMany({
    where: { userId: session.userId, token: body.token },
  })

  return NextResponse.json({ ok: true })
}
