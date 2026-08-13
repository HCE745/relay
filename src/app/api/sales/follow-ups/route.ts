import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { computeEngagementScore, scoreLabel } from "@/lib/engagement-score"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Seed default stages if none exist
  const stageCount = await prisma.followUpStage.count()
  if (stageCount === 0) {
    await prisma.followUpStage.createMany({
      data: [
        { stageNumber: 0, name: "Initial Outreach",  daysAfterPrevious: 0,  description: "First email sent to a prospect" },
        { stageNumber: 1, name: "First Follow-Up",   daysAfterPrevious: 3,  description: null },
        { stageNumber: 2, name: "Second Follow-Up",  daysAfterPrevious: 7,  description: null },
        { stageNumber: 3, name: "Final Touch",       daysAfterPrevious: 14, description: null },
      ],
    })
  }

  const stages = await prisma.followUpStage.findMany({ orderBy: { stageNumber: "asc" } })
  const stageMap = Object.fromEntries(stages.map(s => [s.stageNumber, s.name]))
  const maxStageNum = stages.length > 0 ? stages[stages.length - 1].stageNumber : 3

  const emails = await prisma.crmEmail.findMany({
    where: {
      direction:      "sent",
      followUpDate:   { not: null },
      followUpDoneAt: null,
      isDeleted:      false,
    },
    orderBy: { followUpDate: "asc" },
    select: {
      id:           true,
      contactEmail: true,
      subject:      true,
      sentAt:       true,
      followUpDate: true,
      stageNumber:  true,
      threadId:     true,
      demoCallId:   true,
      openedAt:     true,
      openCount:    true,
      lastOpenedAt: true,
      demoCall: {
        select: { id: true, contactName: true, companyName: true, contactEmail: true },
      },
    },
  })

  // Check which threads have received replies (warm lead = opened, no reply yet)
  const threadIds       = [...new Set(emails.map(e => e.threadId).filter(Boolean))] as string[]
  // Unique contact emails in the queue — used for true per-prospect sent count
  const contactEmailsRaw = [...new Set(emails.map(e => e.contactEmail).filter(Boolean))] as string[]

  // Count ALL sent emails per contact email (not just within a thread) so we can
  // correctly determine each prospect's stage, including emails sent before the
  // stage-tracking feature existed.
  const [repliedRaw, sentCountsRaw] = await Promise.all([
    threadIds.length > 0
      ? prisma.crmEmail.findMany({
          where: { threadId: { in: threadIds }, direction: "received", isDeleted: false },
          select: { threadId: true },
        })
      : Promise.resolve([]),
    contactEmailsRaw.length > 0
      ? prisma.crmEmail.groupBy({
          by:    ["contactEmail"],
          where: {
            contactEmail: { in: contactEmailsRaw },
            direction:    "sent",
            isDeleted:    false,
          },
          _count: { id: true },
        })
      : Promise.resolve([]),
  ])

  const repliedThreadIds = new Set(repliedRaw.map(r => r.threadId).filter(Boolean) as string[])
  // Keyed by lowercased email for case-insensitive lookup
  const contactSentCounts = Object.fromEntries(
    sentCountsRaw.map(r => [(r.contactEmail ?? "").toLowerCase(), r._count.id])
  )

  // Fetch engagement data for all prospects in the queue
  const contactEmailsInQueue = [...new Set(emails.map(e => e.contactEmail).filter(Boolean))] as string[]
  const [prospectContacts, emailLinkClicks] = await Promise.all([
    contactEmailsInQueue.length > 0
      ? prisma.prospectContact.findMany({
          where:  { email: { in: contactEmailsInQueue } },
          select: { email: true, prospectId: true },
        })
      : Promise.resolve([]),
    emails.length > 0
      ? prisma.linkClick.findMany({
          where: {
            crmEmailId: { in: emails.map(e => e.id) },
          },
          select: { crmEmailId: true, clickCount: true, isBotSuspected: true, token: true },
        })
      : Promise.resolve([]),
  ])

  // Map contact email → prospectId
  const emailToProspectId = Object.fromEntries(
    prospectContacts.map(pc => [pc.email!.toLowerCase(), pc.prospectId])
  )

  // Get all unique prospectIds, then fetch their tracking events
  const prospectIdsInQueue = [...new Set(Object.values(emailToProspectId).filter(Boolean))] as string[]
  const prospectLinkClicks = prospectIdsInQueue.length > 0
    ? await prisma.linkClick.findMany({
        where:   { prospectId: { in: prospectIdsInQueue } },
        include: { events: { select: { eventType: true, isBotSuspected: true } } },
      })
    : []

  // Build per-prospect engagement map
  interface EngData { score: number; label: string; hasClick: boolean; tourSteps: number; tourComplete: boolean; pricingViewed: boolean; returned: boolean }
  const prospectEngMap = new Map<string, EngData>()
  for (const pid of prospectIdsInQueue) {
    const clicks = prospectLinkClicks.filter(lc => lc.prospectId === pid)
    const allEvs = clicks.flatMap(lc => lc.events)
    const hasClick = clicks.some(lc => lc.clickCount > 0 && !lc.isBotSuspected)
    const pixelOpens = 0  // will look up per email below
    const score = computeEngagementScore(allEvs, pixelOpens, hasClick)
    prospectEngMap.set(pid, {
      score,
      label:        scoreLabel(score),
      hasClick,
      tourSteps:    allEvs.filter(e => !e.isBotSuspected && e.eventType === "tour_step_completed").length,
      tourComplete: allEvs.some(e => !e.isBotSuspected && e.eventType === "tour_completed"),
      pricingViewed:allEvs.some(e => !e.isBotSuspected && e.eventType === "pricing_viewed"),
      returned:     allEvs.some(e => !e.isBotSuspected && e.eventType === "returned_visit"),
    })
  }

  const enriched = emails.map(e => {
    // Stage = total sent emails to this contact - 1 (0-indexed).
    // Counting all sent emails per contactEmail (not just the current thread) gives
    // the correct stage for prospects emailed before stage tracking was introduced.
    const contactKey  = (e.contactEmail ?? "").toLowerCase()
    const totalSent   = contactSentCounts[contactKey] ?? null
    const sn          = totalSent !== null ? totalSent - 1 : (e.stageNumber ?? 0)
    const dueStageNum = sn + 1
    const sequenceComplete = dueStageNum > maxStageNum
    const hasReply       = e.threadId ? repliedThreadIds.has(e.threadId) : false
    const pid    = emailToProspectId[e.contactEmail?.toLowerCase() ?? ""] ?? null
    const eng    = pid ? (prospectEngMap.get(pid) ?? null) : null
    return {
      ...e,
      stageNumber:     sn,
      stageName:       stageMap[sn]    ?? `Stage ${sn}`,
      dueStageNumber:  dueStageNum,
      dueStageName:    sequenceComplete ? "Sequence Complete" : (stageMap[dueStageNum] ?? `Stage ${dueStageNum}`),
      sequenceComplete,
      hasReply,
      engagement: eng,
    }
  })

  return NextResponse.json({ emails: enriched, stages })
}
