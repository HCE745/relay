import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { callWithWebSearch, callForAnalysis, computeCheckCost, parseRelayMention } from "@/lib/visibility-engine"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET() {
  const settings = await prisma.visibilitySetting.findFirst()
  if (!settings || settings.mode !== "automatic") {
    return NextResponse.json({ skipped: "mode is manual" })
  }

  const now = new Date()
  if (settings.lastAutoRunAt) {
    const freq = settings.autoFrequency
    const daysSinceLast = (now.getTime() - settings.lastAutoRunAt.getTime()) / 86_400_000
    const minDays = freq === "weekly" ? 7 : freq === "biweekly" ? 14 : 30
    if (daysSinceLast < minDays) return NextResponse.json({ skipped: "frequency not met" })
  }

  const model      = settings.visibilityCheckModel ?? "claude-haiku-4-5-20251001"
  const providers  = (settings.autoProviders as string[]) ?? ["anthropic"]
  const [prompts, competitors] = await Promise.all([
    prisma.visibilityPrompt.findMany({ where: { isActive: true } }),
    prisma.visibilityCompetitor.findMany(),
  ])

  const runId            = `auto_${Date.now()}`
  const competitorNames  = competitors.map(c => c.name)

  await prisma.visibilityRun.create({
    data: {
      runId,
      status:              "running",
      providersUsed:       providers,
      competitorsSnapshot: competitorNames as never,
      runType:             "automatic",
    },
  })

  type CheckRow = { promptText: string; relayMentioned: boolean; competitorsMentioned: string[] }
  const allChecks: CheckRow[] = []
  let mentionedCount = 0
  let totalChecks    = 0
  let totalCost      = 0

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
            runType:              "automatic",
            searchCount,
            inputTokens,
            outputTokens,
            estimatedCostUsd:     cost,
            errorMessage,
            providerStatus,
            iterationNumber:      1,
          },
        })

        allChecks.push({ promptText: prompt.promptText, relayMentioned: parsed.relayMentioned, competitorsMentioned })
        if (parsed.relayMentioned) mentionedCount++
        totalChecks++
        totalCost += cost
      }
    }))
  }

  const score = totalChecks > 0 ? (mentionedCount / totalChecks) * 100 : 0

  let aiAnalysis = `Relay appeared in ${mentionedCount} of ${totalChecks} AI responses (${score.toFixed(1)}%).`
  let aiRecommendations: string[] = []
  try {
    const summary = allChecks.slice(0, 10).map(c =>
      `Q: "${c.promptText}"\nRelay: ${c.relayMentioned ? "YES" : "NO"}\nCompetitors: ${c.competitorsMentioned.join(", ") || "none"}`
    ).join("\n\n")
    const raw = await callForAnalysis(
      `Marketing analyst for Relay (getrelay.software). AI visibility results:\n\n${summary}\n\n` +
      `Score: ${score.toFixed(1)}%. Respond with JSON only: {"analysis":"...","recommendations":["...","...","..."]}`,
      model,
    )
    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim()) as { analysis?: string; recommendations?: string[] }
    aiAnalysis        = parsed.analysis        ?? aiAnalysis
    aiRecommendations = parsed.recommendations ?? []
  } catch { /* keep defaults */ }

  await Promise.all([
    prisma.visibilityRun.update({
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
    }),
    prisma.visibilitySetting.update({
      where: { id: settings.id },
      data:  { lastAutoRunAt: new Date() },
    }),
  ])

  return NextResponse.json({ runId, score, totalChecks, mentionedCount, totalCost })
}
