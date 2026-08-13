import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { callWithWebSearch, callForAnalysis } from "@/lib/visibility-engine"

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
    if (daysSinceLast < minDays) {
      return NextResponse.json({ skipped: "frequency not met" })
    }
  }

  const prompts = await prisma.visibilityPrompt.findMany({ where: { isActive: true } })
  const competitors = await prisma.visibilityCompetitor.findMany()

  const runId = `auto_${Date.now()}`
  const providers = (settings.autoProviders as string[]) ?? ["anthropic"]

  await prisma.visibilityRun.create({
    data: { runId, status: "running", providersUsed: providers, runType: "automatic" },
  })

  type CheckRow = { promptText: string; relayMentioned: boolean; competitorsMentioned: string[] }
  const allChecks: CheckRow[] = []
  let mentionedCount = 0
  let totalChecks = 0

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
          text = r.text; sources = r.sources
        } catch { text = "[Error]" }

        const lower = text.toLowerCase()
        const relayMentioned = lower.includes("relay") || lower.includes("getrelay")
        let relayPosition: number | null = null
        if (relayMentioned) {
          const paras = text.split(/\n+/)
          for (let j = 0; j < paras.length; j++) {
            if (paras[j].toLowerCase().includes("relay")) { relayPosition = j + 1; break }
          }
        }
        const competitorsMentioned = competitors.filter(c => lower.includes(c.name.toLowerCase())).map(c => c.name)

        await prisma.visibilityCheck.create({
          data: {
            runId, promptId: prompt.id, provider: "anthropic",
            relayMentioned, relayPosition,
            competitorsMentioned: competitorsMentioned as never,
            sourcesCited: sources as never,
            rawResponse: text, runType: "automatic",
          },
        })
        allChecks.push({ promptText: prompt.promptText, relayMentioned, competitorsMentioned })
        if (relayMentioned) mentionedCount++
        totalChecks++
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
      `Score: ${score.toFixed(1)}%. Respond with JSON only: {"analysis":"...","recommendations":["...","...","..."]}`
    )
    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim()) as { analysis?: string; recommendations?: string[] }
    aiAnalysis        = parsed.analysis        ?? aiAnalysis
    aiRecommendations = parsed.recommendations ?? []
  } catch { /* keep defaults */ }

  await Promise.all([
    prisma.visibilityRun.update({
      where: { runId },
      data: {
        status: "completed", promptsChecked: totalChecks,
        relayVisibilityScore: score, completedAt: new Date(),
        aiAnalysis, aiRecommendations: aiRecommendations as never,
      },
    }),
    prisma.visibilitySetting.update({
      where: { id: settings.id },
      data: { lastAutoRunAt: new Date() },
    }),
  ])

  return NextResponse.json({ runId, score, totalChecks, mentionedCount })
}
