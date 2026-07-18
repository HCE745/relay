import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

interface DiscoverBody {
  industry?:          string
  location?:          string
  employeeCountMin?:  number
  employeeCountMax?:  number
  locationsMin?:      number
  keywords?:          string
  additionalContext?: string
}

interface ProspectResult {
  companyName:            string
  website:                string
  industry:               string
  employeeCountMin:       number
  employeeCountMax:       number
  locationsCount:         number
  headquartersCity:       string
  headquartersState:      string
  aiFitScore:             number
  researchSummary:        string
  operationalPainPoints:  string
  relayFitReasons:        string
  suggestedDemoEmphasis:  string
  suggestedOutreachAngle: string
  decisionMakerTitles:    string[]
  confidenceScore:        number
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: unknown }
  | { type: string }

/** Extract the bare domain for dedup. Returns null on failure. */
function extractDomain(url: string): string | null {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`
    return new URL(normalized).hostname.replace(/^www\./, "")
  } catch { return null }
}

/** Get the last text block from an Anthropic content array. */
function lastTextBlock(content: ContentBlock[]): string | null {
  const texts = content.filter((c): c is { type: "text"; text: string } => c.type === "text")
  return texts.at(-1)?.text?.trim() ?? null
}

/** Call the Anthropic API. Returns the content array, or throws on non-200. */
async function callAnthropic(opts: {
  system: string
  messages: { role: string; content: string }[]
  tools?: unknown[]
  betaHeader?: string
  maxTokens?: number
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set")

  const headers: Record<string, string> = {
    "x-api-key":         apiKey,
    "anthropic-version": "2023-06-01",
    "content-type":      "application/json",
  }
  if (opts.betaHeader) headers["anthropic-beta"] = opts.betaHeader

  const body: Record<string, unknown> = {
    model:      "claude-sonnet-5",
    max_tokens: opts.maxTokens ?? 8000,
    system:     opts.system,
    messages:   opts.messages,
  }
  if (opts.tools?.length) body.tools = opts.tools

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers,
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(120_000),
  })

  const responseText = await res.text()
  if (!res.ok) {
    console.error("[discover] Anthropic HTTP error", res.status, responseText.slice(0, 400))
    throw new Error(`Anthropic returned ${res.status}: ${responseText.slice(0, 200)}`)
  }

  const data = JSON.parse(responseText) as { content: ContentBlock[]; stop_reason: string }
  console.log("[discover] stop_reason:", data.stop_reason, "| content blocks:", data.content.length,
    data.content.map(c => c.type).join(", "))
  return data.content
}

/** Extract a JSON array from raw text — handles fences, prefix text, and bare arrays. */
function extractJsonArray(raw: string): ProspectResult[] | null {
  // 1. Fenced code block: ```json [...] ``` or ``` [...] ```
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) {
    try { return JSON.parse(fence[1].trim()) as ProspectResult[] } catch { /* fall through */ }
  }

  // 2. Bare JSON array (possibly with prefix text)
  const arrayStart = raw.indexOf("[")
  const arrayEnd   = raw.lastIndexOf("]")
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    try { return JSON.parse(raw.slice(arrayStart, arrayEnd + 1)) as ProspectResult[] } catch { /* fall through */ }
  }

  return null
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as DiscoverBody
  const { industry, location, employeeCountMin, employeeCountMax, locationsMin, keywords, additionalContext } = body

  console.log("[discover] Request:", { industry, location, employeeCountMin, employeeCountMax, locationsMin, keywords })

  // ── Load existing prospects for exclusion ───────────────────────────────────
  const existing = await prisma.prospect.findMany({ select: { companyName: true, website: true } })
  const existingNames   = new Set(existing.map(p => p.companyName.toLowerCase().trim()))
  const existingDomains = new Set(
    existing.map(p => p.website ? extractDomain(p.website) : null).filter((d): d is string => d !== null)
  )
  const exclusionSnippet = existing.map(p => p.companyName).slice(0, 150).join(", ")

  // ── Build criteria text ─────────────────────────────────────────────────────
  const criteria: string[] = []
  if (industry)                              criteria.push(`Industry: ${industry}`)
  if (location)                              criteria.push(`Location/Region: ${location}`)
  if (employeeCountMin ?? employeeCountMax)  criteria.push(`Employee count: ${employeeCountMin ?? "any"}–${employeeCountMax ?? "any"}`)
  if (locationsMin)                          criteria.push(`Minimum locations/facilities: ${locationsMin}`)
  if (keywords)                              criteria.push(`Keywords/focus: ${keywords}`)
  if (additionalContext)                     criteria.push(`Additional context: ${additionalContext}`)
  const criteriaText = criteria.length > 0
    ? criteria.join("\n")
    : "Multi-location B2B businesses across the US in any operational industry"

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1 — Web-search research: let the model find real companies naturally
  // ════════════════════════════════════════════════════════════════════════════
  console.log("[discover] Step 1: web-search research starting")

  const researchSystem = `You are a B2B sales intelligence researcher for Relay, an operations management platform for multi-location businesses. Relay helps companies manage facility issues, maintenance requests, assets, QR-code reporting, and team communications across multiple physical locations. Ideal customers: 3–20 locations, 50–500 employees, industries like manufacturing, food & beverage, retail chains, warehousing, property management, healthcare facilities, hospitality.`

  const researchPrompt = `Use web search to find 10–15 real companies that would be strong sales prospects for Relay.

SEARCH CRITERIA:
${criteriaText}

DO NOT INCLUDE these companies (already in our CRM):
${exclusionSnippet || "(none)"}

For each company you find, research and note:
- Company name and website URL
- Industry and what they do
- Approximate employee count and number of physical locations
- Headquarters city and state
- Likely operational pain points (maintenance, issue tracking, multi-location coordination)
- Why Relay would be a good fit
- Which Relay features to emphasize (multi-location dashboard, maintenance routing, QR codes, asset tracking)
- Best outreach angle
- Job titles of likely decision makers
- Your confidence in the data accuracy (0–100)
- Fit score for Relay (0–100 based on: multiple locations, operational complexity, industry match, company size)

Search for real companies with verifiable websites. Focus on companies with physical operations across multiple sites.`

  let researchText: string
  try {
    const content = await callAnthropic({
      system:     researchSystem,
      messages:   [{ role: "user", content: researchPrompt }],
      tools:      [{ type: "web_search_20250305", name: "web_search" }],
      betaHeader: "web-search-2025-03-05",
      maxTokens:  8000,
    })

    const text = lastTextBlock(content)
    if (!text) {
      console.error("[discover] Step 1: no text block found in response")
      console.error("[discover] Content blocks:", JSON.stringify(content).slice(0, 500))
      return NextResponse.json({ error: "AI research returned no text content", prospects: [] }, { status: 502 })
    }

    researchText = text
    console.log("[discover] Step 1 complete, research text length:", researchText.length)
    console.log("[discover] Step 1 preview:", researchText.slice(0, 300))
  } catch (err) {
    console.error("[discover] Step 1 failed:", err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2 — Format the research into strict JSON (no web search, fast)
  // ════════════════════════════════════════════════════════════════════════════
  console.log("[discover] Step 2: JSON formatting starting")

  const formatSystem = `You are a data extraction assistant. You receive raw company research notes and output them as a strict JSON array. You output ONLY the JSON array — no explanation, no markdown, no preamble.`

  const formatPrompt = `Convert the following company research into a JSON array sorted by aiFitScore descending.

RESEARCH NOTES:
${researchText}

Output a JSON array where each element has EXACTLY these fields (use null for missing values, never omit a field):
[
  {
    "companyName": "string — exact company name",
    "website": "string — full URL with https://",
    "industry": "string — industry sector",
    "employeeCountMin": number | null,
    "employeeCountMax": number | null,
    "locationsCount": number | null,
    "headquartersCity": "string | null",
    "headquartersState": "string | null — 2-letter state code if US",
    "aiFitScore": number (0-100),
    "researchSummary": "string — 2-3 sentences about the company and why they are a fit",
    "operationalPainPoints": "string — specific operational challenges they face",
    "relayFitReasons": "string — why Relay directly addresses their needs",
    "suggestedDemoEmphasis": "string — which Relay features to show in a demo",
    "suggestedOutreachAngle": "string — best opening message angle",
    "decisionMakerTitles": ["string array of likely decision maker job titles"],
    "confidenceScore": number (0-100)
  }
]

Rules:
- Output ONLY the JSON array, starting with [ and ending with ]
- Include every company found in the research notes
- aiFitScore: 80-100 for manufacturing/warehousing/facilities with 5+ locations, 60-79 for retail/healthcare/hospitality, lower for others
- Do not invent companies not mentioned in the research notes`

  let candidates: ProspectResult[] = []
  try {
    const content = await callAnthropic({
      system:   formatSystem,
      messages: [{ role: "user", content: formatPrompt }],
      maxTokens: 6000,
    })

    const rawJson = lastTextBlock(content)
    console.log("[discover] Step 2 raw JSON preview:", rawJson?.slice(0, 400))

    if (!rawJson) {
      console.error("[discover] Step 2: no text in format response")
      return NextResponse.json({ prospects: [], parseError: true })
    }

    const parsed = extractJsonArray(rawJson)
    if (!parsed || !Array.isArray(parsed)) {
      console.error("[discover] Step 2: JSON parse failed. Raw:", rawJson.slice(0, 600))
      return NextResponse.json({ prospects: [], parseError: true })
    }

    candidates = parsed
    console.log("[discover] Step 2 complete, candidates:", candidates.length)
  } catch (err) {
    console.error("[discover] Step 2 failed:", err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }

  // ── Deduplicate against existing DB records ──────────────────────────────────
  const prospects = candidates.filter(p => {
    if (!p?.companyName) return false
    if (existingNames.has(p.companyName.toLowerCase().trim())) return false
    if (p.website) {
      const domain = extractDomain(p.website)
      if (domain && existingDomains.has(domain)) return false
    }
    return true
  })

  console.log("[discover] Final prospects after dedup:", prospects.length, "of", candidates.length)
  return NextResponse.json({ prospects })
}
