import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// ── Anthropic web-search call ─────────────────────────────────────────────────

interface AnthropicContentBlock {
  type: string
  text?: string
}

interface AnthropicResponse {
  content: AnthropicContentBlock[]
}

interface ResearchData {
  researchSummary: string
  operationalPainPoints: string
  relayFitReasons: string
  suggestedDemoEmphasis: string
  suggestedOutreachAngle: string
  decisionMakerTitles: string[]
  aiFitScore: number
  confidenceScore: number
  employeeCountMin: number | null
  employeeCountMax: number | null
  locationsCount: number | null
  headquartersCity: string | null
  headquartersState: string | null
  linkedinUrl: string | null
}

async function researchCompany(
  companyName: string,
  website: string | null,
  industry: string | null,
  employeeCountMin: number | null,
  employeeCountMax: number | null,
  locationsCount: number | null,
): Promise<ResearchData | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error("[prospect-research] ANTHROPIC_API_KEY not set")
    return null
  }

  const contextLines: string[] = [
    `Company name: ${companyName}`,
  ]
  if (website) contextLines.push(`Website: ${website}`)
  if (industry) contextLines.push(`Industry: ${industry}`)
  if (employeeCountMin != null || employeeCountMax != null) {
    const min = employeeCountMin ?? "?"
    const max = employeeCountMax ?? "?"
    contextLines.push(`Known employee range: ${min}–${max}`)
  }
  if (locationsCount != null) {
    contextLines.push(`Known locations: ${locationsCount}`)
  }

  const prompt = `You are a B2B sales researcher for Relay (getrelay.software), an operations management platform for multi-location businesses. Relay helps companies manage daily tasks, checklists, team communication, and compliance across multiple sites.

Research the following company thoroughly using web search:

${contextLines.join("\n")}

Your goal is to assess how good a fit this company is for Relay and to gather intelligence that will help us reach out effectively.

Relay's ideal customer profile:
- Multi-location businesses (2+ locations, sweet spot is 5–50 locations)
- Industries: manufacturing, food & beverage, warehousing, facilities/property management, retail, healthcare, hospitality, field services
- 50–500 employees
- Operational teams that rely on daily task lists, safety checklists, SOPs, or cross-location communication
- Pain points: paper checklists, siloed communication, compliance tracking, new location onboarding, inconsistent execution across sites

Research tasks:
1. Find the company's actual employee count and number of locations/sites
2. Identify the headquarters city and state
3. Find their LinkedIn company page URL
4. Understand their operations — what do they do day-to-day across locations?
5. Identify likely operational pain points that Relay could solve
6. Determine which Relay features would resonate most (task management, checklists, communication, reporting, compliance)
7. Identify the titles of people who would make or influence a purchase decision (operations, facilities, regional managers, etc.)
8. Craft an outreach angle specific to their business

Compute an aiFitScore from 0–100 using these rules:
- Industry fit base:
  - manufacturing / food & beverage / warehousing / facilities / property management = 80–100 base
  - retail / healthcare / hospitality / field services = 60–80 base
  - professional services / tech / finance / other = 30–60 base
- +15 if 5+ locations, +10 if 3–4 locations, +5 if 2 locations
- +10 if employee count is in the 50–500 sweet spot
- +5 to +10 if strong operational complexity signals (multi-site SOPs, compliance requirements, shift-based teams, seasonal staffing, franchise-like operations)
- Cap at 100

Compute a confidenceScore from 0–100 reflecting how confident you are in the accuracy of the researched data (100 = found detailed verified info, 50 = some info found, 20 = very little public info available).

Return ONLY a valid JSON object with exactly these fields (no markdown, no explanation):
{
  "researchSummary": "2–4 sentence overview of the company, what they do, and their operational structure",
  "operationalPainPoints": "2–4 sentences on specific pain points Relay could solve for them",
  "relayFitReasons": "2–3 sentences on why Relay is a strong fit",
  "suggestedDemoEmphasis": "1–2 sentences on which Relay features to highlight in a demo",
  "suggestedOutreachAngle": "1–2 sentence cold outreach hook specific to this company",
  "decisionMakerTitles": ["array", "of", "job titles", "who buy ops software here"],
  "aiFitScore": 0,
  "confidenceScore": 0,
  "employeeCountMin": null,
  "employeeCountMax": null,
  "locationsCount": null,
  "headquartersCity": null,
  "headquartersState": null,
  "linkedinUrl": null
}`

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta":    "web-search-2025-03-05",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-5",
        max_tokens: 2000,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
          },
        ],
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      console.error("[prospect-research] Anthropic error:", res.status, body.slice(0, 300))
      return null
    }

    const data = (await res.json()) as AnthropicResponse

    // Extract the text content block — the model returns its final JSON answer there
    const textBlock = data.content.findLast((c) => c.type === "text" && c.text)
    const raw = textBlock?.text?.trim() ?? ""

    // Strip markdown fences if the model wrapped the JSON
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()

    const parsed = JSON.parse(jsonStr) as ResearchData
    return parsed
  } catch (err) {
    console.error("[prospect-research] researchCompany failed:", err)
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.prospect.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Prospect not found" }, { status: 404 })
  }

  const research = await researchCompany(
    existing.companyName,
    existing.website,
    existing.industry,
    existing.employeeCountMin,
    existing.employeeCountMax,
    existing.locationsCount,
  )

  if (!research) {
    return NextResponse.json({ error: "AI research failed" }, { status: 502 })
  }

  const prospect = await prisma.prospect.update({
    where: { id },
    data: {
      researchSummary:        research.researchSummary,
      operationalPainPoints:  research.operationalPainPoints,
      relayFitReasons:        research.relayFitReasons,
      suggestedDemoEmphasis:  research.suggestedDemoEmphasis,
      suggestedOutreachAngle: research.suggestedOutreachAngle,
      decisionMakerTitles:    research.decisionMakerTitles,
      aiFitScore:             Math.min(100, Math.max(0, Math.round(research.aiFitScore))),
      confidenceScore:        Math.min(100, Math.max(0, Math.round(research.confidenceScore))),
      employeeCountMin:       research.employeeCountMin ?? existing.employeeCountMin,
      employeeCountMax:       research.employeeCountMax ?? existing.employeeCountMax,
      locationsCount:         research.locationsCount   ?? existing.locationsCount,
      headquartersCity:       research.headquartersCity  ?? existing.headquartersCity,
      headquartersState:      research.headquartersState ?? existing.headquartersState,
      linkedinUrl:            research.linkedinUrl       ?? existing.linkedinUrl,
      dateResearched:         new Date(),
    },
  })

  return NextResponse.json({ prospect })
}
