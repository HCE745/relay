export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const groupBy  = searchParams.get("groupBy") ?? "sequence"
  const period   = searchParams.get("period")  ?? "30d"
  const isManager = !!session.superAdmin || session.salesUserRole === "admin_sales"

  const days    = parseInt(period.replace("d", "")) || 30
  const since   = new Date(Date.now() - days * 86400_000)

  // ── Funnel: Prospects Contacted → Replied → Demo Booked → Trial → Closed Won ─

  // Total prospects
  const totalProspects = await prisma.prospect.count()

  // Contacted (at least 1 sent email)
  const contactedProspects = await prisma.demoCall.count({
    where: {
      createdAt: { gte: since },
      crmEmails: { some: { direction: "sent" } },
    },
  })

  // Replied (at least 1 received email after a sent)
  const replied = await prisma.demoCall.count({
    where: {
      crmEmails: { some: { direction: "received" } },
    },
  })

  // Demo booked (call status demo_scheduled or later)
  const demoBooked = await prisma.demoCall.count({
    where: {
      callStatus: { in: ["Demo Scheduled", "Demo Completed", "Trial", "Won", "Closed Lost"] },
      createdAt: { gte: since },
    },
  })

  // Trial
  const trials = await prisma.demoCall.count({
    where: {
      callStatus: { in: ["Trial", "Won"] },
    },
  })

  // Closed Won
  const closedWon = await prisma.crmOpportunity.count({
    where: { stage: "Closed Won" },
  })

  const funnel = [
    { stage: "Prospects Contacted", count: contactedProspects, convRate: null },
    { stage: "Replied",     count: replied,      convRate: contactedProspects > 0 ? Math.round((replied / contactedProspects) * 100) : 0 },
    { stage: "Demo Booked", count: demoBooked,   convRate: replied > 0 ? Math.round((demoBooked / replied) * 100) : 0 },
    { stage: "Trial",       count: trials,        convRate: demoBooked > 0 ? Math.round((trials / demoBooked) * 100) : 0 },
    { stage: "Closed Won",  count: closedWon,     convRate: trials > 0 ? Math.round((closedWon / trials) * 100) : 0 },
  ]

  // ── Sequence performance ──────────────────────────────────────────────────────
  const sequences = await prisma.crmSequence.findMany({
    include: {
      enrollments: {
        include: {
          demoCall: {
            include: {
              crmEmails: { where: { direction: "sent" } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  const sequenceStats = sequences.map(seq => {
    const enrolled   = seq.enrollments.length
    const emailsSent = seq.enrollments.reduce((s, e) => s + (e.demoCall?.crmEmails.length ?? 0), 0)
    return {
      id:         seq.id,
      name:       seq.name,
      enrolled,
      emailsSent,
    }
  })

  // ── Time to Demo / Demo to Close ─────────────────────────────────────────────
  const wonOpps = await prisma.crmOpportunity.findMany({
    where: { stage: "Closed Won", wonAt: { not: null } },
    select: { wonAt: true, createdAt: true },
    take: 100,
  })

  const avgDaysToClose = wonOpps.length > 0
    ? Math.round(
        wonOpps.reduce((s, o) => s + (o.wonAt!.getTime() - o.createdAt.getTime()) / 86400_000, 0) / wonOpps.length
      )
    : null

  // ── Template performance ──────────────────────────────────────────────────────
  const templates = await prisma.crmEmailTemplate.findMany({
    select: { id: true, name: true },
  })

  // ── A/B test summary ──────────────────────────────────────────────────────────
  const abCampaigns = await prisma.abTestCampaign.findMany({
    include: { results: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  // ── Rep performance (manager only) ────────────────────────────────────────────
  let repStats: Array<{ id: string; name: string; emailsSent: number; demos: number; won: number }> | null = null
  if (isManager) {
    const reps = await prisma.salesUser.findMany({
      where: { isActive: true },
      select: {
        id:   true,
        name: true,
        sentEmails:  { select: { id: true }, where: { direction: "sent" } },
        opportunities: {
          select: { stage: true },
          where:  { assignedToId: { not: "" } },
        },
      },
    })
    repStats = reps.map(r => ({
      id:         r.id,
      name:       r.name,
      emailsSent: r.sentEmails.length,
      demos:      r.opportunities.filter(o => !["Closed Won", "Closed Lost"].includes(o.stage)).length,
      won:        r.opportunities.filter(o => o.stage === "Closed Won").length,
    }))
  }

  return NextResponse.json({
    funnel,
    sequenceStats,
    avgDaysToClose,
    templates,
    abCampaigns,
    repStats,
    period,
    totalProspects,
  })
}
