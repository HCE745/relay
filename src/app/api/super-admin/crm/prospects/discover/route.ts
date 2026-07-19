import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const maxDuration = 60

export interface DiscoveredCompanyBasic {
  companyName:        string
  website:            string
  city:               string
  state:              string
  country:            string
  industry:           string
  estimatedEmployees: string
  summary:            string
  fitScore:           number
  crmStatus:          "none" | "in_crm" | "contacted"
  crmProspectId?:     string
  lastContactAt?:     string
}

export interface DiscoveredCompanyDetails extends DiscoveredCompanyBasic {
  painPoints:             string[]
  relayFitReasons:        string[]
  suggestedOutreachAngle: string
}

// Backward compat — email/send routes import this name
export type DiscoveredCompany = DiscoveredCompanyDetails

function extractDomain(url: string): string | null {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "") }
  catch { return null }
}

function extractArray(raw: string, prependBracket = false): Record<string, unknown>[] | null {
  const text = prependBracket ? "[" + raw : raw

  // 1. Direct parse
  try {
    const p = JSON.parse(text)
    if (Array.isArray(p) && p.length > 0) return p as Record<string, unknown>[]
    if (p && typeof p === "object") {
      for (const v of Object.values(p as Record<string, unknown>)) {
        if (Array.isArray(v) && v.length > 0) return v as Record<string, unknown>[]
      }
    }
  } catch { /* fall through */ }

  // 2. Code fence
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) {
    try {
      const p = JSON.parse(fence[1].trim())
      if (Array.isArray(p) && p.length > 0) return p as Record<string, unknown>[]
    } catch { /* fall through */ }
  }

  // 3. Bracket-count scan — skips non-JSON uses of "[" (e.g. "[Note: ...]")
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "[") continue
    let depth = 0, inStr = false, esc = false, end = -1
    for (let j = i; j < text.length; j++) {
      const c = text[j]
      if (esc)             { esc = false; continue }
      if (c === "\\" && inStr) { esc = true; continue }
      if (c === '"')       { inStr = !inStr; continue }
      if (inStr)           { continue }
      if (c === "[" || c === "{") depth++
      else if (c === "]" || c === "}") { depth--; if (depth === 0) { end = j; break } }
    }
    if (end !== -1) {
      try {
        const p = JSON.parse(text.slice(i, end + 1))
        if (Array.isArray(p) && p.length > 0) return p as Record<string, unknown>[]
      } catch { /* try next [ */ }
    }
  }

  return null
}

function normalise(raw: Record<string, unknown>): DiscoveredCompanyBasic {
  const fitScore = Number(raw.fitScore ?? raw.aiFitScore ?? raw.fit_score ?? 70)
  return {
    companyName:        String(raw.companyName ?? raw.company_name ?? raw.name ?? "Unknown"),
    website:            String(raw.website ?? raw.url ?? ""),
    city:               String(raw.city ?? raw.headquartersCity ?? ""),
    state:              String(raw.state ?? raw.headquartersState ?? ""),
    country:            String(raw.country ?? raw.headquartersCountry ?? "United States"),
    industry:           String(raw.industry ?? ""),
    estimatedEmployees: String(raw.estimatedEmployees ?? raw.employeeCount ?? raw.employees ?? ""),
    summary:            String(raw.summary ?? raw.researchSummary ?? raw.description ?? raw.oneSentenceSummary ?? ""),
    fitScore:           Math.min(100, Math.max(0, isNaN(fitScore) ? 70 : fitScore)),
    crmStatus:          "none",
  }
}

const SKIP_NAMES = new Set([
  "summary", "summary table", "table", "overview", "results", "companies",
  "company", "list", "note", "notes", "findings", "prospects", "company name",
  "final list", "all companies",
])

function extractFromProse(text: string): DiscoveredCompanyBasic[] {
  const results: DiscoveredCompanyBasic[] = []
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
      country: "United States",
      industry: "", estimatedEmployees: empMatch?.[1] ?? "",
      summary: sec.trim().slice(0, 400).replace(/\n+/g, " "),
      fitScore: scoreMatch ? parseInt(scoreMatch[1]) : 70,
      crmStatus: "none",
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
      country?: string; stateProvince?: string
    }
    const country = body.country || "United States"
    console.log("[discover] request body:", JSON.stringify(body))

    // Load existing prospects — for exclusion prompt + CRM annotation
    const existingProspects = await prisma.prospect.findMany({
      select: { id: true, companyName: true, website: true },
    })
    const domainToProspect = new Map<string, { id: string }>()
    for (const p of existingProspects) {
      if (p.website) {
        const d = extractDomain(p.website)
        if (d) domainToProspect.set(d, { id: p.id })
      }
    }
    const exclusionList = existingProspects.map(p => p.companyName).slice(0, 80).join(", ")

    // Load sent emails — for "contacted" annotation
    const sentEmails = await prisma.crmEmail.findMany({
      where:   { direction: "sent" },
      select:  { toAddress: true, sentAt: true },
      orderBy: { sentAt: "desc" },
      take:    1000,
    })
    const domainToLastContact = new Map<string, Date>()
    for (const email of sentEmails) {
      const atIdx = email.toAddress.indexOf("@")
      if (atIdx === -1) continue
      const domain = email.toAddress.slice(atIdx + 1).toLowerCase()
      if (!domainToLastContact.has(domain)) domainToLastContact.set(domain, email.sentAt)
    }

    const stateLabel  = country === "Canada" ? "province" : "state"
    const locationCtx = body.stateProvince
      ? `${stateLabel}: ${body.stateProvince}`
      : body.location
        ? `Region: ${body.location}`
        : null

    const criteria: string[] = []
    if (body.industry)                                  criteria.push(`Industry: ${body.industry}`)
    if (locationCtx)                                    criteria.push(locationCtx)
    if (body.employeeCountMin ?? body.employeeCountMax) criteria.push(`Employees: ${body.employeeCountMin ?? "any"}–${body.employeeCountMax ?? "any"}`)
    if (body.locationsMin)                              criteria.push(`Min locations: ${body.locationsMin}`)
    if (body.keywords)                                  criteria.push(`Keywords: ${body.keywords}`)
    if (body.additionalContext)                         criteria.push(`Notes: ${body.additionalContext}`)
    const criteriaText = criteria.length
      ? criteria.join("\n")
      : `Multi-location businesses in ${country} in any operational industry`

    const stateOrProvince = country === "Canada"
      ? "province abbreviation (e.g. ON, BC, AB)"
      : "2-letter state code"

    const systemPrompt = `You must respond with ONLY a valid JSON array. No markdown. No tables. No headers. No explanation. No code blocks. Just a raw JSON array starting with [ and ending with ]. Each element must be a JSON object with these exact keys: companyName, website, city, state, country, industry, estimatedEmployees, summary, fitScore (integer 0-100). If you cannot find companies return []. Do not return anything other than the JSON array.`

    const userPrompt = `Based on your training knowledge, list exactly 8 to 10 REAL companies that would be strong sales prospects for Relay, an operations management platform for multi-location businesses. Relay helps with: issue reporting and tracking across locations, maintenance request routing, QR-code asset management, facility checklists, and team communications across shifts and sites.

CRITICAL — COUNTRY FILTER: Only return companies headquartered in ${country}. Do not return companies from any other country under any circumstances.

CRITICAL — WEBSITE REQUIRED: You MUST include a real working website URL (with https://) for every company. If you cannot verify a real website for a company, do not include that company. No placeholder URLs.

CRITERIA:
${criteriaText}

EXCLUDE (already in our CRM): ${exclusionList || "(none yet)"}

For each company provide:
- companyName: exact legal or trade name
- website: real website URL with https:// — required for every entry
- city: headquarters city
- state: ${stateOrProvince}
- country: "${country}"
- industry: specific industry (e.g. "Cold Storage & Warehousing")
- estimatedEmployees: employee range (e.g. "80-150")
- summary: ONE sentence about what they do and their multi-location operations
- fitScore: integer 0-100 (higher = more locations + more operational complexity)

Your entire response must be only the JSON array — nothing before [, nothing after ].`

    console.log("[discover] sending to Anthropic (no web search)")
    console.log("[discover] user prompt length:", userPrompt.length)

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-5",
        max_tokens: 4000,
        system:     systemPrompt,
        messages:   [{ role: "user", content: userPrompt }],
      }),
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

    const textBlocks = data.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text" && typeof b.text === "string")
    console.log("[discover] text block count:", textBlocks.length)

    if (textBlocks.length === 0) {
      console.error("[discover] No text blocks. Full content:", JSON.stringify(data.content).slice(0, 800))
      return NextResponse.json({ error: "AI returned no text content", companies: [] }, { status: 502 })
    }

    const rawContinuation = textBlocks.at(-1)!.text.trim()
    console.log("[discover] raw (first 800 chars):\n", rawContinuation.slice(0, 800))

    let companies: DiscoveredCompanyBasic[] = []
    const parsed = extractArray(rawContinuation, false)
    if (parsed && parsed.length > 0) {
      companies = parsed.map(p => normalise(p))
      console.log("[discover] JSON extraction succeeded:", companies.length, "companies")
    } else {
      console.warn("[discover] JSON extraction failed — trying prose fallback")
      companies = extractFromProse(rawContinuation)
      console.log("[discover] Prose fallback:", companies.length, "companies")
    }

    // Drop entries with no name
    companies = companies.filter(c => c.companyName && c.companyName !== "Unknown")

    // Annotate CRM status for each result
    for (const company of companies) {
      const websiteDomain = company.website ? extractDomain(company.website) : null
      if (!websiteDomain) continue
      const prospectMatch = domainToProspect.get(websiteDomain)
      const lastContact   = domainToLastContact.get(websiteDomain)
      if (lastContact) {
        company.crmStatus     = "contacted"
        company.lastContactAt = lastContact.toISOString()
        if (prospectMatch) company.crmProspectId = prospectMatch.id
      } else if (prospectMatch) {
        company.crmStatus     = "in_crm"
        company.crmProspectId = prospectMatch.id
      }
    }

    console.log("[discover] final:", companies.length, "companies")
    return NextResponse.json({ companies })

  } catch (err) {
    const msg   = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack   : undefined
    console.error("[discover] UNHANDLED ERROR:", msg)
    if (stack) console.error("[discover] stack:", stack)
    return NextResponse.json({ error: msg, companies: [] }, { status: 500 })
  }
}
