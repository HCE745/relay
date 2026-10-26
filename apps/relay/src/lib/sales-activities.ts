import { prisma } from "@/lib/prisma"

interface CreateActivityInput {
  prospectId?:      string | null
  demoCallId?:      string | null
  opportunityId?:   string | null
  salesUserId?:     string | null
  activityType:     string
  subject?:         string | null
  notes?:           string | null
  outcome?:         string | null
  durationMinutes?: number | null
  metadata?:        Record<string, unknown> | null
  occurredAt?:      Date
}

export async function createSalesActivity(input: CreateActivityInput) {
  const activity = await prisma.salesCrmActivity.create({
    data: {
      prospectId:      input.prospectId      ?? null,
      demoCallId:      input.demoCallId      ?? null,
      opportunityId:   input.opportunityId   ?? null,
      salesUserId:     input.salesUserId     ?? null,
      activityType:    input.activityType,
      subject:         input.subject         ?? null,
      notes:           input.notes           ?? null,
      outcome:         input.outcome         ?? null,
      durationMinutes: input.durationMinutes ?? null,
      metadata:        input.metadata ? (input.metadata as never) : undefined,
      occurredAt:      input.occurredAt      ?? new Date(),
    },
  })

  // Auto-generate tasks (Feature 3)
  await maybeCreateAutoTask(activity, input)

  return activity
}

async function maybeCreateAutoTask(
  activity: { id: string; activityType: string; prospectId: string | null; demoCallId: string | null; salesUserId: string | null },
  input: CreateActivityInput,
) {
  const assignedToId = input.salesUserId
  if (!assignedToId) return

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000)

  // Helper: check for existing task
  async function hasDuplicateTask(titleFragment: string) {
    const existing = await prisma.crmTask.findFirst({
      where: {
        assignedToId: assignedToId ?? undefined,
        completedAt: null,
        createdAt:   { gte: sevenDaysAgo },
        title:       { contains: titleFragment, mode: "insensitive" },
        ...(input.prospectId  ? { prospectId:  input.prospectId  } : {}),
        ...(input.demoCallId  ? { demoCallId:  input.demoCallId  } : {}),
      },
    })
    return !!existing
  }

  // Get prospect/demo call info for task titles
  async function getProspectInfo() {
    if (input.prospectId) {
      const p = await prisma.prospect.findUnique({
        where: { id: input.prospectId },
        select: { companyName: true, contacts: { select: { name: true }, take: 1 } },
      })
      return { name: p?.contacts[0]?.name ?? "contact", company: p?.companyName ?? "company" }
    }
    if (input.demoCallId) {
      const d = await prisma.demoCall.findUnique({
        where: { id: input.demoCallId },
        select: { contactName: true, companyName: true },
      })
      return { name: d?.contactName ?? "contact", company: d?.companyName ?? "company" }
    }
    return null
  }

  function addBusinessDays(days: number): Date {
    const date = new Date()
    let added = 0
    while (added < days) {
      date.setDate(date.getDate() + 1)
      const dow = date.getDay()
      if (dow !== 0 && dow !== 6) added++
    }
    return date
  }

  function tomorrow(): Date {
    return new Date(Date.now() + 86400_000)
  }

  try {
    if (activity.activityType === "EMAIL_SENT") {
      // First contact follow-up: check no prior activities for this prospect
      const priorCount = await prisma.salesCrmActivity.count({
        where: {
          activityType: "EMAIL_SENT",
          ...(input.prospectId ? { prospectId: input.prospectId } : { demoCallId: input.demoCallId }),
          id: { not: activity.id },
        },
      })
      if (priorCount === 0) {
        const info = await getProspectInfo()
        if (info && !await hasDuplicateTask("Follow up with")) {
          await prisma.crmTask.create({
            data: {
              title:       `Follow up with ${info.name} at ${info.company}`,
              taskType:    "email",
              assignedToId,
              prospectId:  input.prospectId  ?? null,
              demoCallId:  input.demoCallId  ?? null,
              dueAt:       addBusinessDays(3),
              priority:    "normal",
            },
          })
        }
      }
    } else if (activity.activityType === "EMAIL_RECEIVED") {
      const info = await getProspectInfo()
      if (info && !await hasDuplicateTask("Reply to")) {
        await prisma.crmTask.create({
          data: {
            title:       `Reply to ${info.name} at ${info.company}`,
            taskType:    "email",
            assignedToId,
            prospectId:  input.prospectId  ?? null,
            demoCallId:  input.demoCallId  ?? null,
            dueAt:       new Date(),
            priority:    "high",
          },
        })
      }
    } else if (activity.activityType === "TOUR_VIEWED") {
      const info = await getProspectInfo()
      if (info && !await hasDuplicateTask("Call ")) {
        await prisma.crmTask.create({
          data: {
            title:       `Call ${info.name} at ${info.company} — completed tour`,
            taskType:    "call",
            assignedToId,
            prospectId:  input.prospectId  ?? null,
            demoCallId:  input.demoCallId  ?? null,
            dueAt:       new Date(),
            priority:    "high",
          },
        })
      }
    } else if (activity.activityType === "PRICING_VIEWED") {
      const info = await getProspectInfo()
      if (info && !await hasDuplicateTask("Follow up on pricing")) {
        await prisma.crmTask.create({
          data: {
            title:       `Follow up on pricing interest with ${info.name}`,
            taskType:    "email",
            assignedToId,
            prospectId:  input.prospectId  ?? null,
            demoCallId:  input.demoCallId  ?? null,
            dueAt:       tomorrow(),
            priority:    "high",
          },
        })
      }
    } else if (activity.activityType === "MEETING_HELD") {
      const info = await getProspectInfo()
      if (info && !await hasDuplicateTask("Send follow-up email after demo")) {
        await prisma.crmTask.create({
          data: {
            title:       `Send follow-up email after demo with ${info.company}`,
            taskType:    "email",
            assignedToId,
            prospectId:  input.prospectId  ?? null,
            demoCallId:  input.demoCallId  ?? null,
            dueAt:       tomorrow(),
            priority:    "high",
          },
        })
      }
    }
  } catch (err) {
    console.error("[sales-activities] auto-task creation failed:", err)
  }
}
