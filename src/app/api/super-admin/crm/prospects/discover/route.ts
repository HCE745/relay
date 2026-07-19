import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// Single LLM call with no tools — typically 10-20 s on claude-sonnet-5
export const maxDuration = 60

export interface DiscoveredCompany {
  companyName:            string
  website:                string
  city:                   string
  state:                  string
  industry:               string
  estimatedEmployees:     string
  summary:                string
  painPoints:             string[]
  relayFitReasons:        string[]
  suggestedOutreachAngle: string
  fitScore:               number
}

function extractDomain(url: string): string | null {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "") }
  catch { return null }
}

/**
 * Bracket-counting JSON array extractor.
 * Handles: direct parse, code fences, wrapper objects {"companies": [...]},
 * and any prefix text before the opening "[".
 */
function extractArray(raw: string, prependBracket = false): DiscoveredCompany[] | null {
  const text = prependBracket ? "[" + raw : raw

  // 1. Direct parse
  try {
    const p = JSON.parse(text)
    if (Array.isArray(p) && p.length > 0) return p as DiscoveredCompany[]
    if (p && typeof p === "object") {
      for (const v of Object.values(p as Record<string, unknown>)) {
        if (Array.isArray(v) && v.length > 0) return v as DiscoveredCompany[]
      }
    }
  } catch { /* fall through */ }

  // 2. Code fence
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) {
    try {
      const p = JSON.parse(fence[1].trim())
      if (Array.isArray(p) && p.length > 0) return p as DiscoveredCompany[]
    } catch { /* fall through */ }
  }

  // 3. Bracket-count scan — skips non-JSON uses of "[" (e.g. "[Note: ...]")
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "[") continue
    let depth = 0, inStr = false, esc = false, end = -1
    for (let j = i; j < text.length; j++) {
      const c = text[j]
      if (esc)              { esc = false; continue }
      if (c === "\\" && inStr) { esc = true;  continue }
      if (c === '"')        { inStr = !inStr; continue }
      if (inStr)            { continue }
      if (c === "[" || c === "{") depth++
      else if (c === "]" || c === "}") { depth--; if (depth === 0) { end = j; break } }
    }
    if (end !== -1) {
      try {
        const p = JSON.parse(text.slice(i, end + 1))
        if (Array.isArray(p) && p.length > 0) return p as DiscoveredCompany[]
      } catch { /* try next [ */ }
    }
  }

  return null
}

/** Map whatever field names the model used onto the canonical shape. */
function normalise(raw: Record<string, unknown>): DiscoveredCompany {
  const painPoints = raw.painPoints ?? raw.pain_points ?? raw.operationalPainPoints ?? []
  const fitReasons = raw.relayFitReasons ?? raw.relay_fit_reasons ?? raw.fitReasons ?? []
  const fitScore   = Number(raw.fitScore ?? raw.aiFitScore ?? raw.fit_score ?? 70)
  return {
    companyName:            String(raw.companyName ?? raw.company_name ?? raw.name ?? "Unknown"),
    website:                String(raw.website ?? raw.url ?? ""),
    city:                   String(raw.city ?? raw.headquartersCity ?? ""),
    state:                  String(raw.state ?? raw.headquartersState ?? ""),
    industry:               String(raw.industry ?? ""),
    estimatedEmployees:     String(raw.estimatedEmployees ?? raw.employeeCount ?? raw.employees ?? ""),
    summary:                String(raw.summary ?? raw.researchSummary ?? raw.description ?? ""),
    painPoints:             Array.isArray(painPoints) ? painPoints.map(String) : [],
    relayFitReasons:        Array.isArray(fitReasons)  ? fitReasons.map(String)  : [],
    suggestedOutreachAngle: String(raw.suggestedOutreachAngle ?? raw.outreachAngle ?? ""),
    fitScore:               Math.min(100, Math.max(0, isNaN(fitScore) ? 70 : fitScore)),
  }
}

// Words that look like section headings / table headers but are not company names.
const SKIP_NAMES = new Set([
  "summary", "summary table", "table", "overview", "results", "companies",
  "company", "list", "note", "notes", "findings", "prospects", "company name",
  "final list", "all companies",
])

/** Last-resort: extract company sections from prose / markdown */
function extractFromProse(text: string): DiscoveredCompany[] {
  const results: DiscoveredCompany[] = []
  const sections = text.split(/(?=\n#{1,3}\s+[A-Z]|\n\d+\.\s+\*?\*?[A-Z])/)
  for (const sec of sections) {
    const heading = sec.match(/^#{1,3}\s+(.+?)$/m) ?? sec.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?$/m)
    if (!heading) continue
    const companyName = heading[1].replace(/\*\*/g, "").replace(/[|#*]/g, "").trim()
    if (companyName.length < 3 || companyName.length > 100) continue
    if (SKIP_NAMES.has(companyName.toLowerCase())) continue
    if (/^\d+$/.test(companyName)) continue
    const website    = sec.match(/https?:\/\/[^\s\)\]]+/)?.[0] ?? ""
    const csMatch    = sec.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*),\s+([A-Z]{2})\b/)
    const scoreMatch = sec.match(/(?:fit\s*score|score)[:\s]+(\d+)/i)
    const empMatch   = sec.match(/(\d[\d,]*(?:\s*[-–]\s*\d[\d,]*)?)\s*employees?/i)
    results.push({
      companyName, website,
      city:    csMatch?.[1] ?? "", state: csMatch?.[2] ?? "",
      industry: "", estimatedEmployees: empMatch?.[1] ?? "",
      summary: sec.trim().slice(0, 400).replace(/\n+/g, " "),
      painPoints: [], relayFitReasons: [], suggestedOutreachAngle: "",
      fitScore: scoreMatch ? parseInt(scoreMatch[1]) : 70,
    })
  }
  return results
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error("[discover] ANTHROPIC_API_KEY is not set")
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 })
    }
    console.log("[discover] API key present, length:", apiKey.length)

    const body = await req.json() as {
      industry?: string; location?: string; employeeCountMin?: number; employeeCountMax?: number
      locationsMin?: number; keywords?: string; additionalContext?: string
    }
    console.log("[discover] request body:", JSON.stringify(body))

    // Load existing for exclusion + dedup
    const existing      = await prisma.prospect.findMany({ select: { companyName: true, website: true } })
    const existingNames = new Set(existing.map(p => p.companyName.toLowerCase().trim()))
    const existingDomains = new Set(
      existing.flatMap(p => { const d = p.website ? extractDomain(p.website) : null; return d ? [d] : [] })
    )
    const exclusionList = existing.map(p => p.companyName).slice(0, 80).join(", ")

    const criteria: string[] = []
    if (body.industry)                                  criteria.push(`Industry: ${body.industry}`)
    if (body.location)                                  criteria.push(`Region: ${body.location}`)
    if (body.employeeCountMin ?? body.employeeCountMax) criteria.push(`Employees: ${body.employeeCountMin ?? "any"}–${body.employeeCountMax ?? "any"}`)
    if (body.locationsMin)                              criteria.push(`Min locations: ${body.locationsMin}`)
    if (body.keywords)                                  criteria.push(`Keywords: ${body.keywords}`)
    if (body.additionalContext)                         criteria.push(`Notes: ${body.additionalContext}`)
    const criteriaText = criteria.length
      ? criteria.join("\n")
      : "Multi-location businesses across the US in any operational industry"

    // ─────────────────────────────────────────────────────────────────────────
    // Single API call — no web search tool.
    //
    // Why no web search:
    //   The web_search_20250305 tool causes the API to return tool_use blocks
    //   and may require an agentic loop that the route doesn't implement.
    //   Using training-data knowledge avoids the tool_use complexity entirely,
    //   is 5-10× faster, and still returns real companies (Claude's knowledge
    //   cutoff is August 2025 — sufficient for B2B sales prospecting).
    //
    // Assistant prefill "[" forces the response to start the JSON array
    // immediately — no preamble, no markdown, no tables possible.
    // ─────────────────────────────────────────────────────────────────────────
    const systemPrompt = `You must respond with ONLY a valid JSON array. No markdown. No tables. No headers. No explanation. No code blocks. Just a raw JSON array starting with [ and ending with ]. Each element must be a JSON object with these exact keys: companyName, website, city, state, industry, estimatedEmployees, summary, painPoints (array of exactly 3 strings), relayFitReasons (array of exactly 3 strings), suggestedOutreachAngle, fitScore (integer 0-100). If you cannot find companies return []. Do not return anything other than the JSON array.`

    const userPrompt = `Based on your training knowledge, list exactly 8 to 10 REAL companies that would be strong sales prospects for Relay, an operations management platform for multi-location businesses. Relay helps with: issue reporting and tracking across locations, maintenance request routing, QR-code asset management, facility checklists, and team communications across shifts and sites.

CRITERIA:
${criteriaText}

EXCLUDE (already in our CRM): ${exclusionList || "(none yet)"}

Return real companies with multiple physical locations and operational complexity. For each company provide:
- companyName: exact legal or trade name
- website: real website URL with https://
- city: headquarters city
- state: 2-letter US state code
- industry: specific industry (e.g. "Cold Storage & Warehousing")
- estimatedEmployees: employee range (e.g. "80-150")
- summary: 3-4 sentences about what they do and their multi-location operations
- painPoints: array of 3 specific operational pain points this company type has
- relayFitReasons: array of 3 reasons Relay solves their specific problems
- suggestedOutreachAngle: one sentence on the best way to open the conversation
- fitScore: integer 0-100 (higher = more locations + more operational complexity)

Your entire response must be only the JSON array — nothing before [, nothing after ].`

    console.log("[discover] sending prompt to Anthropic (no web search, assistant prefill)")
    console.log("[discover] user prompt length:", userPrompt.length, "chars")

    const requestBody = {
      model:      "claude-sonnet-5",
      max_tokens: 6000,
      system:     systemPrompt,
      messages: [
        { role: "user", content: userPrompt },
      ],
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body:   JSON.stringify(requestBody),
      signal: AbortSignal.timeout(55_000),
    })

    const responseText = await res.text()
    console.log("[discover] Anthropic response status:", res.status)

    if (!res.ok) {
      console.error("[discover] Anthropic API error:", res.status, responseText.slice(0, 600))
      return NextResponse.json(
        { error: `Anthropic API returned ${res.status}: ${responseText.slice(0, 300)}`, companies: [] },
        { status: 502 }
      )
    }

    const data = JSON.parse(responseText) as {
      content:     { type: string; text?: string }[]
      stop_reason: string
    }

    console.log("[discover] stop_reason:", data.stop_reason)
    console.log("[discover] content block types:", data.content.map(b => b.type).join(", "))

    // Find the last text block (the model's actual response after any tool_use blocks)
    const textBlocks = data.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text" && typeof b.text === "string")
    console.log("[discover] text block count:", textBlocks.length)

    if (textBlocks.length === 0) {
      console.error("[discover] No text blocks in response. Full content:", JSON.stringify(data.content).slice(0, 800))
      return NextResponse.json({ error: "AI returned no text content", companies: [] }, { status: 502 })
    }

    const rawContinuation = textBlocks.at(-1)!.text.trim()
    console.log("[discover] raw continuation length:", rawContinuation.length)
    console.log("[discover] raw continuation (first 1000 chars):\n", rawContinuation.slice(0, 1000))

    let companies: DiscoveredCompany[] = []
    const parsed = extractArray(rawContinuation, false)
    if (parsed && parsed.length > 0) {
      companies = parsed.map(p => normalise(p as unknown as Record<string, unknown>))
      console.log("[discover] JSON extraction succeeded:", companies.length, "companies")
    } else {
      console.warn("[discover] JSON extraction failed. Trying prose fallback.")
      console.warn("[discover] Full raw continuation:\n", rawContinuation)
      companies = extractFromProse(rawContinuation)
      console.log("[discover] Prose fallback found:", companies.length, "companies")
    }

    // Deduplicate against existing CRM records
    const filtered = companies.filter(c => {
      if (!c.companyName || c.companyName === "Unknown") return false
      if (existingNames.has(c.companyName.toLowerCase().trim())) return false
      if (c.website) {
        const d = extractDomain(c.website)
        if (d && existingDomains.has(d)) return false
      }
      return true
    })

    console.log("[discover] final result:", filtered.length, "companies (", companies.length, "before dedup)")
    return NextResponse.json({ companies: filtered })

  } catch (err) {
    const msg   = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack   : undefined
    console.error("[discover] UNHANDLED ERROR:", msg)
    if (stack) console.error("[discover] stack:", stack)
    return NextResponse.json({ error: msg, companies: [] }, { status: 500 })
  }
}
