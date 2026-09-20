import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Delete device tokens that haven't received a successful push in 90+ days.
  // FCM 404/410 errors also delete tokens immediately; this is a belt-and-suspenders cleanup.
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const { count } = await prisma.deviceToken.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })

  console.log(`[cleanup-device-tokens] deleted ${count} stale device tokens`)
  return NextResponse.json({ deleted: count, timestamp: new Date().toISOString() })
}
