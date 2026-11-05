export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// GET /api/sales/workspace — returns today's action items for the logged-in rep
export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.salesUserId ?? ""
  const isManager = session.superAdmin || session.salesUserRole === "admin_sales"
  const repFilter = isManager ? {} : { assignedToId: userId }

  const now      = new Date()
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)

  const [
    overdueTasks,
    tasksDueToday,
    unreadEmails,
    stuckOpportunities,
    upcomingDemos,
    followUpsDue,
  ] = await Promise.all([
    // Overdue tasks
    prisma.crmTask.findMany({
      where: { ...repFilter, completedAt: null, dueAt: { lt: todayStart } },
      include: {
        prospect:    { select: { id: true, companyName: true } },
        demoCall:    { select: { id: true, companyName: true } },
        opportunity: { select: { id: true, title: true } },
        contact:     { select: { id: true, name: true } },
      },
      orderBy: { dueAt: "asc" },
      take: 20,
    }),

    // Tasks due today
    prisma.crmTask.findMany({
      where: { ...repFilter, completedAt: null, dueAt: { gte: todayStart, lte: todayEnd } },
      include: {
        prospect:    { select: { id: true, companyName: true } },
        demoCall:    { select: { id: true, companyName: true } },
        opportunity: { select: { id: true, title: true } },
        contact:     { select: { id: true, name: true } },
      },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 20,
    }),

    // Unread received emails (last 7 days)
    prisma.crmEmail.findMany({
      where: {
        direction: "received",
        isRead:    false,
        isDeleted: false,
        isArchived: false,
        sentAt:    { gte: new Date(Date.now() - 7 * 86400_000) },
        ...(isManager ? {} : { sentBySalesUserId: userId }),
      },
      select: {
        id: true, subject: true, fromAddress: true, sentAt: true, contactEmail: true,
        demoCall:  { select: { id: true, companyName: true } },
        prospect:  { select: { id: true, companyName: true } },
      },
      orderBy: { sentAt: "desc" },
      take: 20,
    }),

    // Opportunities with no activity in 14+ days (not closed)
    prisma.crmOpportunity.findMany({
      where: {
        ...repFilter,
        stage:     { notIn: ["Closed Won", "Closed Lost"] },
        updatedAt: { lt: new Date(Date.now() - 14 * 86400_000) },
      },
      include: {
        prospect: { select: { id: true, companyName: true } },
        demoCall: { select: { id: true, companyName: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 10,
    }),

    // Upcoming demo calls (next 7 days)
    prisma.demoCall.findMany({
      where: {
        ...repFilter,
        scheduledAt: { gte: now, lte: new Date(Date.now() + 7 * 86400_000) },
        callStatus:  { notIn: ["Completed", "No-Show", "Cancelled"] },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }),

    // Email follow-ups overdue
    prisma.crmEmail.findMany({
      where: {
        followUpDate: { lt: now },
        followUpDoneAt: null,
        isDeleted: false,
        ...(isManager ? {} : { sentBySalesUserId: userId }),
      },
      select: {
        id: true, subject: true, followUpDate: true, contactEmail: true,
        demoCall: { select: { id: true, companyName: true } },
        prospect: { select: { id: true, companyName: true } },
      },
      orderBy: { followUpDate: "asc" },
      take: 20,
    }),
  ])

  return NextResponse.json({
    overdueTasks,
    tasksDueToday,
    unreadEmails,
    stuckOpportunities,
    upcomingDemos,
    followUpsDue,
  })
}
