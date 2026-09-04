import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { callHaiku, getCached, setCache } from "@/lib/ai-haiku"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const orgId = session.organizationId
  const cacheKey = "anomalies"
  const cached = await getCached(orgId, cacheKey)
  if (cached !== undefined) return NextResponse.json({ anomalies: cached })

  const now   = new Date()
  const day7  = new Date(now.getTime() - 7  * 86_400_000)
  const day14 = new Date(now.getTime() - 14 * 86_400_000)

  const [last7, prev7, last7Safety, prev7Safety, assetCounts] = await Promise.all([
    prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: day7 } } }),
    prisma.issue.count({ where: { organizationId: orgId, createdAt: { gte: day14, lt: day7 } } }),
    prisma.issue.count({ where: { organizationId: orgId, category: { in: ["SAFETY", "INJURY"] }, createdAt: { gte: day7 } } }),
    prisma.issue.count({ where: { organizationId: orgId, category: { in: ["SAFETY", "INJURY"] }, createdAt: { gte: day14, lt: day7 } } }),
    prisma.issue.groupBy({
      by: ["assetId"],
      where: { organizationId: orgId, assetId: { not: null }, createdAt: { gte: day7 } },
      _count: { id: true },
      having: { id: { _count: { gt: 3 } } },
    }),
  ])

  const facts: string[] = []

  if (prev7 > 0 && last7 > prev7 * 1.5) {
    facts.push(`Volume spike: ${last7} issues this week vs ${prev7} last week (+${Math.round((last7 / prev7 - 1) * 100)}%)`)
  } else if (prev7 > 3 && last7 < prev7 * 0.5) {
    facts.push(`Volume drop: only ${last7} issues this week vs ${prev7} last week`)
  }

  if (last7Safety >= 2 && prev7Safety >= 0 && last7Safety > prev7Safety * 1.5) {
    facts.push(`Safety/injury increase: ${last7Safety} incidents this week vs ${prev7Safety} last week`)
  }

  if (assetCounts.length > 0) {
    const assetId = assetCounts[0].assetId
    if (assetId) {
      const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { name: true } })
      const cnt   = assetCounts[0]._count.id
      facts.push(`Recurring asset: "${asset?.name ?? assetId}" had ${cnt} issues in the last 7 days`)
    }
  }

  if (facts.length === 0) {
    await setCache(orgId, cacheKey, [])
    return NextResponse.json({ anomalies: [] })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    await setCache(orgId, cacheKey, facts)
    return NextResponse.json({ anomalies: facts })
  }

  const prompt = `You are an operations analyst. Here are raw anomaly signals from an issue-tracking system:\n${facts.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\nRewrite each as a concise, actionable insight sentence (under 20 words each). Return as JSON array of strings, nothing else.`
  const text = await callHaiku(prompt, { maxTokens: 256, timeoutMs: 6000 })

  let anomalies: string[] = facts
  if (text) {
    try { anomalies = JSON.parse(text.trim()) as string[] } catch { /* use raw facts */ }
  }

  await setCache(orgId, cacheKey, anomalies)
  return NextResponse.json({ anomalies })
}
