export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Close sessions idle for more than 30 minutes and credit time to the daily activity record.
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 30 * 60 * 1000)

  const staleSessions = await prisma.salesSession.findMany({
    where: {
      logoutAt: null,
      lastActivityAt: { lt: cutoff },
    },
    select: { id: true, salesUserId: true, loginAt: true, lastActivityAt: true },
  })

  let closed = 0

  for (const s of staleSessions) {
    const logoutAt = new Date(s.lastActivityAt.getTime() + 30 * 60 * 1000)
    const durationMinutes = Math.round((logoutAt.getTime() - s.loginAt.getTime()) / 60000)

    await prisma.salesSession.update({
      where: { id: s.id },
      data:  { logoutAt, durationMinutes },
    })

    // Credit active session time to the day the session started
    const sessionDay = new Date(s.loginAt)
    const dayDate = new Date(Date.UTC(
      sessionDay.getUTCFullYear(),
      sessionDay.getUTCMonth(),
      sessionDay.getUTCDate(),
    ))
    const clampedMinutes = Math.min(durationMinutes, 16 * 60)
    if (clampedMinutes > 0) {
      await prisma.salesDailyActivity.upsert({
        where:  { salesUserId_date: { salesUserId: s.salesUserId, date: dayDate } },
        create: { salesUserId: s.salesUserId, date: dayDate, timeInAppMinutes: clampedMinutes, lastActivityAt: logoutAt },
        update: { timeInAppMinutes: { increment: clampedMinutes }, lastActivityAt: logoutAt },
      })
    }

    closed++
  }

  return NextResponse.json({ closed })
}
