import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Called daily at 07:00. Generates DAILY briefings for all eligible orgs.
// Also generates WEEKLY on Mondays and MONTHLY on the 1st of each month.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ ok: true, generated: 0, reason: "no_api_key" })

  const now       = new Date()
  const dayOfWeek = now.getUTCDay()   // 0=Sun, 1=Mon
  const dayOfMonth = now.getUTCDate()

  const orgs = await prisma.organization.findMany({
    where: {
      executive_briefings_enabled: true,
      isDemo: false,
      subscriptionStatus: { in: ["active", "trialing"] },
    },
    select: { id: true, name: true, industry: true },
  })

  let generated = 0

  for (const org of orgs) {
    const types: ("DAILY" | "WEEKLY" | "MONTHLY")[] = ["DAILY"]
    if (dayOfWeek === 1) types.push("WEEKLY")    // Monday
    if (dayOfMonth === 1) types.push("MONTHLY")  // 1st of month

    for (const briefingType of types) {
      try {
        const periodHours = briefingType === "DAILY" ? 24 : briefingType === "WEEKLY" ? 168 : 720
        const periodStart = new Date(now.getTime() - periodHours * 60 * 60 * 1000)

        const [issues, resolved, escalated, injuries, byCategory, byLocation] = await Promise.all([
          prisma.issue.count({ where: { organizationId: org.id, createdAt: { gte: periodStart } } }),
          prisma.issue.count({ where: { organizationId: org.id, resolvedAt: { gte: periodStart } } }),
          prisma.issue.count({ where: { organizationId: org.id, isEscalated: true, createdAt: { gte: periodStart } } }),
          prisma.injuryReport.count({ where: { organizationId: org.id, createdAt: { gte: periodStart } } }),
          prisma.issue.groupBy({ by: ["category"], where: { organizationId: org.id, createdAt: { gte: periodStart } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 5 }),
          prisma.issue.groupBy({ by: ["locationId"], where: { organizationId: org.id, createdAt: { gte: periodStart }, locationId: { not: null } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 3 }),
        ])

        const avgResData = await prisma.issue.findMany({
          where: { organizationId: org.id, resolvedAt: { gte: periodStart }, createdAt: { gte: periodStart } },
          select: { createdAt: true, resolvedAt: true },
        })
        const avgResHours = avgResData.length > 0
          ? avgResData.reduce((sum, i) => sum + (i.resolvedAt!.getTime() - i.createdAt.getTime()) / 3600000, 0) / avgResData.length
          : null

        const context = `
Organization: ${org.name} (${org.industry ?? "General"})
Period: ${briefingType} (last ${periodHours} hours)
From: ${periodStart.toISOString()} To: ${now.toISOString()}

Issue Statistics:
- New issues: ${issues}
- Resolved: ${resolved}
- Escalated: ${escalated}
- Injury reports: ${injuries}
- Avg resolution time: ${avgResHours != null ? avgResHours.toFixed(1) + " hours" : "N/A"}

Top Issue Categories:
${byCategory.map(c => `  - ${c.category}: ${c._count.id}`).join("\n")}

Top Locations by Issue Volume:
${byLocation.map(l => `  - Location ID ${l.locationId}: ${l._count.id} issues`).join("\n")}
`.trim()

        const record = await prisma.executiveBriefing.create({
          data: {
            organizationId: org.id,
            briefingType,
            periodStart,
            periodEnd: now,
            content: "",
            status: "GENERATING",
            triggeredBy: "cron",
          },
        })

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key":         apiKey,
            "anthropic-version": "2023-06-01",
            "content-type":      "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2000,
            system: "You are an operational intelligence AI for a facility management platform. Generate clear, professional operational briefings in markdown. Be specific, actionable, and concise. Focus on what matters most: safety, efficiency, and trends.",
            messages: [{
              role: "user",
              content: `Generate a ${briefingType.toLowerCase()} operations briefing for ${org.name} based on this data:\n\n${context}\n\nInclude sections: Executive Summary, Key Metrics, Areas Needing Attention, Trending Issues, and Recommended Actions. Use bullet points and be concise.`,
            }],
          }),
          signal: AbortSignal.timeout(30000),
        })

        let content = ""
        let status: "COMPLETE" | "FAILED" = "FAILED"
        if (res.ok) {
          const data = await res.json() as { content?: { text?: string }[] }
          content = data.content?.[0]?.text ?? ""
          status = content ? "COMPLETE" : "FAILED"
        }

        await prisma.executiveBriefing.update({ where: { id: record.id }, data: { content, status } })
        generated++
      } catch (err) {
        console.error(`Briefing failed for org ${org.id}:`, err)
      }
    }
  }

  return NextResponse.json({ ok: true, generated })
}
