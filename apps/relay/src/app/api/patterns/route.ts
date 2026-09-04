import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { bucketIndustry } from "@/lib/patterns"

// Returns anonymized pattern suggestions for a given category + optional filters.
// Called from the issue creation form to show "similar issues resolved by..." hints.
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = request.nextUrl
  const category    = searchParams.get("category")
  const assetType   = searchParams.get("assetType") ?? undefined

  if (!category) return NextResponse.json({ error: "category required" }, { status: 400 })

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { industry: true },
  })

  const industryBucket = bucketIndustry(org?.industry)

  // Resolved patterns matching category (industry preferred, falls back to all)
  const [industryPatterns, allPatterns] = await Promise.all([
    industryBucket
      ? prisma.issuePattern.findMany({
          where: {
            category,
            industryBucket,
            assetTypeBucket: assetType ?? undefined,
            resolvedAt: { not: null },
          },
          select: { resolvedInDays: true, wasEscalated: true, priority: true },
        })
      : Promise.resolve([]),
    prisma.issuePattern.findMany({
      where: {
        category,
        assetTypeBucket: assetType ?? undefined,
        resolvedAt: { not: null },
      },
      select: { resolvedInDays: true, wasEscalated: true, priority: true },
      take: 200,
    }),
  ])

  const patterns = industryPatterns.length >= 5 ? industryPatterns : allPatterns
  const total = patterns.length

  if (total === 0) return NextResponse.json({ total: 0, suggestions: [] })

  const withDays  = patterns.filter((p) => p.resolvedInDays != null)
  const avgDays   = withDays.length > 0
    ? parseFloat((withDays.reduce((s, p) => s + p.resolvedInDays!, 0) / withDays.length).toFixed(1))
    : null
  const escalatedPct = Math.round((patterns.filter((p) => p.wasEscalated).length / total) * 100)
  const scopeLabel    = industryPatterns.length >= 5 ? "similar businesses" : "businesses on Relay"

  const suggestions: string[] = []

  if (avgDays !== null) {
    suggestions.push(
      avgDays < 1
        ? `${scopeLabel.charAt(0).toUpperCase() + scopeLabel.slice(1)} resolved similar issues in under a day on average`
        : `${scopeLabel.charAt(0).toUpperCase() + scopeLabel.slice(1)} resolved similar issues in ~${avgDays} day${avgDays === 1 ? "" : "s"} on average`
    )
  }
  if (escalatedPct >= 30) {
    suggestions.push(`${escalatedPct}% of similar issues required escalation — consider assigning to a senior team member`)
  }

  return NextResponse.json({ total, scope: industryBucket ?? "global", suggestions })
}
