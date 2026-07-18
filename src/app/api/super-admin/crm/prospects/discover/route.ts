import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

// Web search + two-step LLM can take 60-90 s — raise Vercel's serverless timeout
export const maxDuration = 120

export interface DiscoveredCompany {
  companyName:          string
  website:              string
  city:                 string
  state:                string
  industry:             string
  estimatedEmployees:   string
  summary:              string
  painPoints:           string[]
  relayFitReasons:      string[]
  suggestedOutreachAngle: string
  fitScore:             number
}

type ContentBlock = { type: "text"; text: string } | { type: string }

function lastTextBlock(blocks: ContentBlock[]): string | null {
  return blocks.filter((b): b is { type: "text"; text: string } => b.type === "text").at(-1)?.text?.trim() ?? null
}

function extractDomain(url: string): string | null {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "") }
  catch { return null }
}

/** Bracket-counting JSON array extractor — skips non-JSON uses of "[" */
function extractArray(raw: string, prefixBracket = false): DiscoveredCompany[] | null {
  const text = prefixBracket ? "[" + raw : raw

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
    try { const p = JSON.parse(fence[1].trim()); if (Array.isArray(p) && p.length) return p as DiscoveredCompany[] }
    catch { /* fall through */ }
  }

  // 3. Bracket-count scan — skips "[Note: ...]" style non-JSON brackets
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "[") continue
    let depth = 0, inStr = false, esc = false, end = -1
    for (let j = i; j < text.length; j++) {
      const c = text[j]
      if (esc) { esc = false; continue }
      if (c === "\\" && inStr) { esc = true; continue }
      if (c === '"') { inStr = !inStr; continue }
      if (inStr) continue
      if (c === "[" || c === "{") depth++
      else if (c === "]" || c === "}") { depth--; if (depth === 0) { end = j; break } }
    }
    if (end !== -1) {
      try { const p = JSON.parse(text.slice(i, end + 1)); if (Array.isArray(p) && p.length) return p as DiscoveredCompany[] }
      catch { /* try next */ }
    }
  }

  return null
}

/** Normalise the model's output fields onto the canonical DiscoveredCompany shape. */
function normalise(raw: Record<string, unknown>): DiscoveredCompany {
  const painPoints = raw.painPoints ?? raw.pain_points ?? raw.operationalPainPoints ?? []
  const fitReasons = raw.relayFitReasons ?? raw.relay_fit_reasons ?? raw.fitReasons ?? []
  const fitScore   = Number(raw.fitScore ?? raw.aiFitScore ?? raw.fit_score ?? 70)

  return {
    companyName:           String(raw.companyName ?? raw.company_name ?? raw.name ?? "Unknown"),
    website:               String(raw.website ?? raw.url ?? ""),
    city:                  String(raw.city ?? raw.headquartersCity ?? raw.headquarters_city ?? ""),
    state:                 String(raw.state ?? raw.headquartersState ?? raw.headquarters_state ?? ""),
    industry:              String(raw.industry ?? ""),
    estimatedEmployees:    String(raw.estimatedEmployees ?? raw.employeeCount ?? raw.employees ?? ""),
    summary:               String(raw.summary ?? raw.researchSummary ?? raw.research_summary ?? ""),
    painPoints:            Array.isArray(painPoints) ? painPoints.map(String) : [],
    relayFitReasons:       Array.isArray(fitReasons)  ? fitReasons.map(String)  : [],
    suggestedOutreachAngle:String(raw.suggestedOutreachAngle ?? raw.outreachAngle ?? raw.outreach_angle ?? ""),
    fitScore:              Math.min(100, Math.max(0, isNaN(fitScore) ? 70 : fitScore)),
  }
}

// Generic/header words that look like section headings but are NOT company names.
// The prose fallback sees markdown table headers (### Summary Table) and numbered
// section titles as potential companies — this set filters them out.
const PROSE_SKIP = new Set([
  "summary", "summary table", "table", "overview", "results", "companies",
  "company", "list", "note", "notes", "disclaimer", "all companies",
  "company name", "final list", "findings", "prospects",
])

/** Fallback: parse company sections from prose when JSON extraction fails */
function extractFromProse(text: string): DiscoveredCompany[] {
  const results: DiscoveredCompany[] = []
  const sections = text.split(/(?=\n#{1,3}\s+[A-Z]|\n\d+\.\s+\*?\*?[A-Z])/)
  for (const sec of sections) {
    const heading = sec.match(/^#{1,3}\s+(.+?)$/m) ?? sec.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?$/m)
    if (!heading) continue
    const companyName = heading[1].replace(/\*\*/g, "").replace(/[|#*]/g, "").trim()
    if (companyName.length < 3 || companyName.length > 100) continue
    // Skip generic section titles and table headers
    if (PROSE_SKIP.has(companyName.toLowerCase())) continue
    // Skip if the "name" is just a number or single word that looks like a header
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

async function callAnthropic(opts: {
  system: string
  messages: { role: string; content: string }[]
  tools?: unknown[]; betaHeader?: string; maxTokens?: number
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is not set")
  const headers: Record<string, string> = {
    "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json",
  }
  if (opts.betaHeader) headers["anthropic-beta"] = opts.betaHeader
  const body: Record<string, unknown> = {
    model: "claude-sonnet-5", max_tokens: opts.maxTokens ?? 8000,
    system: opts.system, messages: opts.messages,
  }
  if (opts.tools?.length) body.tools = opts.tools
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers, body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  const text = await res.text()
  if (!res.ok) {
    // Include the full response body so the actual Anthropic error is visible in logs
    console.error("[discover] Anthropic API error — status:", res.status, "\nbody:", text)
    throw new Error(`Anthropic API returned ${res.status}: ${text.slice(0, 500)}`)
  }
  const data = JSON.parse(text) as { content: ContentBlock[]; stop_reason: string }
  console.log("[discover] stop_reason:", data.stop_reason, "blocks:", data.content.map(c => c.type).join(", "))
  return data.content
}

export async function POST(req: NextRequest) {
  // Top-level catch: every unhandled throw returns a 500 with the actual message
  // instead of a generic Next.js error page — and logs the full stack to Vercel.
  try {
    const session = await getSession()
    if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Early API key check — fail fast with a clear message
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[discover] ANTHROPIC_API_KEY is not set in environment")
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server" }, { status: 500 })
    }
    console.log("[discover] ANTHROPIC_API_KEY present, length:", process.env.ANTHROPIC_API_KEY.length)

    const body = await req.json() as {
      industry?: string; location?: string; employeeCountMin?: number; employeeCountMax?: number
      locationsMin?: number; keywords?: string; additionalContext?: string
    }
    console.log("[discover] request:", body)

    const existing = await prisma.prospect.findMany({ select: { companyName: true, website: true } })
    const existingNames   = new Set(existing.map(p => p.companyName.toLowerCase().trim()))
    const existingDomains = new Set(existing.flatMap(p => { const d = p.website ? extractDomain(p.website) : null; return d ? [d] : [] }))
    const exclusionList   = existing.map(p => p.companyName).slice(0, 100).join(", ")

    const criteria: string[] = []
    if (body.industry)                                  criteria.push(`Industry: ${body.industry}`)
    if (body.location)                                  criteria.push(`Region: ${body.location}`)
    if (body.employeeCountMin ?? body.employeeCountMax) criteria.push(`Employees: ${body.employeeCountMin ?? "any"}–${body.employeeCountMax ?? "any"}`)
    if (body.locationsMin)                              criteria.push(`Min locations/sites: ${body.locationsMin}`)
    if (body.keywords)                                  criteria.push(`Keywords: ${body.keywords}`)
    if (body.additionalContext)                         criteria.push(`Context: ${body.additionalContext}`)
    const criteriaText = criteria.length ? criteria.join("\n") : "Multi-location B2B businesses in the US"

    // ── Step 1: Research (web search → prose) ────────────────────────────────
    console.log("[discover] step 1: starting web-search research")
    let researchText: string
    try {
      const researchContent = await callAnthropic({
        system: "You are a B2B sales researcher. Use web search to find real companies. Be specific: real company names, real websites, concrete facts about their operations. Present your findings as a plain numbered list — no markdown tables, no table headers, no summary sections.",
        messages: [{ role: "user", content: `Find exactly 8 to 10 real companies that are strong sales prospects for Relay, an operations management platform for multi-location businesses (issue tracking, maintenance routing, QR-code check-ins, asset management, team messaging across locations).

SEARCH CRITERIA:
${criteriaText}

DO NOT include these (already in CRM): ${exclusionList || "(none)"}

For each company, write a numbered entry like this:
1. [Company Name]
- Website: https://...
- City, State: ...
- Industry: ...
- Employees: (approximate range)
- Summary: (3-4 sentences about what they do and their multi-location operations)
- Pain points: (3 specific operational challenges)
- Relay fit: (3 reasons Relay would help them)
- Outreach angle: (one sentence on how to approach them)
- Fit score: (0-100, higher = more locations + more operational complexity)

IMPORTANT FORMATTING RULES:
- Use the numbered list format above for every company
- Do NOT create markdown tables
- Do NOT add a "Summary Table" or any table at the end
- Do NOT add any sections other than the numbered company entries
- Search for each company to verify it is real before including it` }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        betaHeader: "web-search-2025-03-05",
        maxTokens: 8000,
      })
      const text = lastTextBlock(researchContent)
      if (!text) {
        console.error("[discover] step 1: no text block in response. Content:", JSON.stringify(researchContent).slice(0, 800))
        return NextResponse.json({ error: "AI research returned no text content — the web search may have failed", companies: [] }, { status: 502 })
      }
      researchText = text
      console.log("[discover] step 1 complete. Text length:", researchText.length)
      console.log("[discover] step 1 full text:\n", researchText)
    } catch (step1Err) {
      const msg = step1Err instanceof Error ? step1Err.message : String(step1Err)
      console.error("[discover] step 1 FAILED:", msg)
      if (step1Err instanceof Error) console.error("[discover] step 1 stack:", step1Err.stack)
      return NextResponse.json({ error: `Research step failed: ${msg}`, companies: [] }, { status: 502 })
    }

    // ── Step 2: Format as JSON (assistant prefill forces array start) ─────────
    console.log("[discover] step 2: JSON formatting")
    let companies: DiscoveredCompany[] = []
    try {
      const fmtContent = await callAnthropic({
        system: `You must respond with ONLY a valid JSON array. No markdown. No tables. No headers. No explanation. No code blocks. Just a raw JSON array starting with [ and ending with ]. Each element must be a JSON object with these exact keys: companyName, website, city, state, industry, estimatedEmployees, summary, painPoints, relayFitReasons, suggestedOutreachAngle, fitScore. If you cannot find real companies matching the criteria return an empty array []. Do not return anything other than the JSON array.`,
        messages: [
          { role: "user", content: `Convert every company in these research notes into a JSON array. Include ALL companies found — do not skip any.

Each JSON object must have exactly these fields (use empty string or empty array if data is missing — never omit a field):
- companyName: string (the company name)
- website: string (full https:// URL, or "" if unknown)
- city: string (headquarters city, or "")
- state: string (2-letter US state code, or "")
- industry: string (industry sector)
- estimatedEmployees: string (e.g. "80-150" or "~200", or "")
- summary: string (3-4 sentences about what they do)
- painPoints: array of exactly 3 strings (operational pain points)
- relayFitReasons: array of exactly 3 strings (why Relay helps them)
- suggestedOutreachAngle: string (one sentence outreach angle)
- fitScore: integer from 0 to 100

RESEARCH NOTES TO CONVERT:
${researchText}` },
          { role: "assistant", content: "[" },
        ],
        maxTokens: 8192,
      })

      const raw = lastTextBlock(fmtContent)
      console.log("[discover] step 2 raw (first 2000 chars):\n", raw?.slice(0, 2000))
      if (raw) {
        const parsed = extractArray(raw, true)
        if (parsed?.length) {
          companies = parsed.map(p => normalise(p as unknown as Record<string, unknown>))
          console.log("[discover] step 2 parsed", companies.length, "companies")
        } else {
          console.warn("[discover] step 2: JSON extraction failed. Full raw response:\n", raw)
        }
      } else {
        console.warn("[discover] step 2: no text block in format response")
      }
    } catch (step2Err) {
      const msg = step2Err instanceof Error ? step2Err.message : String(step2Err)
      console.error("[discover] step 2 FAILED (non-fatal, using prose fallback):", msg)
      if (step2Err instanceof Error) console.error("[discover] step 2 stack:", step2Err.stack)
    }

    // Fallback: extract from prose
    if (!companies.length) {
      console.log("[discover] using prose fallback on step 1 research text")
      companies = extractFromProse(researchText)
      console.log("[discover] prose fallback found:", companies.length, "companies")
    }

    // Deduplicate
    const filtered = companies.filter(c => {
      if (!c.companyName || c.companyName === "Unknown") return false
      if (existingNames.has(c.companyName.toLowerCase().trim())) return false
      if (c.website) { const d = extractDomain(c.website); if (d && existingDomains.has(d)) return false }
      return true
    })

    console.log("[discover] final:", filtered.length, "of", companies.length, "after dedup")
    return NextResponse.json({ companies: filtered })

  } catch (err) {
    // Catch-all: log full stack and return the actual error message to the client
    const msg   = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack   : undefined
    console.error("[discover] UNHANDLED ERROR:", msg)
    if (stack) console.error("[discover] stack:", stack)
    return NextResponse.json({ error: msg, companies: [] }, { status: 500 })
  }
}
