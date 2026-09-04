import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Called daily. Calculates operational health scores for all eligible orgs.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY

  const orgs = await prisma.organization.findMany({
    where: {
      health_scores_enabled: true,
      isDemo: false,
      subscriptionStatus: { in: ["active", "trialing"] },
    },
    select: { id: true, name: true },
  })

  let calculated = 0

  for (const org of orgs) {
    try {
      await calculateHealthScore(org.id, org.name, "org", apiKey ?? null)
      calculated++
    } catch (err) {
      console.error(`Health score failed for org ${org.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, calculated })
}

export async function calculateHealthScore(
  orgId: string,
  orgName: string,
  scope: string,
  apiKey: string | null,
) {
  const now    = new Date()
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    openCount, totalRecent, escalated, injuries,
    resolvedRecent, criticalOpen,
  ] = await Promise.all([
    prisma.issue.count({ where: { organizationId: orgId, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: ago30d } } }),
    prisma.issue.count({ where: { organizationId: orgId, isEscalated: true, createdAt: { gte: ago30d } } }),
    prisma.injuryReport.count({ where: { organizationId: orgId, createdAt: { gte: ago30d } } }),
    prisma.issue.count({ where: { organizationId: orgId, resolvedAt: { gte: ago30d } } }),
    prisma.issue.count({ where: { organizationId: orgId, priority: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
  ])

  const resolutionData = await prisma.issue.findMany({
    where: { organizationId: orgId, resolvedAt: { gte: ago30d } },
    select: { createdAt: true, resolvedAt: true },
  })
  const avgResHours = resolutionData.length > 0
    ? resolutionData.reduce((s, i) => s + (i.resolvedAt!.getTime() - i.createdAt.getTime()) / 3600000, 0) / resolutionData.length
    : 0

  // Weighted score: start at 100
  let score = 100

  // Open issue volume (penalty if >20 open)
  score -= Math.min(20, Math.max(0, (openCount - 20) * 0.5))

  // Escalation rate
  const escalationRate = totalRecent > 0 ? (escalated / totalRecent) * 100 : 0
  score -= Math.min(20, escalationRate * 2)

  // Average resolution time (penalty after 24h avg)
  score -= Math.min(15, Math.max(0, (avgResHours - 24) * 0.3))

  // Critical issues
  score -= Math.min(15, criticalOpen * 3)

  // Injuries (significant penalty)
  score -= Math.min(20, injuries * 5)

  // Resolution rate bonus
  const resRate = totalRecent > 0 ? (resolvedRecent / totalRecent) * 100 : 50
  score += Math.min(10, (resRate - 50) * 0.2)

  score = Math.max(0, Math.min(100, Math.round(score)))

  // Get previous score for this scope
  const previous = await prisma.healthScore.findFirst({
    where: { organizationId: orgId, scope },
    orderBy: { calculatedAt: "desc" },
    select: { score: true },
  })

  const factors = [
    { factor: "Open Issues", impact: openCount > 30 ? "negative" : "positive", description: `${openCount} open issues` },
    { factor: "Escalation Rate", impact: escalationRate > 15 ? "negative" : "positive", description: `${escalationRate.toFixed(1)}% of recent issues escalated` },
    { factor: "Resolution Time", impact: avgResHours > 48 ? "negative" : "positive", description: `Avg ${avgResHours.toFixed(1)}h to resolve` },
    { factor: "Critical Issues", impact: criticalOpen > 2 ? "negative" : "positive", description: `${criticalOpen} critical issues open` },
    { factor: "Safety Record", impact: injuries > 2 ? "negative" : "positive", description: `${injuries} injuries in last 30 days` },
  ].slice(0, 3)

  let explanation = `Health score: ${score}/100 based on ${openCount} open issues, ${escalationRate.toFixed(1)}% escalation rate, and ${avgResHours.toFixed(1)}h avg resolution time.`

  if (apiKey && previous) {
    const change = score - previous.score
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          messages: [{
            role: "user",
            content: `Operational health score for ${orgName} changed from ${previous.score} to ${score} (${change >= 0 ? "+" : ""}${change}). Key metrics: ${openCount} open issues, ${escalationRate.toFixed(1)}% escalation rate, ${avgResHours.toFixed(1)}h avg resolution, ${injuries} injuries. In 2-3 sentences, explain why the score changed and the most important factor.`,
          }],
        }),
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) {
        const data = await res.json() as { content?: { text?: string }[] }
        explanation = data.content?.[0]?.text ?? explanation
      }
    } catch { /* use default explanation */ }
  }

  await prisma.healthScore.create({
    data: {
      organizationId: orgId,
      scope,
      score,
      previousScore: previous?.score ?? null,
      explanation,
      topFactors: factors,
    },
  })

  return { score, explanation }
}
