import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Called daily. Detects operational trends and creates TrendAlert records.
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
      trend_detection_enabled: true,
      isDemo: false,
      subscriptionStatus: { in: ["active", "trialing"] },
    },
    select: { id: true, name: true },
  })

  let alertsCreated = 0

  for (const org of orgs) {
    try {
      alertsCreated += await runTrendDetection(org.id, org.name, apiKey ?? null)
    } catch (err) {
      console.error(`Trend detection failed for org ${org.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, alertsCreated })
}

async function getAIRecommendation(apiKey: string, title: string, description: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Operations trend detected: "${title}". ${description}. In 1-2 sentences, give a specific, actionable recommendation to address this.`,
        }],
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json() as { content?: { text?: string }[] }
    return data.content?.[0]?.text ?? null
  } catch {
    return null
  }
}

export async function runTrendDetection(orgId: string, orgName: string, apiKey: string | null): Promise<number> {
  const now    = new Date()
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const ago60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  // Existing active alerts to avoid duplicates
  const existing = await prisma.trendAlert.findMany({
    where: { organizationId: orgId, status: "ACTIVE" },
    select: { trendType: true },
  })
  const existingTypes = new Set(existing.map(e => e.trendType))

  const alertsToCreate: Parameters<typeof prisma.trendAlert.create>[0]["data"][] = []

  // ── Volume spike/drop ────────────────────────────────────────────────────────
  const [thisMonth, lastMonth] = await Promise.all([
    prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: ago30d } } }),
    prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: ago60d, lt: ago30d } } }),
  ])

  if (lastMonth > 5) {
    const changePct = ((thisMonth - lastMonth) / lastMonth) * 100
    if (changePct >= 20 && !existingTypes.has("VOLUME_SPIKE")) {
      const title = `Issue volume up ${changePct.toFixed(0)}% this month`
      const desc  = `${thisMonth} issues this month vs ${lastMonth} last month — a ${changePct.toFixed(0)}% increase.`
      alertsToCreate.push({
        organizationId: orgId,
        trendType: "VOLUME_SPIKE",
        title,
        description: desc,
        severity: changePct >= 50 ? "HIGH" : "MEDIUM",
        supportingData: { metric: "issue_volume", current: thisMonth, previous: lastMonth, changePct },
        recommendation: apiKey ? await getAIRecommendation(apiKey, title, desc) : null,
        status: "ACTIVE",
      })
    } else if (changePct <= -20 && !existingTypes.has("VOLUME_DROP")) {
      const title = `Issue volume down ${Math.abs(changePct).toFixed(0)}% this month`
      const desc  = `${thisMonth} issues this month vs ${lastMonth} last month — a ${Math.abs(changePct).toFixed(0)}% decrease. Monitor for under-reporting.`
      alertsToCreate.push({
        organizationId: orgId,
        trendType: "VOLUME_DROP",
        title,
        description: desc,
        severity: "LOW",
        supportingData: { metric: "issue_volume", current: thisMonth, previous: lastMonth, changePct },
        recommendation: apiKey ? await getAIRecommendation(apiKey, title, desc) : null,
        status: "ACTIVE",
      })
    }
  }

  // ── Category trends ──────────────────────────────────────────────────────────
  if (!existingTypes.has("CATEGORY_TREND")) {
    const [thisMonthCats, lastMonthCats] = await Promise.all([
      prisma.issue.groupBy({ by: ["category"], where: { organizationId: orgId, createdAt: { gte: ago30d } }, _count: { id: true } }),
      prisma.issue.groupBy({ by: ["category"], where: { organizationId: orgId, createdAt: { gte: ago60d, lt: ago30d } }, _count: { id: true } }),
    ])
    const lastMap = new Map(lastMonthCats.map(c => [c.category, c._count.id]))
    for (const cat of thisMonthCats) {
      const prev = lastMap.get(cat.category) ?? 0
      if (prev < 3) continue
      const change = ((cat._count.id - prev) / prev) * 100
      if (change >= 30) {
        const title = `${cat.category.replace(/_/g, " ")} issues up ${change.toFixed(0)}%`
        const desc  = `${cat._count.id} ${cat.category.replace(/_/g, " ")} issues this month vs ${prev} last month.`
        alertsToCreate.push({
          organizationId: orgId,
          trendType: "CATEGORY_TREND",
          title,
          description: desc,
          severity: change >= 50 ? "HIGH" : "MEDIUM",
          supportingData: { metric: "category_volume", category: cat.category, current: cat._count.id, previous: prev, changePct: change },
          recommendation: apiKey ? await getAIRecommendation(apiKey, title, desc) : null,
          status: "ACTIVE",
        })
        break // one category trend alert per run
      }
    }
  }

  // ── Safety increase ───────────────────────────────────────────────────────────
  if (!existingTypes.has("SAFETY_INCREASE")) {
    const [thisInjuries, lastInjuries] = await Promise.all([
      prisma.injuryReport.count({ where: { organizationId: orgId, createdAt: { gte: ago30d } } }),
      prisma.injuryReport.count({ where: { organizationId: orgId, createdAt: { gte: ago60d, lt: ago30d } } }),
    ])
    if (lastInjuries > 0 && thisInjuries > lastInjuries * 1.15) {
      const change = ((thisInjuries - lastInjuries) / lastInjuries) * 100
      const title  = `Safety incidents up ${change.toFixed(0)}% this month`
      const desc   = `${thisInjuries} injury reports this month vs ${lastInjuries} last month.`
      alertsToCreate.push({
        organizationId: orgId,
        trendType: "SAFETY_INCREASE",
        title,
        description: desc,
        severity: "HIGH",
        supportingData: { metric: "injury_count", current: thisInjuries, previous: lastInjuries, changePct: change },
        recommendation: apiKey ? await getAIRecommendation(apiKey, title, desc) : null,
        status: "ACTIVE",
      })
    }
  }

  // ── Recurring asset ───────────────────────────────────────────────────────────
  if (!existingTypes.has("RECURRING_ASSET")) {
    const assetIssues = await prisma.issue.groupBy({
      by: ["assetId"],
      where: { organizationId: orgId, assetId: { not: null }, createdAt: { gte: ago30d } },
      _count: { id: true },
      having: { assetId: { _count: { gte: 3 } } },
      orderBy: { _count: { id: "desc" } },
      take: 1,
    })
    if (assetIssues.length > 0 && assetIssues[0].assetId) {
      const asset = await prisma.asset.findUnique({ where: { id: assetIssues[0].assetId! }, select: { name: true } })
      const count = assetIssues[0]._count.id
      const name  = asset?.name ?? "Unknown Asset"
      const title = `${name} flagged ${count} times this month`
      const desc  = `${name} has been the subject of ${count} issues in the last 30 days, indicating a recurring problem.`
      alertsToCreate.push({
        organizationId: orgId,
        trendType: "RECURRING_ASSET",
        title,
        description: desc,
        severity: count >= 5 ? "HIGH" : "MEDIUM",
        supportingData: { metric: "asset_issues", assetId: assetIssues[0].assetId, assetName: name, count },
        recommendation: apiKey ? await getAIRecommendation(apiKey, title, desc) : null,
        status: "ACTIVE",
      })
    }
  }

  // ── Slow resolution ───────────────────────────────────────────────────────────
  if (!existingTypes.has("SLOW_RESOLUTION")) {
    const [thisRes, lastRes] = await Promise.all([
      prisma.issue.findMany({ where: { organizationId: orgId, resolvedAt: { gte: ago30d } }, select: { createdAt: true, resolvedAt: true } }),
      prisma.issue.findMany({ where: { organizationId: orgId, resolvedAt: { gte: ago60d, lt: ago30d } }, select: { createdAt: true, resolvedAt: true } }),
    ])
    const avg = (arr: typeof thisRes) => arr.length > 0
      ? arr.reduce((s, i) => s + (i.resolvedAt!.getTime() - i.createdAt.getTime()) / 3600000, 0) / arr.length
      : null
    const thisAvg = avg(thisRes)
    const lastAvg = avg(lastRes)
    if (thisAvg && lastAvg && thisAvg > lastAvg * 1.25 && lastAvg > 0) {
      const changePct = ((thisAvg - lastAvg) / lastAvg) * 100
      const title = `Resolution time up ${changePct.toFixed(0)}% this month`
      const desc  = `Average resolution time increased from ${lastAvg.toFixed(1)}h to ${thisAvg.toFixed(1)}h.`
      alertsToCreate.push({
        organizationId: orgId,
        trendType: "SLOW_RESOLUTION",
        title,
        description: desc,
        severity: changePct >= 50 ? "HIGH" : "MEDIUM",
        supportingData: { metric: "resolution_time", current: thisAvg, previous: lastAvg, changePct },
        recommendation: apiKey ? await getAIRecommendation(apiKey, title, desc) : null,
        status: "ACTIVE",
      })
    }
  }

  // Create all detected alerts
  for (const data of alertsToCreate) {
    await prisma.trendAlert.create({ data: data as Parameters<typeof prisma.trendAlert.create>[0]["data"] })
  }
  return alertsToCreate.length
}
