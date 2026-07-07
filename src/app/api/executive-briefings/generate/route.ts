import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const PERIOD_DAYS: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin role required" }, { status: 403 })

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { executive_briefings_enabled: true, name: true },
  })
  if (!org?.executive_briefings_enabled) {
    return NextResponse.json({ error: "Executive briefings not enabled" }, { status: 403 })
  }

  const body = await request.json()
  const type: string = body.type
  if (!["DAILY", "WEEKLY", "MONTHLY"].includes(type)) {
    return NextResponse.json({ error: "Invalid briefing type" }, { status: 400 })
  }

  const days = PERIOD_DAYS[type]
  const periodEnd = new Date()
  const periodStart = new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000)

  // Create briefing record with GENERATING status
  const briefing = await prisma.executiveBriefing.create({
    data: {
      organizationId: session.organizationId,
      briefingType: type,
      periodStart,
      periodEnd,
      content: "",
      status: "GENERATING",
      triggeredBy: session.userId,
    },
  })

  try {
    // Fetch org data for the period
    const [
      totalIssues,
      openIssues,
      resolvedIssues,
      inProgressIssues,
      escalatedIssues,
      criticalIssues,
      injuryCount,
      issuesByStatus,
      issuesByPriority,
      issuesByCategory,
      resolvedInPeriod,
      locationBreakdown,
    ] = await Promise.all([
      prisma.issue.count({ where: { organizationId: session.organizationId, createdAt: { gte: periodStart } } }),
      prisma.issue.count({ where: { organizationId: session.organizationId, status: "OPEN" } }),
      prisma.issue.count({ where: { organizationId: session.organizationId, status: "RESOLVED", resolvedAt: { gte: periodStart } } }),
      prisma.issue.count({ where: { organizationId: session.organizationId, status: "IN_PROGRESS" } }),
      prisma.issue.count({ where: { organizationId: session.organizationId, isEscalated: true, createdAt: { gte: periodStart } } }),
      prisma.issue.count({ where: { organizationId: session.organizationId, priority: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      prisma.injuryReport.count({ where: { organizationId: session.organizationId, createdAt: { gte: periodStart } } }),
      prisma.issue.groupBy({ by: ["status"], where: { organizationId: session.organizationId }, _count: { id: true } }),
      prisma.issue.groupBy({ by: ["priority"], where: { organizationId: session.organizationId, createdAt: { gte: periodStart } }, _count: { id: true } }),
      prisma.issue.groupBy({ by: ["category"], where: { organizationId: session.organizationId, createdAt: { gte: periodStart } }, _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
      prisma.issue.findMany({
        where: { organizationId: session.organizationId, resolvedAt: { gte: periodStart }, status: { in: ["RESOLVED", "CLOSED"] } },
        select: { createdAt: true, resolvedAt: true },
      }),
      prisma.issue.groupBy({
        by: ["locationId"],
        where: { organizationId: session.organizationId, createdAt: { gte: periodStart }, locationId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ])

    // Calculate avg resolution time
    const resolvedWithTimes = resolvedInPeriod.filter(i => i.resolvedAt)
    const avgResolutionHours = resolvedWithTimes.length > 0
      ? resolvedWithTimes.reduce((sum, i) => {
          const ms = new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()
          return sum + ms / 3600000
        }, 0) / resolvedWithTimes.length
      : null

    // Enrich location names
    const locationIds = locationBreakdown.map(l => l.locationId).filter(Boolean) as string[]
    const locationNames = locationIds.length > 0
      ? await prisma.location.findMany({ where: { id: { in: locationIds } }, select: { id: true, name: true } })
      : []
    const locMap = Object.fromEntries(locationNames.map(l => [l.id, l.name]))

    const fmtHours = (h: number | null) => {
      if (h === null) return "N/A"
      if (h < 1) return `${Math.round(h * 60)} minutes`
      if (h < 24) return `${h.toFixed(1)} hours`
      return `${(h / 24).toFixed(1)} days`
    }

    const periodLabel = type === "DAILY" ? "last 24 hours" : type === "WEEKLY" ? "last 7 days" : "last 30 days"

    const dataContext = `
Organization: ${org.name}
Briefing Period: ${type} (${periodLabel})
Generated: ${periodEnd.toISOString()}

== Issues Created This Period ==
Total new issues: ${totalIssues}
By priority: ${issuesByPriority.map(p => `${p.priority}: ${p._count.id}`).join(", ") || "none"}
By category: ${issuesByCategory.slice(0, 6).map(c => `${c.category}: ${c._count.id}`).join(", ") || "none"}

== Current Issue Status (All Open Issues) ==
Open: ${openIssues}
In Progress: ${inProgressIssues}
Resolved this period: ${resolvedIssues}
Escalated this period: ${escalatedIssues}
Critical open: ${criticalIssues}

== Safety ==
Injury reports this period: ${injuryCount}

== Performance ==
Avg resolution time: ${fmtHours(avgResolutionHours)}

== Top Locations by Issue Volume (This Period) ==
${locationBreakdown.map(l => `${locMap[l.locationId!] ?? "Unknown"}: ${l._count.id} issues`).join("\n") || "No location data"}
    `.trim()

    // Call Anthropic API
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      await prisma.executiveBriefing.update({
        where: { id: briefing.id },
        data: { status: "FAILED", content: "ANTHROPIC_API_KEY not configured." },
      })
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 })
    }

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: `You are an executive operations analyst generating professional operational briefings for facility and operations managers.
Write clear, concise briefings in markdown format. Focus on key metrics, trends, and actionable insights.
Use a professional executive tone. Structure with clear sections: Executive Summary, Key Metrics, Notable Trends, Areas of Concern, and Recommendations.
Always present data in context — explain what numbers mean operationally, not just raw figures.`,
        messages: [
          {
            role: "user",
            content: `Generate a professional ${type.toLowerCase()} operational briefing based on the following data:\n\n${dataContext}`,
          },
        ],
      }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error("[Executive Briefing] Anthropic API error:", errText)
      await prisma.executiveBriefing.update({
        where: { id: briefing.id },
        data: { status: "FAILED", content: "AI generation failed." },
      })
      return NextResponse.json({ error: "AI generation failed" }, { status: 500 })
    }

    const aiData = await aiResponse.json()
    const content: string = aiData.content?.[0]?.text ?? ""

    const updated = await prisma.executiveBriefing.update({
      where: { id: briefing.id },
      data: { content, status: "COMPLETE" },
    })

    return NextResponse.json(updated, { status: 201 })
  } catch (err) {
    console.error("[Executive Briefing] Error:", err)
    await prisma.executiveBriefing.update({
      where: { id: briefing.id },
      data: { status: "FAILED", content: "An unexpected error occurred." },
    }).catch(() => {})
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
