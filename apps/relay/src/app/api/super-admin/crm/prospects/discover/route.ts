import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getPlatformConfig } from "@/lib/platform-config"
import Anthropic from "@anthropic-ai/sdk"

// 90s gives web-search calls room to breathe; 60s is too close to the wall
export const maxDuration = 90

export type EmployeeCountTier    = "web_confirmed" | "web_estimated" | "unknown"
export type QualificationTier    = "qualified" | "potential" | "location_unverified"

export interface DiscoveredCompanyBasic {
  companyName:        string
  website:            string
  city:               string
  state:              string
  country:            string
  industry:           string
  estimatedEmployees: string
  employeeCountTier:  EmployeeCountTier
  qualificationTier:  QualificationTier
  sourceCitations:    string[]
  locationVerified:   boolean
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

// Third-party company data/directory sites — not acceptable as the company's official website
const THIRD_PARTY_PROFILE_DOMAINS = new Set([
  "linkedin.com", "pitchbook.com", "glassdoor.com", "zoominfo.com",
  "crunchbase.com", "dnb.com", "hoovers.com", "manta.com",
  "bloomberg.com", "owler.com", "craft.co", "signalhire.com",
  "rocketreach.co", "apollo.io",
])

function isThirdPartyProfileUrl(url: string): boolean {
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "")
    const parts = hostname.split(".")
    for (let i = 0; i < parts.length - 1; i++) {
      if (THIRD_PARTY_PROFILE_DOMAINS.has(parts.slice(i).join("."))) return true
    }
    return false
  } catch { return false }
}

const US_ABBREVS: Record<string, string> = {
  "alabama": "al", "alaska": "ak", "arizona": "az", "arkansas": "ar", "california": "ca",
  "colorado": "co", "connecticut": "ct", "delaware": "de", "florida": "fl", "georgia": "ga",
  "hawaii": "hi", "idaho": "id", "illinois": "il", "indiana": "in", "iowa": "ia",
  "kansas": "ks", "kentucky": "ky", "louisiana": "la", "maine": "me", "maryland": "md",
  "massachusetts": "ma", "michigan": "mi", "minnesota": "mn", "mississippi": "ms", "missouri": "mo",
  "montana": "mt", "nebraska": "ne", "nevada": "nv", "new hampshire": "nh", "new jersey": "nj",
  "new mexico": "nm", "new york": "ny", "north carolina": "nc", "north dakota": "nd", "ohio": "oh",
  "oklahoma": "ok", "oregon": "or", "pennsylvania": "pa", "rhode island": "ri", "south carolina": "sc",
  "south dakota": "sd", "tennessee": "tn", "texas": "tx", "utah": "ut", "vermont": "vt",
  "virginia": "va", "washington": "wa", "west virginia": "wv", "wisconsin": "wi", "wyoming": "wy",
}

function normaliseState(raw: string): string {
  const lower = raw.trim().toLowerCase()
  return US_ABBREVS[lower] ?? lower
}

function extractArray(raw: string): Record<string, unknown>[] | null {
  // 1. Direct parse
  try {
    const p = JSON.parse(raw)
    if (Array.isArray(p) && p.length > 0) return p as Record<string, unknown>[]
    if (p && typeof p === "object") {
      for (const v of Object.values(p as Record<string, unknown>)) {
        if (Array.isArray(v) && v.length > 0) return v as Record<string, unknown>[]
      }
    }
  } catch { /* fall through */ }

  // 2. Code fence
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) {
    try {
      const p = JSON.parse(fence[1].trim())
      if (Array.isArray(p) && p.length > 0) return p as Record<string, unknown>[]
    } catch { /* fall through */ }
  }

  // 3. Bracket-count scan
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== "[") continue
    let depth = 0, inStr = false, esc = false, end = -1
    for (let j = i; j < raw.length; j++) {
      const c = raw[j]
      if (esc)                  { esc = false; continue }
      if (c === "\\" && inStr)  { esc = true; continue }
      if (c === '"')            { inStr = !inStr; continue }
      if (inStr)                { continue }
      if (c === "[" || c === "{") depth++
      else if (c === "]" || c === "}") { depth--; if (depth === 0) { end = j; break } }
    }
    if (end !== -1) {
      try {
        const p = JSON.parse(raw.slice(i, end + 1))
        if (Array.isArray(p) && p.length > 0) return p as Record<string, unknown>[]
      } catch { /* try next [ */ }
    }
  }

  return null
}

const VALID_TIER = new Set<string>(["web_confirmed", "web_estimated", "unknown"])

function normalise(raw: Record<string, unknown>): DiscoveredCompanyBasic {
  const fitScore  = Number(raw.fitScore ?? raw.aiFitScore ?? raw.fit_score ?? 70)
  const tierRaw   = String(raw.employeeCountTier ?? raw.employee_count_tier ?? "unknown").toLowerCase()
  const citations = Array.isArray(raw.sourceCitations)
    ? (raw.sourceCitations as unknown[]).filter((u): u is string => typeof u === "string")
    : []
  let websiteRaw = String(raw.website ?? raw.url ?? "")
  // If the AI returned a third-party profile URL as the official website, demote it to a citation
  if (websiteRaw && isThirdPartyProfileUrl(websiteRaw)) {
    if (!citations.includes(websiteRaw)) citations.push(websiteRaw)
    websiteRaw = ""
  }
  return {
    companyName:        String(raw.companyName ?? raw.company_name ?? raw.name ?? "Unknown"),
    website:            websiteRaw,
    city:               String(raw.city ?? raw.headquartersCity ?? ""),
    state:              String(raw.state ?? raw.headquartersState ?? ""),
    country:            String(raw.country ?? raw.headquartersCountry ?? "United States"),
    industry:           String(raw.industry ?? ""),
    estimatedEmployees: String(raw.estimatedEmployees ?? raw.employeeCount ?? raw.employees ?? ""),
    employeeCountTier:  VALID_TIER.has(tierRaw) ? (tierRaw as EmployeeCountTier) : "unknown",
    qualificationTier:  "potential" as QualificationTier, // overwritten server-side after geo check
    sourceCitations:    citations,
    locationVerified:   false, // set server-side below
    summary:            String(raw.summary ?? raw.researchSummary ?? raw.description ?? raw.oneSentenceSummary ?? ""),
    fitScore:           Math.min(100, Math.max(0, isNaN(fitScore) ? 70 : fitScore)),
    crmStatus:          "none",
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.superAdmin && !session?.salesUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const discoveryEnabled = (await getPlatformConfig("ai_prospect_discovery_enabled")) !== "false"
    if (!discoveryEnabled) {
      return NextResponse.json(
        { error: "AI prospect discovery is disabled in CRM Settings", disabled: true, companies: [] },
        { status: 403 }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error("[discover] ANTHROPIC_API_KEY is not set")
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 })
    }

    const body = await req.json() as {
      industry?: string; location?: string; employeeCountMin?: number; employeeCountMax?: number
      locationsMin?: number; keywords?: string; additionalContext?: string
      country?: string; stateProvince?: string; requestedCount?: number
    }
    const country        = body.country || "United States"
    const requestedCount = Math.min(body.requestedCount ?? 20, 20)
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
    const exclusionList = existingProspects.map(p => p.companyName).slice(0, 100).join(", ")
    const existingDomains = existingProspects
      .flatMap(p => { const d = p.website ? extractDomain(p.website) : null; return d ? [d] : [] })
      .slice(0, 300)

    // Load sent emails for "contacted" annotation
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

    const empMin         = body.employeeCountMin ?? 50
    const empMax         = body.employeeCountMax ?? 300
    const empRange       = `${empMin}–${empMax} employees`
    const industryTarget = body.industry ?? "manufacturing"
    const locationTarget = body.stateProvince
      ? `${body.stateProvince}, ${country}`
      : body.location ?? country
    const stateLabel     = country === "Canada" ? "province abbreviation" : "2-letter US state code (e.g. IN)"
    const keywordsLine   = body.keywords         ? `\nFocus on: ${body.keywords}` : ""
    const contextLine    = body.additionalContext ? `\nAdditional context: ${body.additionalContext}` : ""

    const systemPrompt = `You are a B2B prospect researcher. Use the web_search tool to find real, verifiable ${industryTarget} companies. Return ONLY a valid JSON array — starting with [ and ending with ]. No markdown, headers, or explanation. If no qualifying companies are found, return [].`

    const userPrompt = `Find up to ${requestedCount} real ${industryTarget} companies headquartered in ${locationTarget} with approximately ${empRange} that could benefit from Relay — operational coordination software for manufacturing facilities (issue reporting and routing, maintenance request management, digital shift handoffs, QR-code asset tracking).

USE WEB SEARCH with this two-step process for every company:

STEP 1 — DISCOVERY (use 2-3 broad searches):
Search for "${industryTarget} companies ${locationTarget}" or similar to build a candidate list of real companies with Indiana headquarters.${keywordsLine}${contextLine}

STEP 2 — HEADCOUNT VERIFICATION (required for each candidate — use a dedicated search per company):
For each company found in Step 1, run a targeted search:
  - Search: "{company name} linkedin.com employees" or "{company name} site:linkedin.com"
  - LinkedIn company pages show employee ranges like "51-200 employees", "201-500 employees" — use these
  - If LinkedIn gives nothing, try: "{company name} glassdoor employees ${locationTarget}"
  - Classify based on what you actually found:
    * "web_confirmed" — LinkedIn or Glassdoor shows an employee count or range entirely within ${empRange}
    * "web_estimated" — LinkedIn or Glassdoor shows a range that OVERLAPS with ${empRange} (e.g., "51-200" overlaps 50-300; "201-500" overlaps 50-300)
    * "unknown" — company is verified as a real ${locationTarget} ${industryTarget} business but NO headcount evidence found after searching LinkedIn and Glassdoor

IMPORTANT: Most established manufacturers have LinkedIn company pages. Allocate enough searches so you do a headcount lookup for every company you plan to include. Only mark "unknown" after genuinely trying LinkedIn and Glassdoor.

GEOGRAPHIC RULE: Only return companies with confirmed headquarters in ${locationTarget}. Do not include companies merely with facilities there.

HONESTY RULE: Return what you verified. Do not fabricate. If you cannot reach ${requestedCount}, return fewer.

EXCLUDE — already in our CRM: ${exclusionList || "(none)"}
EXCLUDE — these domains already tracked: ${existingDomains.length > 0 ? existingDomains.join(", ") : "(none)"}

Return ONLY a JSON array. Each object must have exactly these keys:
- companyName: exact company name
- website: working HTTPS URL (required — omit the company if not verified)
- city: headquarters city
- state: ${stateLabel}
- country: "${country}"
- industry: specific ${industryTarget} subsector (e.g. "Metal Fabrication", "Food Processing", "Automotive Parts")
- estimatedEmployees: employee range string (e.g. "80-150") or "unknown"
- employeeCountTier: "web_confirmed" | "web_estimated" | "unknown"
- sourceCitations: array of URLs from your web searches — include the LinkedIn/Glassdoor URL when found
- summary: one sentence describing their ${industryTarget} operations and what they produce
- fitScore: integer 0-100 (higher = more complex shop floor operations, more Relay fit)

Your entire response must be only the JSON array — nothing before [, nothing after ].`

    console.log("[discover] calling claude-sonnet-5-5 with web_search_20260209")
    const anthropic = new Anthropic({ apiKey })

    // 2-3 broad discovery + ~1 LinkedIn headcount search per company.
    // 12 gives enough budget for 8-10 companies without blowing the 90s wall clock.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: any[] = [{ type: "web_search_20260209", name: "web_search", max_uses: 12 }]

    const response = await anthropic.messages.create({
      model:      "claude-sonnet-5-5",
      max_tokens: 6000,
      tools,
      system:     systemPrompt,
      messages:   [{ role: "user", content: userPrompt }],
    })

    // Log usage — web_search tool charges are billed separately and not reflected here
    const usage = response.usage as {
      input_tokens:                number
      output_tokens:               number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?:     number
    }
    const estimatedTokenCost =
      (usage.input_tokens  * 2.00  / 1_000_000) +
      (usage.output_tokens * 10.00 / 1_000_000)
    console.log("[discover] usage:", {
      model:          "claude-sonnet-5-5",
      input_tokens:   usage.input_tokens,
      output_tokens:  usage.output_tokens,
      cache_creation: usage.cache_creation_input_tokens ?? 0,
      cache_read:     usage.cache_read_input_tokens     ?? 0,
    })
    console.log("[discover] estimated token cost (Sonnet 5.5 rates, excludes search tool charges):",
      `$${estimatedTokenCost.toFixed(4)}`)
    console.log("[discover] stop_reason:", response.stop_reason)

    // Collect all URLs returned by actual web search results — used to validate citations
    const confirmedSearchUrls = new Set<string>()
    for (const block of response.content) {
      if (block.type === "web_search_tool_result") {
        const wsBlock = block as unknown as {
          content: Array<{ type: string; url?: string }>
        }
        for (const item of wsBlock.content ?? []) {
          if (item.url) confirmedSearchUrls.add(item.url)
        }
      }
    }
    console.log("[discover] confirmed search URL count:", confirmedSearchUrls.size)

    // Extract final text block (after all tool uses)
    const textBlocks = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
    if (textBlocks.length === 0) {
      console.error("[discover] no text blocks; content types:", response.content.map(b => b.type).join(", "))
      return NextResponse.json({ error: "AI returned no text content", companies: [] }, { status: 502 })
    }

    const rawText = textBlocks.at(-1)!.text.trim()
    console.log("[discover] raw text (first 500 chars):", rawText.slice(0, 500))

    const parsed = extractArray(rawText)
    if (!parsed || parsed.length === 0) {
      console.error("[discover] JSON extraction failed; raw:", rawText.slice(0, 800))
      return NextResponse.json({ error: "AI returned unparseable content", companies: [] }, { status: 502 })
    }

    let companies: DiscoveredCompanyBasic[] = parsed
      .map(p => normalise(p))
      .filter(c => c.companyName && c.companyName !== "Unknown")

    // Validate citations — only keep URLs that appeared in actual search results.
    // If no search results were captured (e.g. web search didn't fire), pass through as-is.
    if (confirmedSearchUrls.size > 0) {
      for (const company of companies) {
        const before = company.sourceCitations.length
        company.sourceCitations = company.sourceCitations.filter(url => confirmedSearchUrls.has(url))
        if (company.sourceCitations.length < before) {
          console.warn(`[discover] dropped ${before - company.sourceCitations.length} unverified citations for ${company.companyName}`)
        }
      }
    }

    // Server-side geographic validation — flag but do not drop.
    // Replaces the old hard-filter that silently discarded results.
    if (body.stateProvince) {
      const reqNorm = normaliseState(body.stateProvince)
      let geoMatch  = 0
      for (const c of companies) {
        c.locationVerified = normaliseState(c.state) !== "" && normaliseState(c.state) === reqNorm
        if (c.locationVerified) geoMatch++
      }
      console.log("[discover] geographic validation:", {
        requested:  body.stateProvince,
        normalised: reqNorm,
        matched:    geoMatch,
        total:      companies.length,
      })
    } else {
      for (const c of companies) c.locationVerified = true
    }

    // Compute qualification tier: qualified = location + size evidence; potential = location only
    for (const c of companies) {
      if (!c.locationVerified) {
        c.qualificationTier = "location_unverified"
      } else if (c.employeeCountTier === "web_confirmed" || c.employeeCountTier === "web_estimated") {
        c.qualificationTier = "qualified"
      } else {
        c.qualificationTier = "potential"
      }
    }

    // Sort: qualified first, then potential, then location_unverified; within tier by fitScore desc
    const TIER_ORDER: Record<QualificationTier, number> = { qualified: 0, potential: 1, location_unverified: 2 }
    companies.sort((a, b) =>
      (TIER_ORDER[a.qualificationTier] - TIER_ORDER[b.qualificationTier]) ||
      (b.fitScore - a.fitScore)
    )

    // Annotate CRM status
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

    const locationVerifiedCount = companies.filter(c => c.locationVerified).length
    const qualifiedCount        = companies.filter(c => c.qualificationTier === "qualified").length
    const potentialCount        = companies.filter(c => c.qualificationTier === "potential").length
    const webConfirmedCount     = companies.filter(c => c.employeeCountTier === "web_confirmed").length
    const webEstimatedCount     = companies.filter(c => c.employeeCountTier === "web_estimated").length
    const unknownTierCount      = companies.filter(c => c.employeeCountTier === "unknown").length
    const limitationNote = companies.length < requestedCount
      ? `Found ${companies.length} companies (searched for up to ${requestedCount}). ${qualifiedCount} meet both location and size criteria; ${potentialCount} have unverified employee counts.`
      : undefined

    console.log("[discover] final result:", {
      total:              companies.length,
      qualified:          qualifiedCount,
      potential:          potentialCount,
      locationVerified:   locationVerifiedCount,
      webConfirmed:       webConfirmedCount,
      webEstimated:       webEstimatedCount,
      unknownTier:        unknownTierCount,
    })

    return NextResponse.json({ companies, qualifiedCount, potentialCount, locationVerifiedCount, limitationNote })

  } catch (err) {
    const msg   = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack   : undefined
    console.error("[discover] UNHANDLED ERROR:", msg)
    if (stack) console.error("[discover] stack:", stack)
    return NextResponse.json({ error: msg, companies: [] }, { status: 500 })
  }
}
