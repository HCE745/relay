export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { getSalesSession } from "@/lib/sales-auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const info = await getSalesSession()
  if (!info) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!info.isManager && !info.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const [salesUsers, opportunities, tasks, emailsSent, pendingRequests] = await Promise.all([
    prisma.salesUser.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.crmOpportunity.findMany({
      select: { assignedToId: true, stage: true, value: true, wonAt: true, createdAt: true, updatedAt: true },
    }),
    prisma.crmTask.findMany({
      select: { assignedToId: true, completedAt: true, dueAt: true, createdAt: true },
    }),
    prisma.crmEmail.findMany({
      where:  { direction: "sent", sentBySalesUserId: { not: null }, sentAt: { gte: thirtyDaysAgo } },
      select: { sentBySalesUserId: true, sentAt: true },
    }),
    prisma.crmTransferRequest.findMany({
      where:   { status: "pending" },
      include: {
        requestedBy: { select: { id: true, name: true } },
        toUser:      { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const repStats = salesUsers.map(user => {
    const userOpps   = opportunities.filter(o => o.assignedToId === user.id)
    const userTasks  = tasks.filter(t => t.assignedToId === user.id)
    const userEmails = emailsSent.filter(e => e.sentBySalesUserId === user.id)

    const openOpps    = userOpps.filter(o => !["Closed Won", "Closed Lost"].includes(o.stage))
    const wonOpps30d  = userOpps.filter(o => o.wonAt && new Date(o.wonAt) >= thirtyDaysAgo)
    const pipelineVal = openOpps.reduce((sum, o) => sum + Number(o.value ?? 0), 0)

    const openTasks    = userTasks.filter(t => !t.completedAt)
    const overdueTasks = openTasks.filter(t => t.dueAt && new Date(t.dueAt) < now)

    const byStage: Record<string, number> = {}
    for (const o of userOpps) {
      byStage[o.stage] = (byStage[o.stage] ?? 0) + 1
    }

    return {
      userId:         user.id,
      name:           user.name,
      email:          user.email,
      role:           user.role,
      emailsSent30d:  userEmails.length,
      openOpps:       openOpps.length,
      wonOpps30d:     wonOpps30d.length,
      pipelineValue:  pipelineVal,
      openTasks:      openTasks.length,
      overdueTasks:   overdueTasks.length,
      oppsByStage:    byStage,
    }
  })

  const totalPipeline = opportunities
    .filter(o => !["Closed Won", "Closed Lost"].includes(o.stage))
    .reduce((sum, o) => sum + Number(o.value ?? 0), 0)

  const stageOrder = ["Qualified", "Demo", "Proposal", "Negotiating", "Closed Won", "Closed Lost"]
  const teamByStage: Record<string, number> = {}
  for (const o of opportunities) {
    teamByStage[o.stage] = (teamByStage[o.stage] ?? 0) + 1
  }

  return NextResponse.json({
    repStats,
    totalPipeline,
    teamByStage,
    stageOrder,
    pendingRequests,
  })
}
