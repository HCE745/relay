import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isProfessionalPlus } from "@/lib/pricing"
import { getCached, setCache } from "@/lib/ai-haiku"

const CACHE_KEY = "voice-ai-insights"
const CACHE_TTL_HOURS = 6

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "HR", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { plan: true },
  })
  if (!isProfessionalPlus(org?.plan ?? "essentials")) {
    return NextResponse.json({ error: "Requires Professional Plus" }, { status: 403 })
  }

  const cached = await getCached(session.organizationId, CACHE_KEY)
  return NextResponse.json(cached ?? null)
}

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "HR", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const org = await prisma.organization.findUnique({
    where:  { id: session.organizationId },
    select: { plan: true },
  })
  if (!isProfessionalPlus(org?.plan ?? "essentials")) {
    return NextResponse.json({ error: "Requires Professional Plus" }, { status: 403 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 })

  const since = new Date()
  since.setDate(since.getDate() - 90)

  const submissions = await prisma.suggestion.findMany({
    where:   { organizationId: session.organizationId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take:    80,
    select:  { type: true, content: true, status: true, detectedCategory: true },
  })

  if (submissions.length === 0) {
    const empty = {
      themes: [],
      overallSentiment: "neutral",
      topInsight: "No submissions in the last 90 days to analyze.",
      recommendation: "Encourage employees to use Employee Voice to share ideas and feedback.",
      submissionCount: 0,
      generatedAt: new Date().toISOString(),
    }
    await setCache(session.organizationId, CACHE_KEY, empty, CACHE_TTL_HOURS)
    return NextResponse.json(empty)
  }

  const submissionsText = submissions
    .map(s => `[${s.type}${s.detectedCategory ? ` / ${s.detectedCategory}` : ""}] ${s.content} (status: ${s.status})`)
    .join("\n")

  const systemPrompt = `You are an HR analytics AI that analyzes employee voice submissions.
Return only valid JSON with this exact structure (no markdown, no extra text):
{"themes":[{"label":"...","description":"...","severity":"high|medium|low"}],"overallSentiment":"positive|neutral|concerning","topInsight":"...","recommendation":"..."}
Rules:
- themes: 2-4 objects max. label = 3-5 words. description = 1-2 sentences explaining the pattern.
- severity: "high" for safety/urgent issues, "low" for minor suggestions, "medium" otherwise.
- overallSentiment: "positive" if most submissions are suggestions/improvements, "concerning" if safety/morale issues dominate, "neutral" otherwise.
- topInsight: 1 concise sentence about the single most important finding.
- recommendation: 1-2 sentences of concrete, actionable advice for leadership.`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `Analyze these ${submissions.length} employee voice submissions from the last 90 days:\n\n${submissionsText}`,
        }],
      }),
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json({ error: "AI request failed" }, { status: 502 })
    }

    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    const text = data.content.find(c => c.type === "text")?.text?.trim() ?? ""

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 })
    }

    const analysis = {
      ...parsed,
      submissionCount: submissions.length,
      generatedAt: new Date().toISOString(),
    }

    await setCache(session.organizationId, CACHE_KEY, analysis, CACHE_TTL_HOURS)
    return NextResponse.json(analysis)
  } catch {
    clearTimeout(timeout)
    return NextResponse.json({ error: "AI request timed out or failed" }, { status: 502 })
  }
}
