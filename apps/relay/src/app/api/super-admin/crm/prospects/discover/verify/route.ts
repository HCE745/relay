import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import Anthropic from "@anthropic-ai/sdk"
import type { EmployeeCountTier, QualificationTier } from "@/app/api/super-admin/crm/prospects/discover/route"

// 30s is enough for 2 web searches — well within Vercel's function limit
export const maxDuration = 30

export interface VerifyResult {
  employeeCountTier:  EmployeeCountTier
  estimatedEmployees: string
  qualificationTier:  QualificationTier
  locationVerified:   boolean
  sourceCitations:    string[]
}

const VALID_TIER = new Set<string>(["web_confirmed", "web_estimated", "unknown"])

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.superAdmin && !session?.salesUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json() as {
      companyName:      string
      website?:         string
      empMin?:          number
      empMax?:          number
      locationVerified?: boolean
    }

    if (!body.companyName?.trim()) {
      return NextResponse.json({ error: "companyName required" }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 })
    }

    const empMin      = body.empMin      ?? 50
    const empMax      = body.empMax      ?? 300
    const empRange    = `${empMin}–${empMax}`
    const companyName = body.companyName.trim()
    const website     = body.website ?? ""

    const userPrompt = `Verify the employee count for this company:

Company: ${companyName}
Website: ${website || "(not known)"}
Target range: ${empRange} employees

USE AT MOST 2 WEB SEARCHES:
1. "${companyName} linkedin.com employees" or "${companyName} site:linkedin.com"
2. If LinkedIn gives nothing: "${companyName} glassdoor employees"

Classify:
- "web_confirmed" — LinkedIn or Glassdoor shows an employee range entirely within ${empRange}
- "web_estimated" — shows a range that OVERLAPS with ${empRange} (e.g. "51-200" overlaps 50-300)
- "unknown" — no headcount evidence found after searching

Return ONLY a JSON object (no markdown, no explanation):
{
  "employeeCountTier": "web_confirmed" | "web_estimated" | "unknown",
  "estimatedEmployees": "number range (e.g. 80-150)" or "unknown",
  "sourceCitations": ["url1"]
}`

    const anthropic = new Anthropic({ apiKey, maxRetries: 0 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: any[] = [{ type: "web_search_20260209", name: "web_search", max_uses: 2 }]

    const response = await anthropic.messages.create({
      model:      "claude-sonnet-5-5",
      max_tokens: 400,
      tools,
      messages:   [{ role: "user", content: userPrompt }],
    }, { timeout: 25_000 })

    // Collect confirmed search URLs for citation validation
    const confirmedUrls = new Set<string>()
    for (const block of response.content) {
      if (block.type === "web_search_tool_result") {
        const wsBlock = block as unknown as { content: Array<{ url?: string }> }
        for (const item of wsBlock.content ?? []) {
          if (item.url) confirmedUrls.add(item.url)
        }
      }
    }

    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text")
    const rawText    = textBlocks.at(-1)?.text.trim() ?? "{}"

    const locationVerified = body.locationVerified ?? false

    let parsed: Record<string, unknown>
    try {
      const clean = rawText.replace(/```(?:json)?\s*([\s\S]*?)```/, "$1").trim()
      parsed = JSON.parse(clean) as Record<string, unknown>
    } catch {
      console.error("[discover/verify] JSON parse failed for", companyName, "raw:", rawText.slice(0, 200))
      return NextResponse.json({
        employeeCountTier:  "unknown",
        estimatedEmployees: "unknown",
        qualificationTier:  locationVerified ? "potential" : "location_unverified",
        locationVerified,
        sourceCitations:    [],
      } satisfies VerifyResult)
    }

    const tierRaw = String(parsed.employeeCountTier ?? "unknown").toLowerCase()
    const tier: EmployeeCountTier = VALID_TIER.has(tierRaw) ? (tierRaw as EmployeeCountTier) : "unknown"

    let qualTier: QualificationTier = "potential"
    if (!locationVerified) qualTier = "location_unverified"
    else if (tier === "web_confirmed" || tier === "web_estimated") qualTier = "qualified"

    const rawCitations = Array.isArray(parsed.sourceCitations)
      ? (parsed.sourceCitations as unknown[]).filter((u): u is string => typeof u === "string")
      : []
    const citations = confirmedUrls.size > 0
      ? rawCitations.filter(url => confirmedUrls.has(url))
      : rawCitations

    console.log("[discover/verify]", companyName, "→", tier, qualTier)

    return NextResponse.json({
      employeeCountTier:  tier,
      estimatedEmployees: String(parsed.estimatedEmployees ?? "unknown"),
      qualificationTier:  qualTier,
      locationVerified,
      sourceCitations:    citations,
    } satisfies VerifyResult)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[discover/verify] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
