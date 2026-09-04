import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin role required" }, { status: 403 })

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { health_scores_enabled: true, name: true },
  })
  if (!org?.health_scores_enabled) {
    return NextResponse.json({ error: "Health scores not enabled" }, { status: 403 })
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  try {
    const [
      openIssueCount,
      openCriticalCount,
      escalatedCount,
      injuryCount,
      resolvedInPeriod,
      totalInPeriod,
      repeatIssues,
    ] = await Promise.all([
      prisma.issue.count({ where: { organizationId: session.organizationId, status: "OPEN" } }),
      prisma.issue.count({
        where: {
          organizationId: session.organizationId,
          priority: "CRITICAL",
          status: { notIn: ["RESOLVED", "CLOSED"] },
        },
      }),
      prisma.issue.count({
        where: { organizationId: session.organizationId, isEscalated: true, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.injuryReport.count({
        where: { organizationId: session.organizationId, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.issue.findMany({
        where: {
          organizationId: session.organizationId,
          resolvedAt: { gte: thirtyDaysAgo },
          status: { in: ["RESOLVED", "CLOSED"] },
        },
        select: { createdAt: true, resolvedAt: true },
      }),
      prisma.issue.count({
        where: { organizationId: session.organizationId, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.issue.groupBy({
        by: ["title"],
        where: { organizationId: session.organizationId, createdAt: { gte: thirtyDaysAgo } },
        having: { title: { _count: { gt: 1 } } },
        _count: { id: true },
      }),
    ])

    // Average resolution hours
    const resolvedWithTimes = resolvedInPeriod.filter(i => i.resolvedAt)
    const avgResolutionHours = resolvedWithTimes.length > 0
      ? resolvedWithTimes.reduce((sum, i) => {
          const ms = new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()
          return sum + ms / 3600000
        }, 0) / resolvedWithTimes.length
      : 0

    const escalationRate = totalInPeriod > 0 ? (escalatedCount / totalInPeriod) * 100 : 0
    const repeatIssueCount = repeatIssues.length

    // --- Score calculation ---
    let score = 100
    const factors: { factor: string; impact: "positive" | "negative"; description: string }[] = []

    // Open issues deduction (max 20 points)
    if (openIssueCount > 50) {
      const deduct = Math.min(20, Math.floor(openIssueCount / 10))
      score -= deduct
      factors.push({ factor: "Open Issue Volume", impact: "negative", description: `${openIssueCount} open issues is above healthy threshold` })
    } else if (openIssueCount <= 10) {
      factors.push({ factor: "Open Issue Volume", impact: "positive", description: `Low open issue count (${openIssueCount}) indicates good resolution rate` })
    }

    // Critical issues (max 15 points)
    if (openCriticalCount > 0) {
      const deduct = Math.min(15, openCriticalCount * 5)
      score -= deduct
      factors.push({ factor: "Critical Issues", impact: "negative", description: `${openCriticalCount} unresolved critical issue${openCriticalCount !== 1 ? "s" : ""} require immediate attention` })
    }

    // Resolution time (max 15 points)
    if (avgResolutionHours > 72) {
      const deduct = Math.min(15, Math.floor((avgResolutionHours - 72) / 24) * 3)
      score -= deduct
      factors.push({ factor: "Resolution Time", impact: "negative", description: `Avg resolution time of ${avgResolutionHours.toFixed(1)}h exceeds 72h target` })
    } else if (avgResolutionHours > 0 && avgResolutionHours <= 24) {
      factors.push({ factor: "Resolution Time", impact: "positive", description: `Strong avg resolution time of ${avgResolutionHours.toFixed(1)}h` })
    }

    // Escalation rate (max 15 points)
    if (escalationRate > 10) {
      const deduct = Math.min(15, Math.floor(escalationRate / 5) * 3)
      score -= deduct
      factors.push({ factor: "Escalation Rate", impact: "negative", description: `${escalationRate.toFixed(1)}% escalation rate is above acceptable threshold` })
    } else if (escalationRate <= 2 && totalInPeriod > 0) {
      factors.push({ factor: "Escalation Rate", impact: "positive", description: `Low escalation rate of ${escalationRate.toFixed(1)}%` })
    }

    // Injuries (max 20 points)
    if (injuryCount > 0) {
      const deduct = Math.min(20, injuryCount * 5)
      score -= deduct
      factors.push({ factor: "Safety Incidents", impact: "negative", description: `${injuryCount} injury report${injuryCount !== 1 ? "s" : ""} in the last 30 days` })
    } else {
      factors.push({ factor: "Safety Record", impact: "positive", description: "No injury reports in the last 30 days" })
    }

    // Repeat issues (max 10 points)
    if (repeatIssueCount > 5) {
      const deduct = Math.min(10, Math.floor(repeatIssueCount / 2))
      score -= deduct
      factors.push({ factor: "Recurring Issues", impact: "negative", description: `${repeatIssueCount} recurring issue patterns detected` })
    }

    score = Math.max(0, Math.min(100, score))

    // Get previous score for comparison
    const previous = await prisma.healthScore.findFirst({
      where: { organizationId: session.organizationId, scope: "org" },
      orderBy: { calculatedAt: "desc" },
    })

    // AI explanation
    let explanation: string | null = null
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey) {
      try {
        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 400,
            system: "You are an operational health analyst. Generate a brief 2-3 sentence explanation of an organization's operational health score. Be specific and actionable.",
            messages: [
              {
                role: "user",
                content: `Org health score: ${score}/100 (previous: ${previous?.score ?? "N/A"}).
Key metrics: ${openIssueCount} open issues, ${openCriticalCount} critical, avg resolution ${avgResolutionHours.toFixed(1)}h, ${escalationRate.toFixed(1)}% escalation rate, ${injuryCount} injuries in 30d, ${repeatIssueCount} repeat patterns.
Top factors: ${factors.slice(0, 3).map(f => `${f.factor} (${f.impact}): ${f.description}`).join("; ")}.
Write a 2-3 sentence executive summary of the health score.`,
              },
            ],
          }),
        })
        if (aiRes.ok) {
          const aiData = await aiRes.json()
          explanation = aiData.content?.[0]?.text ?? null
        }
      } catch {
        // Non-critical — continue without AI explanation
      }
    }

    // Store the score
    const healthScore = await prisma.healthScore.create({
      data: {
        organizationId: session.organizationId,
        scope: "org",
        score,
        previousScore: previous?.score ?? null,
        explanation,
        topFactors: factors.slice(0, 3),
        calculatedAt: now,
      },
    })

    return NextResponse.json(healthScore, { status: 201 })
  } catch (err) {
    console.error("[Health Score] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
