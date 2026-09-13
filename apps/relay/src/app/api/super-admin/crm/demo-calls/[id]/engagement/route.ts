export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { computeEngagementScore, scoreLabel } from "@/lib/engagement-score"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const call = await prisma.demoCall.findUnique({
    where: { id },
    select: { contactEmail: true },
  })
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const email = call.contactEmail.toLowerCase()

  // LinkTrackingEvents linked to clicks on emails sent to this contact
  const [clickRows, opens] = await Promise.all([
    prisma.linkClick.findMany({
      where: {
        isBotSuspected: false,
        crmEmail: { contactEmail: { equals: email, mode: "insensitive" } },
      },
      orderBy: { lastClickedAt: "desc" },
      take: 10,
      select: {
        destinationUrl: true,
        clickCount:     true,
        lastClickedAt:  true,
        events: {
          where:   { isBotSuspected: false },
          orderBy: { createdAt: "desc" },
          take:    10,
          select:  { eventType: true, isBotSuspected: true, createdAt: true },
        },
      },
    }),
    prisma.crmEmail.aggregate({
      where: { contactEmail: { equals: email, mode: "insensitive" }, openedAt: { not: null } },
      _count: true,
    }),
  ])

  const allEvents = clickRows.flatMap(c => c.events)
  const hasRealClick = clickRows.some(c => c.clickCount > 0)
  const score = computeEngagementScore(allEvents, opens._count, hasRealClick)
  const label = scoreLabel(score)

  const clicks = clickRows.map(c => ({
    url:           c.destinationUrl,
    clickCount:    c.clickCount,
    lastClickedAt: c.lastClickedAt?.toISOString() ?? null,
  }))

  const events = allEvents
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
    .map(e => ({ eventType: e.eventType, createdAt: e.createdAt.toISOString() }))

  return NextResponse.json({ score, label, events, clicks, openCount: opens._count })
}
