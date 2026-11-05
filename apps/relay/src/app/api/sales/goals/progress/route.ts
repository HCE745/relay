export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// GET /api/sales/goals/progress?goalIds=id1,id2,...
// Returns { actuals: { [goalId]: number } } — computed from live CRM records
export async function GET(req: NextRequest) {
  const s = await getSession()
  const session = s?.superAdmin || s?.salesUserId ? s : null
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const rawIds = searchParams.get("goalIds") ?? ""
  const goalIds = rawIds.split(",").map(s => s.trim()).filter(Boolean)
  if (goalIds.length === 0) return NextResponse.json({ actuals: {} })

  // Load all requested goals to get their date ranges, metrics, and optional userId filter
  const goals = await prisma.salesGoal.findMany({
    where: { id: { in: goalIds } },
    select: { id: true, metric: true, salesUserId: true, startDate: true, endDate: true },
  })

  if (goals.length === 0) return NextResponse.json({ actuals: {} })

  // For each goal compute the actual value
  // We group goals by (metric, salesUserId, startDate, endDate) to deduplicate queries where possible
  const actuals: Record<string, number> = {}

  await Promise.all(goals.map(async (goal) => {
    const start = new Date(goal.startDate)
    const end   = new Date(goal.endDate); end.setHours(23, 59, 59, 999)
    const uid   = goal.salesUserId ?? null

    let actual = 0

    switch (goal.metric) {
      case "emailsSent": {
        const count = await prisma.crmEmail.count({
          where: {
            direction: "sent",
            isDeleted: false,
            sentAt: { gte: start, lte: end },
            ...(uid ? { sentBySalesUserId: uid } : {}),
          },
        })
        actual = count
        break
      }

      case "prospectsAdded": {
        const count = await prisma.prospect.count({
          where: {
            createdAt: { gte: start, lte: end },
            ...(uid ? { assignedToId: uid } : {}),
          },
        })
        actual = count
        break
      }

      case "demosLogged": {
        // Use SalesDailyActivity rollup (most accurate — sums logged demo activity per day)
        const rows = await prisma.salesDailyActivity.aggregate({
          _sum: { demosLogged: true },
          where: {
            date: { gte: start, lte: end },
            ...(uid ? { salesUserId: uid } : {}),
          },
        })
        actual = rows._sum.demosLogged ?? 0
        break
      }

      case "opportunitiesCreated": {
        const count = await prisma.crmOpportunity.count({
          where: {
            createdAt: { gte: start, lte: end },
            ...(uid ? { assignedToId: uid } : {}),
          },
        })
        actual = count
        break
      }

      case "revenueWon": {
        const rows = await prisma.crmOpportunity.aggregate({
          _sum: { value: true },
          where: {
            stage: "Closed Won",
            wonAt: { gte: start, lte: end },
            ...(uid ? { assignedToId: uid } : {}),
          },
        })
        actual = Number(rows._sum.value ?? 0)
        break
      }

      case "dealsWon": {
        const count = await prisma.crmOpportunity.count({
          where: {
            stage: "Closed Won",
            wonAt: { gte: start, lte: end },
            ...(uid ? { assignedToId: uid } : {}),
          },
        })
        actual = count
        break
      }

      case "callsMade": {
        const count = await prisma.salesCrmActivity.count({
          where: {
            activityType: { in: ["CALL_ATTEMPTED", "CALL_CONNECTED"] },
            occurredAt: { gte: start, lte: end },
            ...(uid ? { salesUserId: uid } : {}),
          },
        })
        actual = count
        break
      }

      case "prospectsContacted": {
        const rows = await prisma.salesDailyActivity.aggregate({
          _sum: { prospectsContacted: true },
          where: {
            date: { gte: start, lte: end },
            ...(uid ? { salesUserId: uid } : {}),
          },
        })
        actual = rows._sum.prospectsContacted ?? 0
        break
      }

      default:
        actual = 0
    }

    actuals[goal.id] = actual
  }))

  return NextResponse.json({ actuals })
}
