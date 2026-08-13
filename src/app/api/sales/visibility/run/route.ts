import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { callWithWebSearch, callForAnalysis } from "@/lib/visibility-engine"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { promptIds?: string[]; providers?: string[] }
  const { promptIds = [], providers = ["anthropic"] } = body

  if (!promptIds.length) return NextResponse.json({ error: "No prompts selected" }, { status: 400 })

  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  await prisma.visibilityRun.create({
    data: {
      runId,
      status:       "running",
      providersUsed: providers,
      runType:      "manual",
    },
  })

  const [prompts, competitors] = await Promise.all([
    prisma.visibilityPrompt.findMany({ where: { id: { in: promptIds }, isActive: true } }),
    prisma.visibilityCompetitor.findMany(),
  ])

  type CheckRow = {
    promptText: string
    relayMentioned: boolean
    competitorsMentioned: string[]
    rawResponse: string
  }
  const allChecks: CheckRow[] = []
  let mentionedCount = 0
  let totalChecks = 0

  try {
    const BATCH = 4
    for (let i = 0; i < prompts.length; i += BATCH) {
      const batch = prompts.slice(i, i + BATCH)
      await Promise.all(batch.map(async (prompt) => {
        for (const provider of providers) {
          if (provider !== "anthropic") continue

          let text = ""
          let sources: string[] = []
          try {
            const r = await callWithWebSearch(prompt.promptText)
            text    = r.text
            sources = r.sources
          } catch (err) {
            text = `[Error: ${err instanceof Error ? err.message : "Unknown"}]`
          }

          const lower = text.toLowerCase()
          const relayMentioned = lower.includes("relay") || lower.includes("getrelay")

          let relayPosition: number | null = null
          if (relayMentioned) {
            const paras = text.split(/\n+/)
            for (let j = 0; j < paras.length; j++) {
              const pl = paras[j].toLowerCase()
              if (pl.includes("relay") || pl.includes("getrelay")) {
                relayPosition = j + 1
                break
              }
            }
          }

          const competitorsMentioned = competitors
            .filter(c => lower.includes(c.name.toLowerCase()))
            .map(c => c.name)

          await prisma.visibilityCheck.create({
            data: {
              runId,
              promptId:             prompt.id,
              provider:             "anthropic",
              relayMentioned,
              relayPosition,
              competitorsMentioned: competitorsMentioned as never,
              sourcesCited:         sources as never,
              rawResponse:          text,
              runType:              "manual",
            },
          })

          allChecks.push({ promptText: prompt.promptText, relayMentioned, competitorsMentioned, rawResponse: text })
          if (relayMentioned) mentionedCount++
          totalChecks++
        }
      }))
    }

    const score = totalChecks > 0 ? (mentionedCount / totalChecks) * 100 : 0

    // Generate AI recommendations
    let aiAnalysis = ""
    let aiRecommendations: string[] = []
    try {
      const summary = allChecks.slice(0, 12).map(c =>
        `Q: "${c.promptText}"\nRelay mentioned: ${c.relayMentioned ? "YES" : "NO"}\nCompetitors also mentioned: ${c.competitorsMentioned.join(", ") || "none"}`
      ).join("\n\n")

      const raw = await callForAnalysis(
        `You are a marketing analyst for Relay (operations management software at getrelay.software). ` +
        `These are AI visibility check results showing whether Relay appears when people ask AI systems about operational software:\n\n` +
        `${summary}\n\n` +
        `Visibility score: ${score.toFixed(1)}% (Relay mentioned in ${mentionedCount} of ${totalChecks} checks).\n\n` +
        `Provide a brief assessment and 3 specific actionable recommendations to improve Relay's AI visibility. ` +
        `Respond with valid JSON only (no markdown): {"analysis":"...","recommendations":["...","...","..."]}`
      )

      const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim()
      const parsed = JSON.parse(cleaned) as { analysis?: string; recommendations?: string[] }
      aiAnalysis        = parsed.analysis        ?? ""
      aiRecommendations = parsed.recommendations ?? []
    } catch {
      aiAnalysis        = `Relay appeared in ${mentionedCount} of ${totalChecks} AI responses (${score.toFixed(1)}% visibility).`
      aiRecommendations = []
    }

    await prisma.visibilityRun.update({
      where: { runId },
      data: {
        status:               "completed",
        promptsChecked:       totalChecks,
        relayVisibilityScore: score,
        completedAt:          new Date(),
        aiAnalysis,
        aiRecommendations:    aiRecommendations as never,
      },
    })

    return NextResponse.json({ runId, score, totalChecks, mentionedCount })
  } catch {
    await prisma.visibilityRun.update({
      where: { runId },
      data:  { status: "failed", completedAt: new Date() },
    }).catch(() => {})

    return NextResponse.json({ error: "Run failed" }, { status: 500 })
  }
}
