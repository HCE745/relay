import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

type TrendCandidate = {
  trendType: string
  title: string
  description: string
  severity: "HIGH" | "MEDIUM" | "LOW"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supportingData: any
  dedupeKey: string
}

async function getAIRecommendation(trend: TrendCandidate): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 250,
        system: "You are an operational analyst. Generate a specific, actionable 1-2 sentence recommendation for the given operational trend. Be direct and practical.",
        messages: [
          {
            role: "user",
            content: `Trend: ${trend.title}\nDescription: ${trend.description}\nSeverity: ${trend.severity}\nData: ${JSON.stringify(trend.supportingData)}\n\nProvide a specific 1-2 sentence recommendation.`,
          },
        ],
      }),
    })
    if (res.ok) {
      const data = await res.json()
      return data.content?.[0]?.text ?? null
    }
  } catch {
    // Non-critical
  }
  return null
}

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin role required" }, { status: 403 })

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { trend_detection_enabled: true },
  })
  if (!org?.trend_detection_enabled) {
    return NextResponse.json({ error: "Trend detection not enabled" }, { status: 403 })
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const orgId = session.organizationId

  try {
    // Fetch current and previous period data in parallel
    const [
      currentTotal,
      previousTotal,
      currentByCategory,
      previousByCategory,
      currentResolved,
      previousResolved,
      assetIssueCounts,
    ] = await Promise.all([
      // Total issue volumes
      prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      // Issues by category (current period)
      prisma.issue.groupBy({
        by: ["category"],
        where: { organizationId: orgId, createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
      }),
      // Issues by category (previous period)
      prisma.issue.groupBy({
        by: ["category"],
        where: { organizationId: orgId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
        _count: { id: true },
      }),
      // Resolution times current period
      prisma.issue.findMany({
        where: { organizationId: orgId, resolvedAt: { gte: thirtyDaysAgo }, status: { in: ["RESOLVED", "CLOSED"] } },
        select: { createdAt: true, resolvedAt: true },
      }),
      // Resolution times previous period
      prisma.issue.findMany({
        where: {
          organizationId: orgId,
          resolvedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          status: { in: ["RESOLVED", "CLOSED"] },
        },
        select: { createdAt: true, resolvedAt: true },
      }),
      // Asset repeat issues
      prisma.issue.groupBy({
        by: ["assetId"],
        where: { organizationId: orgId, createdAt: { gte: thirtyDaysAgo }, assetId: { not: null } },
        _count: { id: true },
        having: { assetId: { _count: { gte: 3 } } },
      }),
    ])

    const candidates: TrendCandidate[] = []

    // 1. Volume spike/drop
    if (previousTotal > 0) {
      const changePct = ((currentTotal - previousTotal) / previousTotal) * 100
      if (changePct > 20) {
        candidates.push({
          trendType: "VOLUME_SPIKE",
          title: `Issue Volume Up ${changePct.toFixed(0)}%`,
          description: `Issue volume increased from ${previousTotal} to ${currentTotal} compared to the prior 30-day period.`,
          severity: changePct > 50 ? "HIGH" : "MEDIUM",
          supportingData: { current: currentTotal, previous: previousTotal, changePct },
          dedupeKey: "VOLUME_SPIKE",
        })
      } else if (changePct < -20) {
        candidates.push({
          trendType: "VOLUME_DROP",
          title: `Issue Volume Down ${Math.abs(changePct).toFixed(0)}%`,
          description: `Issue volume decreased from ${previousTotal} to ${currentTotal} compared to the prior 30-day period.`,
          severity: "LOW",
          supportingData: { current: currentTotal, previous: previousTotal, changePct },
          dedupeKey: "VOLUME_DROP",
        })
      }
    }

    // 2. Category trends
    const prevCatMap = Object.fromEntries(previousByCategory.map(c => [c.category, c._count.id]))
    for (const cat of currentByCategory) {
      const prev = prevCatMap[cat.category] ?? 0
      if (prev === 0 && cat._count.id >= 3) {
        candidates.push({
          trendType: "CATEGORY_TREND",
          title: `New ${cat.category.replace(/_/g, " ")} Issues Emerging`,
          description: `${cat._count.id} ${cat.category.replace(/_/g, " ").toLowerCase()} issues reported this period (none in previous period).`,
          severity: "MEDIUM",
          supportingData: { category: cat.category, current: cat._count.id, previous: prev },
          dedupeKey: `CATEGORY_TREND:${cat.category}`,
        })
      } else if (prev > 0) {
        const pct = ((cat._count.id - prev) / prev) * 100
        if (pct > 30) {
          // 3. Safety-specific check
          const isSafety = cat.category === "INJURY" || cat.category === "SAFETY"
          if (isSafety && pct > 15) {
            candidates.push({
              trendType: "SAFETY_INCREASE",
              title: `Safety Incidents Up ${pct.toFixed(0)}%`,
              description: `${cat.category.replace(/_/g, " ")} reports increased from ${prev} to ${cat._count.id} this period.`,
              severity: "HIGH",
              supportingData: { category: cat.category, current: cat._count.id, previous: prev, changePct: pct },
              dedupeKey: `SAFETY_INCREASE:${cat.category}`,
            })
          } else if (!isSafety) {
            candidates.push({
              trendType: "CATEGORY_TREND",
              title: `${cat.category.replace(/_/g, " ")} Issues Up ${pct.toFixed(0)}%`,
              description: `${cat.category.replace(/_/g, " ").toLowerCase()} issues increased from ${prev} to ${cat._count.id}.`,
              severity: pct > 60 ? "HIGH" : "MEDIUM",
              supportingData: { category: cat.category, current: cat._count.id, previous: prev, changePct: pct },
              dedupeKey: `CATEGORY_TREND:${cat.category}`,
            })
          }
        }
      }
    }

    // 4. Recurring assets
    if (assetIssueCounts.length > 0) {
      const assetIds = assetIssueCounts.map(a => a.assetId).filter(Boolean) as string[]
      const assets = await prisma.asset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, name: true },
      })
      const assetMap = Object.fromEntries(assets.map(a => [a.id, a.name]))
      for (const a of assetIssueCounts) {
        const name = assetMap[a.assetId!] ?? a.assetId!
        candidates.push({
          trendType: "RECURRING_ASSET",
          title: `Recurring Failures: ${name}`,
          description: `Asset "${name}" has ${a._count.id} issues in the last 30 days, indicating a recurring problem.`,
          severity: a._count.id >= 5 ? "HIGH" : "MEDIUM",
          supportingData: { assetId: a.assetId, assetName: name, count: a._count.id },
          dedupeKey: `RECURRING_ASSET:${a.assetId}`,
        })
      }
    }

    // 5. Resolution time increase
    const calcAvgHours = (issues: { createdAt: Date; resolvedAt: Date | null }[]) => {
      const filtered = issues.filter(i => i.resolvedAt)
      if (filtered.length === 0) return null
      return filtered.reduce((sum, i) => {
        const ms = new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()
        return sum + ms / 3600000
      }, 0) / filtered.length
    }
    const currentAvgHours = calcAvgHours(currentResolved)
    const previousAvgHours = calcAvgHours(previousResolved)
    if (currentAvgHours !== null && previousAvgHours !== null && previousAvgHours > 0) {
      const pct = ((currentAvgHours - previousAvgHours) / previousAvgHours) * 100
      if (pct > 25) {
        candidates.push({
          trendType: "SLOW_RESOLUTION",
          title: `Resolution Time Increased ${pct.toFixed(0)}%`,
          description: `Avg resolution time rose from ${previousAvgHours.toFixed(1)}h to ${currentAvgHours.toFixed(1)}h.`,
          severity: pct > 50 ? "HIGH" : "MEDIUM",
          supportingData: { currentHours: currentAvgHours, previousHours: previousAvgHours, changePct: pct },
          dedupeKey: "SLOW_RESOLUTION",
        })
      }
    }

    // Get existing active alerts to deduplicate
    const existingAlerts = await prisma.trendAlert.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      select: { trendType: true, supportingData: true },
    })
    const existingKeys = new Set(existingAlerts.map(a => {
      const sd = a.supportingData as Record<string, unknown>
      if (a.trendType === "RECURRING_ASSET" && sd.assetId) return `RECURRING_ASSET:${sd.assetId}`
      if (a.trendType === "CATEGORY_TREND" && sd.category) return `CATEGORY_TREND:${sd.category}`
      if (a.trendType === "SAFETY_INCREASE" && sd.category) return `SAFETY_INCREASE:${sd.category}`
      return a.trendType
    }))

    const newCandidates = candidates.filter(c => !existingKeys.has(c.dedupeKey))

    // Create TrendAlert records with AI recommendations
    let createdCount = 0
    for (const candidate of newCandidates) {
      const recommendation = await getAIRecommendation(candidate)
      await prisma.trendAlert.create({
        data: {
          organizationId: orgId,
          trendType: candidate.trendType,
          title: candidate.title,
          description: candidate.description,
          severity: candidate.severity,
          supportingData: candidate.supportingData,
          recommendation: recommendation ?? undefined,
          status: "ACTIVE",
          detectedAt: now,
        },
      })
      createdCount++
    }

    return NextResponse.json({ alertsCreated: createdCount, totalCandidates: candidates.length })
  } catch (err) {
    console.error("[Trend Detection] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
