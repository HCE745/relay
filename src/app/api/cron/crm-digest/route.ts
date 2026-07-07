import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const sevenDaysAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const sevenDaysOut  = new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000)

  // Auto-expire trials that ended > 14 days ago and are still "Trial Active"
  const expiredTrials = await prisma.organization.findMany({
    where: {
      lifecycleStatus: "Trial Active",
      trialEndsAt: { lt: now },
    },
    select: { id: true, name: true, lifecycleStatus: true },
  })

  for (const org of expiredTrials) {
    await prisma.organization.update({
      where: { id: org.id },
      data:  { lifecycleStatus: "Trial Expired" },
    })
    await prisma.crmActivity.create({
      data: {
        organizationId:  org.id,
        eventType:       "trial_expired_auto",
        description:     "Trial automatically marked as expired by cron",
        createdBySAName: "System",
      },
    })
  }

  // Auto-update "Trial Started" → "Trial Active" (if trialStartedAt > 0 days ago and trial not expired)
  const trialStarted = await prisma.organization.findMany({
    where: {
      lifecycleStatus: "Trial Started",
      trialEndsAt: { gt: now },
    },
    select: { id: true, name: true },
  })

  for (const org of trialStarted) {
    await prisma.organization.update({
      where: { id: org.id },
      data:  { lifecycleStatus: "Trial Active" },
    })
    await prisma.crmActivity.create({
      data: {
        organizationId:  org.id,
        eventType:       "trial_activated_auto",
        description:     "Trial automatically marked as active by cron",
        createdBySAName: "System",
      },
    })
  }

  // Gather digest data
  const [
    demosToday,
    overdueFollowUps,
    trialsExpiringSoon,
    unconvertedExpired,
    staleLeads,
    pipelineCounts,
  ] = await Promise.all([
    // Demos scheduled today
    prisma.demoCall.findMany({
      where: {
        callStatus:  "Scheduled",
        scheduledAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt:  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
      },
      include: { organization: { select: { name: true } } },
    }),
    // Overdue follow-ups
    prisma.demoCall.findMany({
      where: {
        followUpCompleted: false,
        followUpDate:      { lt: now },
      },
      include: { organization: { select: { name: true } } },
    }),
    // Trials expiring in 7 days
    prisma.organization.findMany({
      where: {
        lifecycleStatus: "Trial Active",
        trialEndsAt:     { gt: now, lt: sevenDaysOut },
      },
      select: { id: true, name: true, trialEndsAt: true },
    }),
    // Trial Expired with no conversion reason
    prisma.organization.findMany({
      where: {
        lifecycleStatus:  "Trial Expired",
        nonConversionReasons: { none: {} },
        updatedAt:        { gt: fourteenDaysAgo },
      },
      select: { id: true, name: true },
    }),
    // Leads with 14+ days inactivity
    prisma.organization.findMany({
      where: {
        lifecycleStatus: "Lead",
        updatedAt:       { lt: fourteenDaysAgo },
      },
      select: { id: true, name: true, updatedAt: true },
    }),
    // Pipeline stage counts
    prisma.organization.groupBy({
      by:     ["lifecycleStatus"],
      _count: { id: true },
    }),
  ])

  // Build digest email
  const pipelineHtml = pipelineCounts
    .map(r => `<li>${r.lifecycleStatus}: <b>${r._count.id}</b></li>`)
    .join("")

  const demosHtml = demosToday.length
    ? demosToday.map(d =>
        `<li>${d.contactName} (${d.contactEmail}) — ${d.companyName ?? d.organization?.name ?? "Unknown"} @ ${d.scheduledAt?.toISOString().slice(0,16) ?? "TBD"}</li>`
      ).join("")
    : "<li>None</li>"

  const overdueHtml = overdueFollowUps.length
    ? overdueFollowUps.map(d =>
        `<li>${d.contactName} (${d.contactEmail}) — due ${d.followUpDate?.toISOString().slice(0,10)}</li>`
      ).join("")
    : "<li>None</li>"

  const expiringHtml = trialsExpiringSoon.length
    ? trialsExpiringSoon.map(o =>
        `<li>${o.name} — expires ${o.trialEndsAt?.toISOString().slice(0,10)}</li>`
      ).join("")
    : "<li>None</li>"

  const unconvertedHtml = unconvertedExpired.length
    ? unconvertedExpired.map(o => `<li>${o.name}</li>`).join("")
    : "<li>None</li>"

  const staleHtml = staleLeads.length
    ? staleLeads.map(o =>
        `<li>${o.name} — last activity ${o.updatedAt.toISOString().slice(0,10)}</li>`
      ).join("")
    : "<li>None</li>"

  const html = `
    <h2>CRM Daily Digest — ${now.toISOString().slice(0,10)}</h2>

    <h3>Pipeline Overview</h3>
    <ul>${pipelineHtml}</ul>

    <h3>Demos Scheduled Today</h3>
    <ul>${demosHtml}</ul>

    <h3>Overdue Follow-ups</h3>
    <ul>${overdueHtml}</ul>

    <h3>Trials Expiring in 7 Days</h3>
    <ul>${expiringHtml}</ul>

    <h3>Expired Trials Without Conversion Reason</h3>
    <ul>${unconvertedHtml}</ul>

    <h3>Stale Leads (14+ Days Inactivity)</h3>
    <ul>${staleHtml}</ul>

    <p><a href="https://app.getrelay.software/super-admin/crm">Open CRM Dashboard →</a></p>
  `

  await sendEmail({
    to:      "will@getrelay.software",
    subject: `Relay CRM Digest — ${now.toISOString().slice(0,10)}`,
    html,
  })

  return NextResponse.json({
    ok: true,
    expired:   expiredTrials.length,
    activated: trialStarted.length,
  })
}
