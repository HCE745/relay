import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  const result = await prisma.user.updateMany({
    where: {
      userType: "EXTERNAL",
      isActive: true,
      expiresAt: { lt: now },
    },
    data: {
      isActive: false,
    },
  })

  return NextResponse.json({ ok: true, deactivated: result.count })
}
