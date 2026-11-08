import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Default inactivity threshold: 24 hours.
// Override via ONBOARDING_STALL_HOURS env var.
function stallHours(): number {
  const v = parseInt(process.env.ONBOARDING_STALL_HOURS ?? "24", 10)
  return isNaN(v) || v <= 0 ? 24 : v
}

// POST /api/cron/onboarding-stall
// Runs hourly. Finds registered customers whose onboarding is stalled and
// creates a CrmTask follow-up for their assigned sales rep.
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const thresholdMs = stallHours() * 60 * 60 * 1000
  const stallCutoff = new Date(now.getTime() - thresholdMs)
  // Don't create follow-ups for orgs registered more than 30 days ago to avoid spam
  const registrationWindow = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Find prospects linked to real orgs where onboarding is not yet complete
  // and onboarding activity has stalled.
  const stalledProspects = await prisma.prospect.findMany({
    where: {
      relayOrganizationId: { not: null },
      isTestRecord: false,
      onboardingStatus: { in: ["not_started", "in_progress"] },
      onboardingLastActivityAt: { lt: stallCutoff },
      registeredAt: { gte: registrationWindow, not: null },
    },
    select: {
      id: true,
      companyName: true,
      onboardingStatus: true,
      assignedToId: true,
      contacts: {
        where: { isPrimaryContact: true },
        select: { id: true, name: true },
        take: 1,
      },
    },
  })

  let created = 0
  let skipped = 0

  for (const prospect of stalledProspects) {
    if (!prospect.assignedToId) {
      skipped++
      continue
    }

    // Check for existing open onboarding follow-up task for this prospect
    const existing = await prisma.crmTask.findFirst({
      where: {
        prospectId: prospect.id,
        taskType: "onboarding_followup",
        completedAt: null,
      },
      select: { id: true },
    })

    if (existing) {
      skipped++
      continue
    }

    const statusLabel =
      prospect.onboardingStatus === "not_started"
        ? "onboarding not started"
        : "onboarding incomplete"

    const contactId = prospect.contacts[0]?.id ?? null
    const dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // due tomorrow

    await prisma.crmTask.create({
      data: {
        prospectId:   prospect.id,
        contactId:    contactId,
        assignedToId: prospect.assignedToId,
        title: `Follow up with ${prospect.companyName} — ${statusLabel}`,
        taskType: "onboarding_followup",
        priority: "high",
        dueAt,
        notes: `Automatically created: customer has not progressed through onboarding for over ${stallHours()} hours.`,
      },
    })

    // Record stall in prospect activity timeline
    await prisma.salesCrmActivity.create({
      data: {
        prospectId: prospect.id,
        activityType: "STATUS_CHANGED",
        subject: "Onboarding Stalled",
        notes: `No onboarding activity detected for over ${stallHours()} hours. Follow-up task created.`,
        occurredAt: now,
      },
    })

    // Update onboarding status to stalled
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { onboardingStatus: "stalled" },
    })

    created++
  }

  return NextResponse.json({
    processed: stalledProspects.length,
    tasksCreated: created,
    skipped,
  })
}
