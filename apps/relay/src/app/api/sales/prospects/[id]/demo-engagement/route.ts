import "server-only"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

export interface DemoSession {
  sessionId:        string
  linkToken:        string
  linkCreatedAt:    string
  contactId:        string | null
  contactName:      string | null
  salesUserId:      string | null
  salesUserName:    string | null
  firstEventAt:     string
  lastEventAt:      string
  totalActiveSeconds: number
  industrySelected: string | null
  enteredTour:      boolean
  enteredDemo:      boolean
  tourStepsReached: number
  requestedDemo:    boolean
  startedTrial:     boolean
  events:           DemoEvent[]
}

export interface DemoEvent {
  id:               string
  eventType:        string
  eventData:        Record<string, unknown>
  activeTimeSeconds: number
  createdAt:        string
}

export interface DemoEngagementResponse {
  sessions:    DemoSession[]
  linkCount:   number
  totalVisits: number
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: prospectId } = await params

  // Fetch all tracked links for this prospect, with their events
  const links = await prisma.linkClick.findMany({
    where: { prospectId },
    orderBy: { createdAt: "desc" },
    include: {
      contact:   { select: { id: true, name: true } },
      salesUser: { select: { id: true, name: true } },
      events: {
        where: { isBotSuspected: false },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  // Group events by token+sessionId — keying on sessionId alone would merge sessions
  // from different links if the same browser tab visited multiple tracked links
  // (sessionStorage reuses the same relay_session_id across hard navigations within a tab).
  const sessionMap = new Map<string, {
    sessionId: string
    linkToken: string
    linkCreatedAt: string
    contactId: string | null
    contactName: string | null
    salesUserId: string | null
    salesUserName: string | null
    events: typeof links[0]["events"]
  }>()

  for (const link of links) {
    for (const event of link.events) {
      if (!event.sessionId) continue
      const key = `${link.token}_${event.sessionId}`
      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          sessionId:    event.sessionId,
          linkToken:    link.token,
          linkCreatedAt: link.createdAt.toISOString(),
          contactId:    link.contact?.id    ?? null,
          contactName:  link.contact?.name  ?? null,
          salesUserId:  link.salesUser?.id  ?? null,
          salesUserName: link.salesUser?.name ?? null,
          events: [],
        })
      }
      sessionMap.get(key)!.events.push(event)
    }
  }

  // Build session summaries
  const sessions: DemoSession[] = []
  for (const [, data] of sessionMap) {
    const sessionId = data.sessionId
    const evts = data.events
    if (evts.length === 0) continue

    const industryEvent = evts.find(e =>
      (e.eventType === "tour_started" || e.eventType === "page_viewed") &&
      (e.eventData as Record<string, unknown>).industrySelected
    )
    const industrySelected =
      (industryEvent?.eventData as Record<string, unknown> | undefined)?.industrySelected as string ?? null

    const tourStepEvents = evts.filter(e => e.eventType === "tour_step_completed")
    const stepNumbers = tourStepEvents
      .map(e => Number((e.eventData as Record<string, unknown>).step))
      .filter(n => !isNaN(n))
    const tourStepsReached = stepNumbers.length > 0 ? Math.max(...stepNumbers) : 0

    const eventTypes = new Set(evts.map(e => e.eventType))

    sessions.push({
      sessionId,
      linkToken:          data.linkToken,
      linkCreatedAt:      data.linkCreatedAt,
      contactId:          data.contactId,
      contactName:        data.contactName,
      salesUserId:        data.salesUserId,
      salesUserName:      data.salesUserName,
      firstEventAt:       evts[0].createdAt.toISOString(),
      lastEventAt:        evts[evts.length - 1].createdAt.toISOString(),
      totalActiveSeconds: evts.reduce((sum, e) => sum + e.activeTimeSeconds, 0),
      industrySelected,
      enteredTour:        eventTypes.has("tour_started"),
      enteredDemo:        eventTypes.has("page_viewed"),
      tourStepsReached,
      requestedDemo:      eventTypes.has("demo_requested"),
      startedTrial:       eventTypes.has("trial_started"),
      events: evts.map(e => ({
        id:               e.id,
        eventType:        e.eventType,
        eventData:        e.eventData as Record<string, unknown>,
        activeTimeSeconds: e.activeTimeSeconds,
        createdAt:        e.createdAt.toISOString(),
      })),
    })
  }

  // Sort sessions newest first
  sessions.sort((a, b) => new Date(b.firstEventAt).getTime() - new Date(a.firstEventAt).getTime())

  return NextResponse.json({
    sessions,
    linkCount:   links.length,
    totalVisits: sessions.length,
  } satisfies DemoEngagementResponse)
}
