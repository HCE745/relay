import "server-only"
import { prisma } from "./prisma"

export interface IssueContext {
  id: string
  title: string
  description: string | null
  category: string
  priority: string
  organizationId: string
  assetType?: string | null
  locationName?: string | null
  departmentName?: string | null
}

interface HistoricalData {
  internalCount: number
  internalAvgDays: number | null
  internalAvgCost: number | null
  internalTopMethod: string | null
  internalTopMethodPct: number | null
  topResolutionCategory: string | null
  recentRootCauses: string[]
  industryCount: number
  industryAvgDays: number | null
  industryEscalationRate: number | null
}

async function fetchHistoricalData(
  organizationId: string,
  category: string,
  industry: string | null
): Promise<HistoricalData> {
  const [internalIssues, industryPatterns] = await Promise.all([
    prisma.issue.findMany({
      where: { organizationId, category, status: "RESOLVED", resolvedMethod: { not: null } },
      select: {
        resolvedMethod: true,
        resolutionCost: true,
        resolutionCategory: true,
        rootCause: true,
        createdAt: true,
        resolvedAt: true,
      },
      orderBy: { resolvedAt: "desc" },
      take: 30,
    }),
    prisma.issuePattern.findMany({
      where: {
        category,
        resolvedAt: { not: null },
        ...(industry ? { industryBucket: normalizeIndustry(industry) ?? undefined } : {}),
      },
      select: { resolvedInDays: true, wasEscalated: true },
      take: 150,
    }),
  ])

  const methodCounts: Record<string, number> = {}
  const categoryCounts: Record<string, number> = {}
  const rootCauses: string[] = []
  let totalCost = 0, costCount = 0, totalDays = 0, daysCount = 0

  for (const i of internalIssues) {
    if (i.resolvedMethod) methodCounts[i.resolvedMethod] = (methodCounts[i.resolvedMethod] ?? 0) + 1
    if (i.resolutionCategory) categoryCounts[i.resolutionCategory] = (categoryCounts[i.resolutionCategory] ?? 0) + 1
    if (i.rootCause && rootCauses.length < 3) rootCauses.push(i.rootCause.slice(0, 120))
    if (i.resolutionCost != null) { totalCost += i.resolutionCost; costCount++ }
    if (i.resolvedAt) {
      totalDays += (i.resolvedAt.getTime() - i.createdAt.getTime()) / 86400000
      daysCount++
    }
  }

  const topEntry = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0]
  const topCatEntry = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]

  const industryAvgDays = industryPatterns.length > 0
    ? Math.round((industryPatterns.reduce((s, p) => s + (p.resolvedInDays ?? 0), 0) / industryPatterns.length) * 10) / 10
    : null
  const escalationRate = industryPatterns.length > 5
    ? Math.round((industryPatterns.filter(p => p.wasEscalated).length / industryPatterns.length) * 100)
    : null

  return {
    internalCount: internalIssues.length,
    internalAvgDays: daysCount > 0 ? Math.round((totalDays / daysCount) * 10) / 10 : null,
    internalAvgCost: costCount > 0 ? Math.round(totalCost / costCount) : null,
    internalTopMethod: topEntry?.[0] ?? null,
    internalTopMethodPct: topEntry ? Math.round((topEntry[1] / internalIssues.length) * 100) : null,
    topResolutionCategory: topCatEntry?.[0] ?? null,
    recentRootCauses: rootCauses,
    industryCount: industryPatterns.length,
    industryAvgDays,
    industryEscalationRate: escalationRate,
  }
}

function buildHistoricalContext(h: HistoricalData): string {
  const parts: string[] = []
  if (h.internalCount > 0) {
    if (h.internalTopMethod && h.internalTopMethodPct) {
      parts.push(`This organization has resolved ${h.internalCount} similar issues — ${h.internalTopMethodPct}% were fixed by: "${h.internalTopMethod}"`)
    }
    if (h.topResolutionCategory) {
      parts.push(`Most common resolution type: ${h.topResolutionCategory}`)
    }
    if (h.recentRootCauses.length > 0) {
      parts.push(`Recent root causes found internally: ${h.recentRootCauses.map(c => `"${c}"`).join("; ")}`)
    }
    if (h.internalAvgDays) parts.push(`Internal average resolution time: ${h.internalAvgDays} days`)
    if (h.internalAvgCost) parts.push(`Internal average resolution cost: $${h.internalAvgCost}`)
  }
  if (h.industryCount >= 5) {
    parts.push(`Industry benchmark (${h.industryCount} similar issues): average ${h.industryAvgDays} days to resolve`)
    if (h.industryEscalationRate && h.industryEscalationRate > 20) {
      parts.push(`${h.industryEscalationRate}% of similar industry issues required escalation`)
    }
  }
  return parts.join("\n")
}

async function callClaude(prompt: string, maxTokens = 500): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn("[AI Suggestion] callClaude skipped — ANTHROPIC_API_KEY not set")
    return null
  }

  console.log("[AI Suggestion] Sending request to Anthropic API, prompt length:", prompt.length)
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[AI Suggestion] Anthropic API error:", res.status, res.statusText, body.slice(0, 200))
      return null
    }
    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    const text = data.content.find(c => c.type === "text")?.text?.trim()
    if (!text) {
      console.error("[AI Suggestion] Anthropic returned empty content, full response:", JSON.stringify(data).slice(0, 300))
    } else {
      console.log("[AI Suggestion] Anthropic responded OK, text length:", text.length)
    }
    return text || null
  } catch (err) {
    console.error("[AI Suggestion] callClaude failed:", err)
    return null
  }
}

// Generate both submitter and assignee suggestions in parallel.
// Returns null strings if AI is unavailable — callers must handle that.
export async function generateIssueSuggestions(
  issue: IssueContext,
  orgIndustry: string | null
): Promise<{ submitterSuggestion: string | null; assigneeSuggestion: string | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { submitterSuggestion: null, assigneeSuggestion: null }

  const hist = await fetchHistoricalData(issue.organizationId, issue.category, orgIndustry)
  const histContext = buildHistoricalContext(hist)
  const hasHistory = hist.internalCount > 0 || hist.industryCount >= 5
  const histCount = hist.internalCount + (hist.industryCount >= 5 ? hist.industryCount : 0)
  const histPrefix = histCount > 0 ? `<!-- hist:${histCount} -->\n` : ""

  const categoryLabel = issue.category.replace(/_/g, " ").toLowerCase()
  const assetStr = issue.assetType ? ` involving a ${issue.assetType.toLowerCase()}` : ""
  const locationStr = issue.locationName ? ` at ${issue.locationName}` : ""
  const descSnippet = issue.description ? `\nDescription: "${issue.description.slice(0, 400)}"` : ""

  const submitterPrompt = `You are a helpful operations support assistant. An employee just reported this issue.

Issue: "${issue.title}"${descSnippet}
Category: ${categoryLabel}${assetStr}${locationStr}
Priority: ${issue.priority.toLowerCase()}
${hasHistory && histContext ? `\nHistorical context:\n${histContext}` : ""}

Write a structured response with EXACTLY these two sections — no other text before or after:

## Possible Causes
2-3 sentences explaining in plain, non-technical language what the specific symptoms they described typically indicate. Name the likely component or condition involved. Be specific to what they described, not generic.

## What To Do Right Now
1-2 sentences telling them the single most important immediate action to take right now (contain or limit the problem while the team responds). This is NOT the full solution — just what they can safely do immediately.

Rules:
- Output ONLY the two sections starting with ## Possible Causes and ## What To Do Right Now
- No preamble, no sign-off, no "Thank you", no other text
- Speak directly to the reporter (use "you"/"your")
- Reference the exact symptoms they described — not generic category advice`

  const assigneePrompt = `You are a senior maintenance technician. This issue has just been assigned to you.

Issue: "${issue.title}"${descSnippet}
Category: ${categoryLabel}${assetStr}${locationStr}
Priority: ${issue.priority.toLowerCase()}
${hasHistory && histContext ? `\nHistorical context:\n${histContext}` : ""}

Provide EXACTLY 3 ranked solutions with this format — no other text:

## Solution 1: [Short title]
**What to do:** [1-2 concrete sentences — name specific components, tests, measurements]
**Why likely:** [1 sentence: why these symptoms point to this cause]
**Time / effort:** [e.g. "30–60 min", "2–4 hours, may need parts"]

## Solution 2: [Short title]
**What to do:** [1-2 sentences]
**Why likely:** [1 sentence]
**Time / effort:** [estimate]

## Solution 3: [Short title]
**What to do:** [1-2 sentences]
**Why likely:** [1 sentence]
**Time / effort:** [estimate]

Rules:
- Rank from most to least likely based on the specific symptoms described
- Each solution must be genuinely distinct (not variations of the same approach)
- Name actual components, tests, or measurements — not vague steps
- Use the exact format shown above with ## and ** labels — no deviations
- No text before ## Solution 1 or after the last Time / effort line`

  const [submitterRaw, assigneeRaw] = await Promise.all([
    callClaude(submitterPrompt, 450),
    callClaude(assigneePrompt, 900),
  ])

  const submitterSuggestion = submitterRaw ? histPrefix + submitterRaw : null
  const assigneeSuggestion = assigneeRaw ? histPrefix + assigneeRaw : null

  return { submitterSuggestion, assigneeSuggestion }
}

// Generate 3 implementation approaches for the assignee of a Suggestion Box item.
// Stores directly on the suggestion record — designed for fire-and-forget.
export async function generateSuggestionApproaches(
  suggestionId: string,
  content: string,
  category: string | null,
  orgIndustry: string | null,
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return

  const catStr = category
    ? category.replace(/_/g, " ").toLowerCase()
    : null
  const industryStr = normalizeIndustry(orgIndustry)

  const prompt = `You are an operations improvement advisor helping a workplace team evaluate this improvement suggestion.

Suggestion: "${content.slice(0, 600)}"
${catStr ? `Category: ${catStr}` : ""}${industryStr ? `\nIndustry: ${industryStr}` : ""}

Provide EXACTLY 3 distinct implementation approaches with this format — no other text:

## Approach 1: [Short title — quick/simple]
**How to implement:** [2-3 concrete sentences]
**Effort:** Low
**Benefits:** [1-2 sentences]
**Drawbacks:** [1 sentence]

## Approach 2: [Short title — moderate scope]
**How to implement:** [2-3 concrete sentences]
**Effort:** Medium
**Benefits:** [1-2 sentences]
**Drawbacks:** [1 sentence]

## Approach 3: [Short title — comprehensive]
**How to implement:** [2-3 concrete sentences]
**Effort:** High
**Benefits:** [1-2 sentences]
**Drawbacks:** [1 sentence]

Rules:
- Rank from simplest/quickest to most comprehensive in scope
- Each approach must be genuinely different in strategy — not just scaled versions of the same plan
- Keep advice practical and actionable for an operational team (not a tech/software company unless the industry says so)
- Use the exact format above — no deviations, no text outside the three sections`

  const result = await callClaude(prompt, 900)
  if (!result) return

  await prisma.suggestion.update({
    where: { id: suggestionId },
    data: { assigneeApproaches: result },
  }).catch((err) => {
    console.error("[AI Suggestion] Failed to store suggestion approaches for", suggestionId, err)
  })
}

// Lighter version for live typing (before submission) — single response, shorter.
export async function generateLiveSuggestion(
  title: string,
  description: string,
  category: string,
  organizationId: string,
  orgIndustry: string | null
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  if (!title.trim() && !description.trim()) return null

  const hist = await fetchHistoricalData(organizationId, category, orgIndustry)
  const histContext = buildHistoricalContext(hist)
  const hasHistory = hist.internalCount > 0 || hist.industryCount >= 5

  const categoryLabel = category.replace(/_/g, " ").toLowerCase()
  const descPart = description.trim() ? `\nDescription so far: "${description.slice(0, 300)}"` : ""

  const prompt = `You are a senior maintenance technician. Someone is currently reporting this issue:

Title: "${title}"${descPart}
Category: ${categoryLabel}
${hasHistory && histContext ? `\nRelevant historical data:\n${histContext}` : ""}

Write ONE sentence of specific, actionable guidance. Focus on the symptoms described — what is working vs what isn't, any sounds or behaviors mentioned.
Name the most likely cause or the single most important first step, specific to the described symptoms.
${hasHistory ? "Reference historical resolution data only if it adds useful context." : ""}

Rules:
- Do not start with "I", "Sure", "Great", or any preamble
- Do not give generic advice that applies to any ${categoryLabel} issue
- Do not use markdown or bullet points
- Reference what was specifically described, not a general category of problem`

  return callClaude(prompt, 120)
}

export function normalizeIndustry(industry: string | null | undefined): string | null {
  if (!industry) return null
  const lower = industry.toLowerCase()
  if (lower.includes("manufactur")) return "manufacturing"
  if (lower.includes("health") || lower.includes("medical")) return "healthcare"
  if (lower.includes("retail")) return "retail"
  if (lower.includes("logistics") || lower.includes("transport")) return "logistics"
  if (lower.includes("construction")) return "construction"
  if (lower.includes("food") || lower.includes("beverage")) return "food_beverage"
  if (lower.includes("tech") || lower.includes("software")) return "technology"
  if (lower.includes("education") || lower.includes("school")) return "education"
  return null
}
