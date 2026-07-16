import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

interface DiscoverBody {
  industry?:         string
  location?:         string
  employeeCountMin?: number
  employeeCountMax?: number
  locationsMin?:     number
  keywords?:         string
  additionalContext?: string
}

interface ProspectResult {
  companyName:           string
  website:               string
  industry:              string
  employeeCountMin:      number
  employeeCountMax:      number
  locationsCount:        number
  headquartersCity:      string
  headquartersState:     string
  aiFitScore:            number
  researchSummary:       string
  operationalPainPoints: string
  relayFitReasons:       string
  suggestedDemoEmphasis: string
  suggestedOutreachAngle: string
  decisionMakerTitles:   string[]
  confidenceScore:       number
}

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: unknown }

interface AnthropicResponse {
  content:    AnthropicContentBlock[]
  stop_reason: string
}

/** Extract the hostname from a URL for domain-level dedup, or null on failure. */
function extractDomain(url: string): string | null {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`
    return new URL(normalized).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as DiscoverBody
  const {
    industry,
    location,
    employeeCountMin,
    employeeCountMax,
    locationsMin,
    keywords,
    additionalContext,
  } = body

  // ── 1. Load existing prospects for exclusion ──────────────────────────────
  const existingProspects = await prisma.prospect.findMany({
    select: { companyName: true, website: true },
  })

  const existingNames   = new Set(existingProspects.map(p => p.companyName.toLowerCase().trim()))
  const existingDomains = new Set(
    existingProspects
      .map(p => (p.website ? extractDomain(p.website) : null))
      .filter((d): d is string => d !== null)
  )

  const exclusionList = existingProspects
    .map(p => p.companyName)
    .slice(0, 200) // guard against enormous prompts
    .join(", ")

  // ── 2. Build the search prompt ────────────────────────────────────────────
  const criteria: string[] = []
  if (industry)         criteria.push(`Industry: ${industry}`)
  if (location)         criteria.push(`Location/Region: ${location}`)
  if (employeeCountMin !== undefined || employeeCountMax !== undefined) {
    const min = employeeCountMin ?? "any"
    const max = employeeCountMax ?? "any"
    criteria.push(`Employee count: ${min}–${max}`)
  }
  if (locationsMin !== undefined) criteria.push(`Minimum locations: ${locationsMin}`)
  if (keywords)         criteria.push(`Keywords / focus areas: ${keywords}`)
  if (additionalContext) criteria.push(`Additional context: ${additionalContext}`)

  const criteriaText = criteria.length > 0
    ? criteria.join("\n")
    : "General multi-location B2B businesses across any industry in the US"

  const prompt = `Use web search to find 10–15 real companies that would be excellent sales prospects for Relay, a multi-location operations management SaaS platform.

SEARCH CRITERIA:
${criteriaText}

COMPANIES TO EXCLUDE (already in our CRM — do not include these):
${exclusionList || "(none yet)"}

WHAT TO SEARCH FOR:
Search for real, verifiable companies that match the criteria above. Look for companies with:
- Multiple physical locations (ideally 3+)
- 50–500 employees
- Operational / facilities management needs
- Industries like manufacturing, food & beverage, retail chains, warehousing, property management, or healthcare facilities

For each company found, provide the following as a JSON array (sorted by aiFitScore descending):

[
  {
    "companyName": "Exact legal or trade name",
    "website": "https://www.example.com",
    "industry": "Industry sector",
    "employeeCountMin": 50,
    "employeeCountMax": 200,
    "locationsCount": 12,
    "headquartersCity": "City",
    "headquartersState": "ST",
    "aiFitScore": 85,
    "researchSummary": "2–3 sentence summary of the company and why they are a fit",
    "operationalPainPoints": "Specific operational challenges they likely face",
    "relayFitReasons": "Why Relay's platform directly addresses their needs",
    "suggestedDemoEmphasis": "Which Relay features to emphasize in a demo",
    "suggestedOutreachAngle": "Best first-contact messaging angle",
    "decisionMakerTitles": ["Operations Manager", "Facilities Director"],
    "confidenceScore": 90
  }
]

IMPORTANT RULES:
- Return ONLY the JSON array — no explanation, no markdown fences, no extra text before or after.
- All companies must be real and verifiable via their website.
- Do not include any company from the exclusion list above.
- aiFitScore (0–100): how well this company fits Relay's ideal customer profile.
- confidenceScore (0–100): your confidence that the company data is accurate.
- If you cannot find 10 matching companies that are not already in the exclusion list, return however many you found.`

  // ── 3. Call Anthropic API with web search ─────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error("[discover] ANTHROPIC_API_KEY not set")
    return NextResponse.json({ error: "API key not configured" }, { status: 500 })
  }

  let rawText: string | null = null

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta":    "web-search-2025-03-05",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-5",
        max_tokens: 8000,
        system:     "You are a B2B sales intelligence researcher for Relay, a multi-location operations management SaaS. Your job is to find real companies that would benefit from Relay. Relay helps multi-location businesses manage issues, maintenance, assets, and team communications across facilities. Best customers have: 3+ locations, 50-500 employees, operational/facilities management needs, industries like manufacturing, food & beverage, retail chains, warehousing, property management, healthcare facilities.",
        tools: [
          { type: "web_search_20250305", name: "web_search" },
        ],
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(120_000), // 2-minute timeout for web search
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => "")
      console.error("[discover] Anthropic error:", res.status, errBody.slice(0, 300))
      return NextResponse.json({ error: "AI search failed", details: errBody.slice(0, 200) }, { status: 502 })
    }

    const data = await res.json() as AnthropicResponse

    // Web search responses interleave tool_use (search queries) and text (results/analysis).
    // We want the last text block, which contains the final JSON output.
    const textBlocks = data.content.filter((c): c is { type: "text"; text: string } => c.type === "text")
    rawText = textBlocks.at(-1)?.text?.trim() ?? null

    if (!rawText) {
      console.error("[discover] No text block in Anthropic response")
      return NextResponse.json({ prospects: [] })
    }
  } catch (err) {
    console.error("[discover] Fetch failed:", err)
    return NextResponse.json({ error: "AI request failed" }, { status: 502 })
  }

  // ── 4. Parse JSON from the response ──────────────────────────────────────
  let candidates: ProspectResult[] = []

  try {
    // Direct parse first (model should return raw JSON per the prompt)
    candidates = JSON.parse(rawText) as ProspectResult[]
  } catch {
    // Fallback: extract JSON array from markdown code fences or surrounding text
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? rawText.match(/(\[[\s\S]*\])/)
    if (match) {
      try {
        candidates = JSON.parse(match[1]) as ProspectResult[]
      } catch (e2) {
        console.error("[discover] JSON parse failed after fallback:", e2)
        console.error("[discover] Raw response snippet:", rawText.slice(0, 500))
        // Return empty rather than crashing — caller can retry
        return NextResponse.json({ prospects: [], parseError: true })
      }
    } else {
      console.error("[discover] Could not locate JSON array in response")
      console.error("[discover] Raw response snippet:", rawText.slice(0, 500))
      return NextResponse.json({ prospects: [], parseError: true })
    }
  }

  if (!Array.isArray(candidates)) {
    return NextResponse.json({ prospects: [] })
  }

  // ── 5. Filter duplicates against existing DB records ──────────────────────
  const prospects = candidates.filter(p => {
    if (!p?.companyName) return false

    const nameLower = p.companyName.toLowerCase().trim()
    if (existingNames.has(nameLower)) return false

    if (p.website) {
      const domain = extractDomain(p.website)
      if (domain && existingDomains.has(domain)) return false
    }

    return true
  })

  return NextResponse.json({ prospects })
}
