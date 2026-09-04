import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// Rich include for follow-up cards
const followUpInclude = {
  enrollment: {
    include: {
      sequence: { select: { id: true, name: true } },
      demoCall: {
        select: {
          id: true, contactName: true, contactEmail: true, companyName: true,
          industry: true, callStatus: true, contactRole: true,
          painPoints: true, callNotes: true, outcome: true,
          organization: { select: { id: true, name: true, lifecycleStatus: true } },
        },
      },
    },
  },
} as const

export async function GET() {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now      = new Date()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [
    dueToday,
    overdue,
    upcoming,
    draftedForReview,
    scheduledToSend,
    waitingEnrollments,
    pausedEnrollments,
    completedEnrollments,
  ] = await Promise.all([
    // Due today (pending, scheduled for today)
    prisma.crmFollowUp.findMany({
      where: {
        status:       "pending",
        scheduledFor: { gte: todayStart, lt: todayEnd },
        enrollment:   { status: "active" },
      },
      include:  followUpInclude,
      orderBy:  { scheduledFor: "asc" },
    }),

    // Overdue (pending, scheduled before today)
    prisma.crmFollowUp.findMany({
      where: {
        status:       "pending",
        scheduledFor: { lt: todayStart },
        enrollment:   { status: "active" },
      },
      include:  followUpInclude,
      orderBy:  { scheduledFor: "asc" },
    }),

    // Upcoming (pending, scheduled after today)
    prisma.crmFollowUp.findMany({
      where: {
        status:       "pending",
        scheduledFor: { gte: todayEnd },
        enrollment:   { status: "active" },
      },
      include:  followUpInclude,
      orderBy:  { scheduledFor: "asc" },
      take:     50,
    }),

    // Drafted for review
    prisma.crmFollowUp.findMany({
      where: {
        status:     "draft_generated",
        enrollment: { status: "active" },
      },
      include:  followUpInclude,
      orderBy:  { scheduledFor: "asc" },
    }),

    // Approved, waiting to send (auto-send queue)
    prisma.crmFollowUp.findMany({
      where: {
        status:     "approved",
        enrollment: { status: "active" },
      },
      include:  followUpInclude,
      orderBy:  { scheduledFor: "asc" },
    }),

    // Waiting for reply: active enrollments with last step sent, no pending follow-up
    prisma.crmEmailSequenceEnrollment.findMany({
      where: {
        status:   "active",
        followUps: {
          none: { status: { in: ["pending", "draft_generated", "approved"] } },
        },
      },
      include: {
        sequence: { select: { id: true, name: true } },
        demoCall: {
          select: {
            id: true, contactName: true, contactEmail: true, companyName: true,
            contactRole: true, callStatus: true,
            organization: { select: { id: true, name: true, lifecycleStatus: true } },
          },
        },
        followUps: {
          where:   { status: "sent" },
          orderBy: { sentAt: "desc" },
          take:    1,
        },
      },
      orderBy: { lastContactAt: "asc" },
      take:    100,
    }),

    // Paused enrollments
    prisma.crmEmailSequenceEnrollment.findMany({
      where: { status: "paused" },
      include: {
        sequence: { select: { id: true, name: true } },
        demoCall: {
          select: {
            id: true, contactName: true, contactEmail: true, companyName: true,
            contactRole: true, callStatus: true,
            organization: { select: { id: true, name: true, lifecycleStatus: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take:    50,
    }),

    // Completed/stopped in last 30 days
    prisma.crmEmailSequenceEnrollment.findMany({
      where: {
        status:   { in: ["completed", "stopped"] },
        stoppedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
      include: {
        sequence: { select: { id: true, name: true } },
        demoCall: {
          select: {
            id: true, contactName: true, contactEmail: true, companyName: true,
            organization: { select: { id: true, lifecycleStatus: true } },
          },
        },
      },
      orderBy: { stoppedAt: "desc" },
      take:    30,
    }),
  ])

  // Summary counts for the dashboard widget
  const summary = {
    dueToday:         dueToday.length,
    overdue:          overdue.length,
    draftedForReview: draftedForReview.length,
    waitingForReply:  waitingEnrollments.length,
    scheduledToSend:  scheduledToSend.length,
    paused:           pausedEnrollments.length,
  }

  return NextResponse.json({
    summary,
    dueToday,
    overdue,
    upcoming,
    draftedForReview,
    scheduledToSend,
    waitingForReply:  waitingEnrollments,
    paused:           pausedEnrollments,
    completed:        completedEnrollments,
  })
}
