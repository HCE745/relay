import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

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

/** Fallback: parse company sections from prose when JSON extraction fails */
function extractFromProse(text: string): DiscoveredCompany[] {
  const results: DiscoveredCompany[] = []
  const sections = text.split(/(?=\n#{1,3}\s+[A-Z]|\n\d+\.\s+\*?\*?[A-Z])/)
  for (const sec of sections) {
    const heading = sec.match(/^#{1,3}\s+(.+?)$/m) ?? sec.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?$/m)
    if (!heading) continue
    const companyName = heading[1].replace(/\*\*/g, "").trim()
    if (companyName.length < 2 || companyName.length > 100) continue
    const website      = sec.match(/https?:\/\/[^\s\)\]]+/)?.[0] ?? ""
    const csMatch      = sec.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*),\s+([A-Z]{2})\b/)
    const scoreMatch   = sec.match(/(?:fit\s*score|score)[:\s]+(\d+)/i)
    const empMatch     = sec.match(/(\d[\d,]*(?:\s*[-–]\s*\d[\d,]*)?)\s*employees?/i)
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
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set")
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
  if (!res.ok) { console.error("[discover] API error", res.status, text.slice(0, 400)); throw new Error(`Anthropic ${res.status}`) }
  const data = JSON.parse(text) as { content: ContentBlock[]; stop_reason: string }
  console.log("[discover] stop_reason:", data.stop_reason, "blocks:", data.content.map(c => c.type).join(", "))
  return data.content
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

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

  // ── Step 1: Research (web search → prose) ──────────────────────────────────
  console.log("[discover] step 1: research")
  const researchContent = await callAnthropic({
    system: "You are a B2B sales researcher. Use web search to find real companies. Be specific: real company names, real websites, concrete facts about their operations.",
    messages: [{ role: "user", content: `Find exactly 8 to 10 real companies that are strong sales prospects for Relay, an operations management platform for multi-location businesses (issue tracking, maintenance routing, QR-code check-ins, asset management, team messaging across locations).

SEARCH CRITERIA:
${criteriaText}

DO NOT include these (already in CRM): ${exclusionList || "(none)"}

For each company, research and note:
- Company name and real website URL
- Headquarters city and state
- Industry
- Approximate employee count (e.g. "80-150")
- 3-4 sentence description of what they do and how they operate
- 3 specific operational pain points they likely have (maintenance issues, multi-site coordination, issue tracking)
- 3 reasons Relay would specifically help them
- The best one-sentence outreach angle
- Relay fit score 0-100 (higher = more locations + more operational complexity)

Search for these companies, verify they are real, and make your notes specific and concrete.` }],
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    betaHeader: "web-search-2025-03-05",
    maxTokens: 8000,
  })

  const researchText = lastTextBlock(researchContent)
  if (!researchText) {
    console.error("[discover] step 1: no text. blocks:", JSON.stringify(researchContent).slice(0, 500))
    return NextResponse.json({ error: "Research step returned no text", companies: [] }, { status: 502 })
  }
  console.log("[discover] step 1 text length:", researchText.length)
  console.log("[discover] step 1 full text:\n", researchText)

  // ── Step 2: Format as JSON (assistant prefill forces array start) ───────────
  console.log("[discover] step 2: JSON format")
  let companies: DiscoveredCompany[] = []

  try {
    const fmtContent = await callAnthropic({
      system: "You are a JSON formatter. Output ONLY a valid JSON array. No explanation. No markdown. Start with [ and end with ].",
      messages: [
        { role: "user", content: `Convert these research notes into a JSON array. Include every company found. Each object must have exactly these fields:

- companyName (string)
- website (string, full https:// URL or empty string)
- city (string, headquarters city or empty string)
- state (string, 2-letter US state code or empty string)
- industry (string)
- estimatedEmployees (string, e.g. "80-150" or "~200")
- summary (string, 3-4 sentences about what they do and their operations)
- painPoints (array of exactly 3 strings — specific operational pain points)
- relayFitReasons (array of exactly 3 strings — why Relay solves their problems)
- suggestedOutreachAngle (string, one sentence on how to approach them)
- fitScore (integer 0-100)

RESEARCH NOTES:
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
        console.warn("[discover] step 2 JSON failed, full raw:\n", raw)
      }
    }
  } catch (err) {
    console.error("[discover] step 2 error:", err)
  }

  // Fallback: extract from prose
  if (!companies.length) {
    console.log("[discover] prose fallback")
    companies = extractFromProse(researchText)
    console.log("[discover] prose fallback found:", companies.length)
  }

  // Deduplicate
  const filtered = companies.filter(c => {
    if (!c.companyName || c.companyName === "Unknown") return false
    if (existingNames.has(c.companyName.toLowerCase().trim())) return false
    if (c.website) { const d = extractDomain(c.website); if (d && existingDomains.has(d)) return false }
    return true
  })

  console.log("[discover] final:", filtered.length, "of", companies.length)
  return NextResponse.json({ companies: filtered })
}
