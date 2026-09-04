import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

function stepsForIndustry(industry: string | null): number {
  if (industry === "Car Wash") return 20
  if (industry === "Property Management") return 20
  if (industry === "Manufacturing") return 21
  return 22
}

export interface TourEngagementData {
  hasEngagement: boolean
  linkClicked: boolean
  linkClickedAt: string | null
  tourStarted: boolean
  industrySelected: string | null
  stepsCompleted: number
  totalSteps: number
  tourCompleted: boolean
  activeTimeSec: number
  ctaClicked: string | null
  ctaClickedLabel: string | null
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rawIds = req.nextUrl.searchParams.get("emailIds") ?? ""
  const emailIds = rawIds.split(",").map(s => s.trim()).filter(Boolean)
  if (emailIds.length === 0) return NextResponse.json({ hasEngagement: false } satisfies Partial<TourEngagementData>)

  const clicks = await prisma.linkClick.findMany({
    where: {
      crmEmailId: { in: emailIds },
      isBotSuspected: false,
    },
    include: {
      events: {
        where: { isBotSuspected: false },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  const anyClicked = clicks.some(c => (c.clickCount ?? 0) > 0)
  if (!anyClicked && clicks.every(c => c.events.length === 0)) {
    return NextResponse.json({ hasEngagement: false } satisfies Partial<TourEngagementData>)
  }

  const firstClickedAt = clicks
    .filter(c => c.firstClickedAt != null)
    .sort((a, b) => a.firstClickedAt!.getTime() - b.firstClickedAt!.getTime())[0]
    ?.firstClickedAt ?? null

  const allEvents = clicks.flatMap(c => c.events)

  // Group events by sessionId to find the most-engaged session
  const sessionMap = new Map<string, typeof allEvents>()
  for (const ev of allEvents) {
    const sid = ev.sessionId || "__"
    const bucket = sessionMap.get(sid) ?? []
    bucket.push(ev)
    sessionMap.set(sid, bucket)
  }

  // Pick the session with tour events, preferring most steps completed
  let bestEvents: typeof allEvents = allEvents
  let bestStepCount = -1
  for (const events of sessionMap.values()) {
    if (!events.some(e => e.eventType === "tour_started")) continue
    const steps = new Set(
      events
        .filter(e => e.eventType === "tour_step_completed")
        .map(e => (e.eventData as Record<string, unknown>)?.step)
    ).size
    if (steps > bestStepCount) {
      bestStepCount = steps
      bestEvents = events
    }
  }

  const tourStartedEvent = bestEvents.find(e => e.eventType === "tour_started")
  const stepEvents = bestEvents.filter(e => e.eventType === "tour_step_completed")
  const completedEvent = bestEvents.find(e => e.eventType === "tour_completed")

  const industry = (tourStartedEvent?.eventData as Record<string, unknown> | null)?.industry as string | null ?? null

  const uniqueSteps = new Set(
    stepEvents.map(e => (e.eventData as Record<string, unknown>)?.step)
  )
  const stepsCompleted = uniqueSteps.size
  const totalSteps = stepsForIndustry(industry)

  // CTA: strongest signal wins
  let ctaClicked: string | null = null
  let ctaClickedLabel: string | null = null
  for (const ev of bestEvents) {
    if (ev.eventType === "trial_started") { ctaClicked = "trial_started"; ctaClickedLabel = "Start Trial"; break }
    if (ev.eventType === "demo_requested") { ctaClicked = "demo_requested"; ctaClickedLabel = "Book Demo"; break }
    if (ev.eventType === "pricing_viewed" && !ctaClicked) { ctaClicked = "pricing_viewed"; ctaClickedLabel = "Explore Pricing" }
  }

  const activeTimeSec = bestEvents.reduce((max, ev) => Math.max(max, ev.activeTimeSeconds ?? 0), 0)

  return NextResponse.json({
    hasEngagement: true,
    linkClicked: anyClicked,
    linkClickedAt: firstClickedAt?.toISOString() ?? null,
    tourStarted: !!tourStartedEvent,
    industrySelected: industry,
    stepsCompleted,
    totalSteps,
    tourCompleted: !!completedEvent,
    activeTimeSec,
    ctaClicked,
    ctaClickedLabel,
  } satisfies TourEngagementData)
}
