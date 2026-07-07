import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const goal = await prisma.executiveGoal.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 })

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const orgId = session.organizationId

  let currentValue = 0

  try {
    switch (goal.metricType) {
      case "injury_reduction": {
        // Compare injury reports this period vs baseline (prev period)
        const [currentInjuries, baselineInjuries] = await Promise.all([
          prisma.injuryReport.count({ where: { organizationId: orgId, createdAt: { gte: thirtyDaysAgo } } }),
          prisma.injuryReport.count({ where: { organizationId: orgId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
        ])
        // currentValue = reduction percentage (positive = improvement)
        if (baselineInjuries > 0) {
          currentValue = ((baselineInjuries - currentInjuries) / baselineInjuries) * 100
        } else if (currentInjuries === 0) {
          currentValue = 100 // perfect record, full reduction
        } else {
          currentValue = 0
        }
        break
      }

      case "resolution_time": {
        // Avg resolution hours for closed issues in last 30d
        const resolved = await prisma.issue.findMany({
          where: {
            organizationId: orgId,
            resolvedAt: { gte: thirtyDaysAgo },
            status: { in: ["RESOLVED", "CLOSED"] },
          },
          select: { createdAt: true, resolvedAt: true },
        })
        const withTimes = resolved.filter(i => i.resolvedAt)
        currentValue = withTimes.length > 0
          ? withTimes.reduce((sum, i) => {
              const ms = new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()
              return sum + ms / 3600000
            }, 0) / withTimes.length
          : 0
        break
      }

      case "escalation_rate": {
        const [escalated, total] = await Promise.all([
          prisma.issue.count({ where: { organizationId: orgId, isEscalated: true, createdAt: { gte: thirtyDaysAgo } } }),
          prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: thirtyDaysAgo } } }),
        ])
        currentValue = total > 0 ? (escalated / total) * 100 : 0
        break
      }

      case "response_time": {
        // Avg time from created to in_progress in hours
        const inProgressIssues = await prisma.issue.findMany({
          where: {
            organizationId: orgId,
            status: { in: ["IN_PROGRESS", "RESOLVED", "CLOSED"] },
            createdAt: { gte: thirtyDaysAgo },
          },
          select: { createdAt: true, updatedAt: true },
        })
        // Approximate: use updatedAt as proxy for when moved to in_progress
        const eligible = inProgressIssues.filter(i => i.updatedAt > i.createdAt)
        currentValue = eligible.length > 0
          ? eligible.reduce((sum, i) => {
              const ms = new Date(i.updatedAt).getTime() - new Date(i.createdAt).getTime()
              return sum + ms / 3600000
            }, 0) / eligible.length
          : 0
        break
      }

      case "open_issue_volume": {
        currentValue = await prisma.issue.count({
          where: { organizationId: orgId, status: "OPEN" },
        })
        break
      }

      case "recurring_failures": {
        // Count of assets with 3+ issues in 30d
        const assetGroups = await prisma.issue.groupBy({
          by: ["assetId"],
          where: { organizationId: orgId, createdAt: { gte: thirtyDaysAgo }, assetId: { not: null } },
          _count: { id: true },
          having: { assetId: { _count: { gte: 3 } } },
        })
        currentValue = assetGroups.length
        break
      }

      default:
        currentValue = goal.currentValue
    }

    // Round to 2 decimal places
    currentValue = Math.round(currentValue * 100) / 100

    // Calculate if at risk
    // At risk = current progress vs expected trajectory
    const targetDate = new Date(goal.targetDate)
    const goalStart = new Date(goal.createdAt)
    const totalDays = Math.max(1, (targetDate.getTime() - goalStart.getTime()) / (1000 * 60 * 60 * 24))
    const daysElapsed = Math.max(0, (now.getTime() - goalStart.getTime()) / (1000 * 60 * 60 * 24))
    const daysRemaining = Math.max(0, (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const progressPct = goal.targetValue > 0 ? (currentValue / goal.targetValue) * 100 : 0
    const expectedProgressPct = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0

    // At risk if significantly behind expected trajectory and deadline is close or passed
    const isAtRisk = (progressPct < expectedProgressPct * 0.7) && (daysRemaining < totalDays * 0.5)

    // Determine status
    let status = goal.status
    if (goal.targetValue > 0) {
      const achieved = (() => {
        // For metrics where lower is better (resolution_time, escalation_rate, recurring_failures, open_issue_volume, response_time)
        const lowerIsBetter = ["resolution_time", "escalation_rate", "recurring_failures", "open_issue_volume", "response_time"]
        if (lowerIsBetter.includes(goal.metricType)) {
          return currentValue <= goal.targetValue
        }
        // For metrics where higher is better (injury_reduction)
        return currentValue >= goal.targetValue
      })()

      if (achieved) {
        status = "ACHIEVED"
      } else if (daysRemaining <= 0) {
        status = "MISSED"
      } else if (isAtRisk) {
        status = "AT_RISK"
      } else {
        status = "ACTIVE"
      }
    }

    // Update goal
    const updatedGoal = await prisma.executiveGoal.update({
      where: { id },
      data: { currentValue, isAtRisk, status },
      include: { progress: { orderBy: { calculatedAt: "desc" }, take: 10 } },
    })

    // Create GoalProgress snapshot
    await prisma.goalProgress.create({
      data: { goalId: id, value: currentValue, calculatedAt: now },
    })

    return NextResponse.json(updatedGoal)
  } catch (err) {
    console.error("[Goal Calculate] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
