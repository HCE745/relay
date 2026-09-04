import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { callWithWebSearch, callForAnalysis, computeCheckCost, parseRelayMention } from "@/lib/visibility-engine"

export const dynamic = "force-dynamic"
export const maxDuration = 120

async function getModel(): Promise<string> {
  const s = await prisma.visibilitySetting.findFirst({ select: { visibilityCheckModel: true } })
  return s?.visibilityCheckModel ?? "claude-haiku-4-5-20251001"
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { promptIds?: string[]; providers?: string[] }
  const { promptIds = [], providers = ["anthropic"] } = body

  if (!promptIds.length) return NextResponse.json({ error: "No prompts selected" }, { status: 400 })

  const [model, prompts, competitors] = await Promise.all([
    getModel(),
    prisma.visibilityPrompt.findMany({ where: { id: { in: promptIds }, isActive: true } }),
    prisma.visibilityCompetitor.findMany(),
  ])

  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const competitorNames = competitors.map(c => c.name)

  await prisma.visibilityRun.create({
    data: {
      runId,
      status:              "running",
      providersUsed:       providers,
      competitorsSnapshot: competitorNames as never,
      runType:             "manual",
    },
  })

  type CheckRow = {
    promptText:           string
    relayMentioned:       boolean
    competitorsMentioned: string[]
    rawResponse:          string
    cost:                 number
  }
  const allChecks: CheckRow[] = []
  let mentionedCount = 0
  let totalChecks    = 0
  let totalCost      = 0

  try {
    const BATCH = 4
    for (let i = 0; i < prompts.length; i += BATCH) {
      const batch = prompts.slice(i, i + BATCH)
      await Promise.all(batch.map(async (prompt) => {
        for (const provider of providers) {
          if (provider !== "anthropic") continue

          let providerStatus = "success"
          let errorMessage: string | null = null
          let rawResponse = ""
          let sources: string[] = []
          let searchCount = 0
          let inputTokens = 0
          let outputTokens = 0

          try {
            const r  = await callWithWebSearch(prompt.promptText, model)
            rawResponse  = r.text
            sources      = r.sources
            searchCount  = r.searchCount
            inputTokens  = r.inputTokens
            outputTokens = r.outputTokens
          } catch (err) {
            providerStatus = "failed"
            errorMessage   = err instanceof Error ? err.message : "Unknown error"
            rawResponse    = `[Error: ${errorMessage}]`
          }

          const cost   = computeCheckCost(inputTokens, outputTokens, searchCount)
          const lower  = rawResponse.toLowerCase()
          const parsed = parseRelayMention(rawResponse, sources)

          const competitorsMentioned = competitors
            .filter(c => lower.includes(c.name.toLowerCase()))
            .map(c => c.name)

          await prisma.visibilityCheck.create({
            data: {
              runId,
              promptId:             prompt.id,
              provider:             "anthropic",
              relayMentioned:       parsed.relayMentioned,
              mentionOrder:         parsed.mentionOrder,
              prominenceScore:      parsed.prominenceScore,
              competitorsMentioned: competitorsMentioned as never,
              sourcesCited:         sources as never,
              citationToRelay:      parsed.citationToRelay,
              relayCitedUrls:       parsed.relayCitedUrls as never,
              rawResponse,
              runType:              "manual",
              searchCount,
              inputTokens,
              outputTokens,
              estimatedCostUsd:     cost,
              errorMessage,
              providerStatus,
              iterationNumber:      1,
            },
          })

          allChecks.push({
            promptText:           prompt.promptText,
            relayMentioned:       parsed.relayMentioned,
            competitorsMentioned,
            rawResponse,
            cost,
          })
          if (parsed.relayMentioned) mentionedCount++
          totalChecks++
          totalCost += cost
        }
      }))
    }

    const score = totalChecks > 0 ? (mentionedCount / totalChecks) * 100 : 0

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
        `Respond with valid JSON only (no markdown): {"analysis":"...","recommendations":["...","...","..."]}`,
        model,
      )

      const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim()
      const parsed  = JSON.parse(cleaned) as { analysis?: string; recommendations?: string[] }
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
        totalEstimatedCostUsd: totalCost,
        completedAt:          new Date(),
        aiAnalysis,
        aiRecommendations:    aiRecommendations as never,
      },
    })

    return NextResponse.json({ runId, score, totalChecks, mentionedCount, totalCost })
  } catch {
    await prisma.visibilityRun.update({
      where: { runId },
      data:  { status: "failed", completedAt: new Date() },
    }).catch(() => {})

    return NextResponse.json({ error: "Run failed" }, { status: 500 })
  }
}
