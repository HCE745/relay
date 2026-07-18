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
  employeeCountMin:       number | null
  employeeCountMax:       number | null
  locationsCount:         number | null
  headquartersCity:       string | null
  headquartersState:      string | null
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
  | { type: string }

function extractDomain(url: string): string | null {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`
    return new URL(normalized).hostname.replace(/^www\./, "")
  } catch { return null }
}

function lastTextBlock(content: ContentBlock[]): string | null {
  const texts = content.filter((c): c is { type: "text"; text: string } => c.type === "text")
  return texts.at(-1)?.text?.trim() ?? null
}

/**
 * Robust JSON array extractor. Handles:
 * - Assistant prefill (text that needs "[" prepended)
 * - Code fences
 * - Text with brackets before the real array (e.g. "[Note: ...]")
 * - Wrapper objects ({"prospects": [...], "companies": [...]})
 * Uses bracket-counting so nested structures don't confuse it.
 */
function extractJsonArray(raw: string, prependBracket = false): ProspectResult[] | null {
  const text = prependBracket ? "[" + raw : raw

  // 1. Direct parse (works perfectly when model outputs clean JSON)
  try {
    const parsed = JSON.parse(text) as unknown
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as ProspectResult[]
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const val of Object.values(parsed as Record<string, unknown>)) {
        if (Array.isArray(val) && val.length > 0) return val as ProspectResult[]
      }
    }
  } catch { /* fall through */ }

  // 2. Code fence  ```json [...] ``` or ``` [...] ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) {
    try {
      const parsed = JSON.parse(fence[1].trim()) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as ProspectResult[]
    } catch { /* fall through */ }
  }

  // 3. Bracket-counting scan — finds the first complete valid JSON array in the text.
  //    Skips over non-JSON uses of "[" (like "[Note: ...]") because those won't parse.
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "[") continue
    let depth = 0
    let inStr = false
    let esc = false
    let end = -1
    for (let j = i; j < text.length; j++) {
      const c = text[j]
      if (esc)              { esc = false; continue }
      if (c === "\\" && inStr) { esc = true;  continue }
      if (c === '"')        { inStr = !inStr; continue }
      if (inStr)            { continue }
      if (c === "[" || c === "{") depth++
      else if (c === "]" || c === "}") {
        depth--
        if (depth === 0) { end = j; break }
      }
    }
    if (end !== -1) {
      try {
        const parsed = JSON.parse(text.slice(i, end + 1)) as unknown
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as ProspectResult[]
      } catch { /* try next [ */ }
    }
  }

  return null
}

/**
 * Normalise field name aliases the model might use despite the prompt.
 * Also coerces number fields and fills missing required fields with defaults.
 */
function normalizeProspect(raw: Record<string, unknown>): ProspectResult {
  const fitScore = (raw.fitScore ?? raw.aiFitScore ?? raw.fit_score ?? 70) as number
  const painPoints = (raw.painPoints ?? raw.operationalPainPoints ?? raw.pain_points ?? "") as string
  const employeeCount = raw.employeeCount as number | undefined

  return {
    companyName:            String(raw.companyName ?? raw.company_name ?? raw.name ?? "Unknown"),
    website:                String(raw.website ?? raw.url ?? ""),
    industry:               String(raw.industry ?? ""),
    employeeCountMin:       toNum(raw.employeeCountMin ?? raw.employee_count_min ?? employeeCount),
    employeeCountMax:       toNum(raw.employeeCountMax ?? raw.employee_count_max ?? employeeCount),
    locationsCount:         toNum(raw.locationsCount ?? raw.locations_count ?? raw.locations ?? raw.numLocations),
    headquartersCity:       strOrNull(raw.headquartersCity ?? raw.headquarters_city ?? raw.city),
    headquartersState:      strOrNull(raw.headquartersState ?? raw.headquarters_state ?? raw.state),
    aiFitScore:             Math.min(100, Math.max(0, Number(fitScore) || 70)),
    researchSummary:        String(raw.researchSummary ?? raw.research_summary ?? raw.summary ?? ""),
    operationalPainPoints:  String(painPoints),
    relayFitReasons:        String(raw.relayFitReasons ?? raw.relay_fit_reasons ?? raw.fitReasons ?? ""),
    suggestedDemoEmphasis:  String(raw.suggestedDemoEmphasis ?? raw.demoEmphasis ?? ""),
    suggestedOutreachAngle: String(raw.suggestedOutreachAngle ?? raw.outreachAngle ?? ""),
    decisionMakerTitles:    toStrArray(raw.decisionMakerTitles ?? raw.decision_maker_titles),
    confidenceScore:        Math.min(100, Math.max(0, Number(raw.confidenceScore ?? raw.confidence ?? 80) || 80)),
  }
}

function toNum(v: unknown): number | null {
  const n = Number(v)
  return !v || isNaN(n) ? null : n
}

function strOrNull(v: unknown): string | null {
  if (!v) return null
  const s = String(v).trim()
  return s || null
}

function toStrArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === "string" && v.trim()) return v.split(/[,;]/).map(s => s.trim()).filter(Boolean)
  return []
}

/**
 * Last-resort text parser: extracts company sections from Step 1's prose research.
 * Works when the model uses markdown headings or numbered lists.
 */
function extractFromResearchText(text: string): ProspectResult[] {
  const results: ProspectResult[] = []
  const sectionRe = /(?=\n#{1,3}\s+[A-Z]|\n\d+\.\s+\*?\*?[A-Z])/
  const sections = text.split(sectionRe)

  for (const section of sections) {
    const trimmed = section.trim()
    if (!trimmed || trimmed.length < 30) continue

    const headingMatch =
      trimmed.match(/^#{1,3}\s+(.+?)$/m) ??
      trimmed.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?$/m) ??
      trimmed.match(/^\*\*(.+?)\*\*/m)
    if (!headingMatch) continue

    const companyName = headingMatch[1].replace(/\*\*/g, "").trim()
    if (companyName.length < 2 || companyName.length > 120) continue

    const websiteMatch      = trimmed.match(/https?:\/\/[^\s\)\]]+/)
    const cityStateMatch    = trimmed.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+([A-Z]{2})\b/)
    const fitScoreMatch     = trimmed.match(/(?:fit\s*score|relay\s*fit|score)[:\s]+(\d+)/i)
    const empRangeMatch     = trimmed.match(/(\d[\d,]*)\s*(?:–|-|to)\s*(\d[\d,]*)\s*employees?/i)
    const empSingleMatch    = trimmed.match(/(\d[\d,]+)\s+employees?/i)
    const locationCountMatch = trimmed.match(/(\d+)\s+(?:locations?|sites?|facilities|branches?|plants?)/i)

    const empMin = empRangeMatch
      ? parseInt(empRangeMatch[1].replace(/,/g, ""))
      : empSingleMatch
      ? parseInt(empSingleMatch[1].replace(/,/g, ""))
      : null
    const empMax = empRangeMatch
      ? parseInt(empRangeMatch[2].replace(/,/g, ""))
      : empMin

    results.push({
      companyName,
      website:                websiteMatch?.[0] ?? "",
      industry:               "",
      employeeCountMin:       empMin,
      employeeCountMax:       empMax,
      locationsCount:         locationCountMatch ? parseInt(locationCountMatch[1]) : null,
      headquartersCity:       cityStateMatch?.[1] ?? null,
      headquartersState:      cityStateMatch?.[2] ?? null,
      aiFitScore:             fitScoreMatch ? parseInt(fitScoreMatch[1]) : 70,
      researchSummary:        trimmed.slice(0, 500).replace(/\n+/g, " ").trim(),
      operationalPainPoints:  "",
      relayFitReasons:        "",
      suggestedDemoEmphasis:  "",
      suggestedOutreachAngle: "",
      decisionMakerTitles:    [],
      confidenceScore:        60,
    })
  }

  return results
}

async function callAnthropic(opts: {
  system:      string
  messages:    { role: string; content: string }[]
  tools?:      unknown[]
  betaHeader?: string
  maxTokens?:  number
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
    console.error("[discover] Anthropic error", res.status, responseText.slice(0, 600))
    throw new Error(`Anthropic ${res.status}: ${responseText.slice(0, 200)}`)
  }

  const data = JSON.parse(responseText) as { content: ContentBlock[]; stop_reason: string }
  console.log("[discover] stop_reason:", data.stop_reason, "| blocks:", data.content.map(c => c.type).join(", "))
  return data.content
}

// ────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as DiscoverBody
  const { industry, location, employeeCountMin, employeeCountMax, locationsMin, keywords, additionalContext } = body
  console.log("[discover] request:", { industry, location, employeeCountMin, employeeCountMax, locationsMin, keywords })

  // ── Existing prospects for exclusion + dedup ────────────────────────────────
  const existing = await prisma.prospect.findMany({ select: { companyName: true, website: true } })
  const existingNames   = new Set(existing.map(p => p.companyName.toLowerCase().trim()))
  const existingDomains = new Set(
    existing.flatMap(p => {
      const d = p.website ? extractDomain(p.website) : null
      return d ? [d] : []
    })
  )
  const exclusionList = existing.map(p => p.companyName).slice(0, 150).join(", ")

  // ── Build criteria text ─────────────────────────────────────────────────────
  const criteria: string[] = []
  if (industry)                             criteria.push(`Industry: ${industry}`)
  if (location)                             criteria.push(`Region: ${location}`)
  if (employeeCountMin ?? employeeCountMax) criteria.push(`Employees: ${employeeCountMin ?? "any"}–${employeeCountMax ?? "any"}`)
  if (locationsMin)                         criteria.push(`Min locations: ${locationsMin}`)
  if (keywords)                             criteria.push(`Keywords: ${keywords}`)
  if (additionalContext)                    criteria.push(`Context: ${additionalContext}`)
  const criteriaText = criteria.length > 0
    ? criteria.join("\n")
    : "Multi-location businesses across the US — any operational industry"

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Web-search research (natural language output)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("[discover] step 1: research starting")

  const researchPrompt = `You are a B2B sales researcher for Relay, an operations platform for multi-location businesses. Use web search to find 10–15 real companies that would be strong sales prospects.

SEARCH CRITERIA:
${criteriaText}

EXCLUDE (already in CRM): ${exclusionList || "(none)"}

For every company you find, note:
- Company name and website URL
- Industry and what they do
- Approximate employee count and number of physical locations
- Headquarters city and state
- Operational pain points (maintenance, issue tracking, multi-site coordination)
- Why Relay fits their needs
- Best Relay features to demo
- Outreach angle
- Decision-maker titles
- Relay fit score (0–100): higher for multi-location + operational complexity`

  let researchText: string
  try {
    const content = await callAnthropic({
      system:     "You are a B2B sales researcher. Use web search to find real companies matching the criteria. Be thorough and concrete — include real company names, websites, and facts.",
      messages:   [{ role: "user", content: researchPrompt }],
      tools:      [{ type: "web_search_20250305", name: "web_search" }],
      betaHeader: "web-search-2025-03-05",
      maxTokens:  8000,
    })
    const text = lastTextBlock(content)
    if (!text) {
      console.error("[discover] step 1: no text block. blocks:", JSON.stringify(content).slice(0, 800))
      return NextResponse.json({ error: "AI research returned no text", prospects: [] }, { status: 502 })
    }
    researchText = text
    console.log("[discover] step 1 complete. text length:", researchText.length)
    // Log full text so Vercel logs show exactly what the model returned
    console.log("[discover] step 1 full text:\n", researchText)
  } catch (err) {
    console.error("[discover] step 1 error:", err)
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2 — JSON extraction via assistant prefill
  // Using role:"assistant" prefill forces the model to start its response
  // with "[" — guaranteeing the output begins the JSON array directly.
  // ══════════════════════════════════════════════════════════════════════════
  console.log("[discover] step 2: JSON formatting starting")

  const formatPrompt = `Convert these company research notes into a JSON array. Include every company found.

REQUIRED FIELDS for each object (use null for unknown values):
- companyName (string)
- website (string, full https:// URL)
- industry (string)
- employeeCountMin (number or null)
- employeeCountMax (number or null)
- locationsCount (number or null)
- headquartersCity (string or null)
- headquartersState (string or null, 2-letter US state)
- aiFitScore (number 0-100, higher = better fit for Relay)
- researchSummary (string, 2-3 sentences)
- operationalPainPoints (string, key challenges they face)
- relayFitReasons (string, why Relay solves their problems)
- suggestedDemoEmphasis (string, which Relay features to show)
- suggestedOutreachAngle (string, best first message angle)
- decisionMakerTitles (array of strings)
- confidenceScore (number 0-100)

RESEARCH NOTES:
${researchText}`

  let candidates: ProspectResult[] = []
  let usedTextFallback = false

  try {
    const content = await callAnthropic({
      system: "You are a JSON formatter. Output ONLY a valid JSON array — no explanation, no markdown, no preamble. Start with [ and end with ].",
      messages: [
        { role: "user",      content: formatPrompt },
        { role: "assistant", content: "[" },  // prefill forces JSON array start
      ],
      maxTokens: 8192,
    })

    const rawContinuation = lastTextBlock(content)
    console.log("[discover] step 2 raw continuation length:", rawContinuation?.length ?? 0)
    // Log enough to diagnose any issues
    console.log("[discover] step 2 continuation (first 2000 chars):\n", rawContinuation?.slice(0, 2000))

    if (rawContinuation) {
      // Prepend the "[" we sent as prefill — the model continued from there
      const parsed = extractJsonArray(rawContinuation, true)
      if (parsed && parsed.length > 0) {
        candidates = parsed.map(p => normalizeProspect(p as unknown as Record<string, unknown>))
        console.log("[discover] step 2 parsed", candidates.length, "candidates")
      } else {
        console.warn("[discover] step 2 JSON parse failed, falling back to text extraction")
        console.log("[discover] step 2 full continuation for diagnosis:\n", rawContinuation)
      }
    }
  } catch (err) {
    console.error("[discover] step 2 error:", err)
  }

  // ── Text fallback: parse Step 1's research prose directly ──────────────────
  if (candidates.length === 0) {
    console.log("[discover] using text fallback on step 1 research")
    candidates = extractFromResearchText(researchText)
    usedTextFallback = true
    console.log("[discover] text fallback extracted", candidates.length, "candidates")
  }

  // ── Deduplicate ─────────────────────────────────────────────────────────────
  const prospects = candidates.filter(p => {
    if (!p?.companyName || p.companyName === "Unknown") return false
    if (existingNames.has(p.companyName.toLowerCase().trim())) return false
    if (p.website) {
      const domain = extractDomain(p.website)
      if (domain && existingDomains.has(domain)) return false
    }
    return true
  })

  console.log("[discover] final:", prospects.length, "of", candidates.length, "candidates after dedup")
  return NextResponse.json({ prospects, parseError: usedTextFallback && prospects.length > 0 ? true : undefined })
}
