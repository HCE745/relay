import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const VALID_TYPES = new Set([
  "link_clicked", "tour_started", "tour_step_completed", "tour_completed",
  "pricing_viewed", "demo_requested", "trial_started", "page_viewed", "returned_visit",
])

const BOT_RE = /bot|crawler|spider|scanner|preview|security|python|curl|wget|java\//i

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      token: string
      eventType: string
      eventData?: Record<string, unknown>
      sessionId: string
      activeTimeSeconds?: number
    }

    const { token, eventType, eventData = {}, sessionId, activeTimeSeconds = 0 } = body

    if (!token || !VALID_TYPES.has(eventType) || !sessionId) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const lc = await prisma.linkClick.findUnique({
      where: { token },
      select: { id: true },
    })
    if (!lc) return NextResponse.json({ ok: false }, { status: 404 })

    const ua       = req.headers.get("user-agent") ?? ""
    const isBot    = BOT_RE.test(ua)

    await prisma.linkTrackingEvent.create({
      data: {
        token,
        eventType,
        eventData: eventData as object,
        sessionId,
        activeTimeSeconds,
        isBotSuspected: isBot,
      },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
