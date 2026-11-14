import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getPlatformConfig } from "@/lib/platform-config"
import Anthropic from "@anthropic-ai/sdk"
import { normalizeCompanyName } from "@/lib/prospect-utils"

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
    const nameToProspect   = new Map<string, { id: string }>()
    for (const p of existingProspects) {
      if (p.website) {
        const d = extractDomain(p.website)
        if (d) domainToProspect.set(d, { id: p.id })
      }
      const norm = normalizeCompanyName(p.companyName)
      if (norm && !nameToProspect.has(norm)) nameToProspect.set(norm, { id: p.id })
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

    // Discovery-only prompt — employee-count verification is handled separately after discovery
    function buildDiscoveryPrompt(opts: {
      count:                    number
      isBatch2?:                boolean
      additionalExcludeNames?:  string
      additionalExcludeDomains?: string[]
    }): string {
      const excludeNames   = exclusionList || "(none)"
      const excludeDomains = [
        ...existingDomains,
        ...(opts.additionalExcludeDomains ?? []),
      ].slice(0, 400).join(", ") || "(none)"
      const batch2Note = opts.isBatch2 && opts.additionalExcludeNames
        ? `\nIMPORTANT: Do NOT repeat any of these companies already found: ${opts.additionalExcludeNames}`
        : ""

      return `Find up to ${opts.count} real ${industryTarget} companies headquartered in ${locationTarget} that could benefit from Relay — operational coordination software for manufacturing facilities (issue reporting, maintenance requests, digital shift handoffs, QR-code asset tracking).${keywordsLine}${contextLine}${batch2Note}

USE WEB SEARCH with 3–5 searches to find diverse companies:
- Search for "${industryTarget} manufacturers ${locationTarget}", "${industryTarget} companies ${locationTarget}", and similar
- Vary your searches to cover different ${industryTarget} subsectors

REQUIREMENTS for each company:
- Official, working HTTPS website (required — omit the company if not verified; LinkedIn/ZoomInfo/directories are NOT acceptable)
- Headquarters confirmed in ${locationTarget}
- Looks like it could have roughly ${empRange} (judgment only — do NOT search for headcount)

GEOGRAPHIC RULE: Only return companies with confirmed headquarters in ${locationTarget}.
HONESTY RULE: Return what you verified. Do not fabricate. If fewer than ${opts.count}, return fewer.

EXCLUDE — already in our CRM: ${excludeNames}
EXCLUDE — these domains already tracked: ${excludeDomains}

Return ONLY a JSON array. Each object must have exactly these keys:
- companyName: exact company name
- website: working HTTPS URL (required — omit the company if not verified)
- city: headquarters city
- state: ${stateLabel}
- country: "${country}"
- industry: specific subsector (e.g. "Metal Fabrication", "Food Processing")
- summary: one sentence describing their ${industryTarget} operations and what they produce
- fitScore: integer 0-100 (higher = more complex shop floor, more Relay fit)
- sourceCitations: array of URLs from your web searches

Your entire response must be only the JSON array — nothing before [, nothing after ].`
    }

    // Collect confirmed search result URLs for citation validation
    function collectUrls(content: Anthropic.ContentBlock[]): Set<string> {
      const urls = new Set<string>()
      for (const block of content) {
        if (block.type === "web_search_tool_result") {
          const wsBlock = block as unknown as { content: Array<{ url?: string }> }
          for (const item of wsBlock.content ?? []) {
            if (item.url) urls.add(item.url)
          }
        }
      }
      return urls
    }

    // Process a raw API response into filtered, annotated companies.
    // excludeDomains / excludeNormNames: skip companies already found in a prior batch.
    function processRawText(
      content:          Anthropic.ContentBlock[],
      confirmedUrls:    Set<string>,
      excludeDomains:   Set<string>,
      excludeNormNames: Set<string>
    ): { companies: DiscoveredCompanyBasic[], preFilterCompanies: DiscoveredCompanyBasic[], rawText: string } {
      const textBlocks = content.filter((b): b is Anthropic.TextBlock => b.type === "text")
      if (textBlocks.length === 0) return { companies: [], preFilterCompanies: [], rawText: "" }

      const rawText = textBlocks.at(-1)!.text.trim()
      const parsed  = extractArray(rawText)
      if (!parsed || parsed.length === 0) return { companies: [], preFilterCompanies: [], rawText }

      let cos: DiscoveredCompanyBasic[] = parsed
        .map(p => normalise(p))
        .filter(c => {
          if (!c.companyName || c.companyName === "Unknown") return false
          const dom  = c.website ? extractDomain(c.website) : null
          if (dom  && excludeDomains.has(dom))   return false
          const norm = normalizeCompanyName(c.companyName)
          if (norm && excludeNormNames.has(norm)) return false
          return true
        })

      // Citation validation — drop invented URLs
      if (confirmedUrls.size > 0) {
        for (const c of cos) {
          c.sourceCitations = c.sourceCitations.filter(url => confirmedUrls.has(url))
        }
      }

      // Geographic validation
      if (body.stateProvince) {
        const reqNorm = normaliseState(body.stateProvince)
        for (const c of cos) {
          c.locationVerified = normaliseState(c.state) !== "" && normaliseState(c.state) === reqNorm
        }
      } else {
        for (const c of cos) c.locationVerified = true
      }

      // Qualification tier — discovery only: most will be "potential" until verified
      for (const c of cos) {
        if (!c.locationVerified) {
          c.qualificationTier = "location_unverified"
        } else if (c.employeeCountTier === "web_confirmed" || c.employeeCountTier === "web_estimated") {
          c.qualificationTier = "qualified"
        } else {
          c.qualificationTier = "potential"
        }
      }

      // CRM annotation — domain first, name fallback
      for (const c of cos) {
        const websiteDomain = c.website ? extractDomain(c.website) : null
        let annotated = false
        if (websiteDomain) {
          const prospectMatch = domainToProspect.get(websiteDomain)
          const lastContact   = domainToLastContact.get(websiteDomain)
          if (lastContact) {
            c.crmStatus     = "contacted"
            c.lastContactAt = lastContact.toISOString()
            if (prospectMatch) c.crmProspectId = prospectMatch.id
            annotated = true
          } else if (prospectMatch) {
            c.crmStatus     = "in_crm"
            c.crmProspectId = prospectMatch.id
            annotated = true
          }
        }
        if (!annotated) {
          const normName  = normalizeCompanyName(c.companyName)
          const nameMatch = normName ? nameToProspect.get(normName) : null
          if (nameMatch) {
            c.crmStatus     = "in_crm"
            c.crmProspectId = nameMatch.id
          }
        }
      }

      const preFilterCompanies = [...cos]
      cos = cos.filter(c => c.crmStatus === "none")
      return { companies: cos, preFilterCompanies, rawText }
    }

    // maxRetries:0 prevents the SDK from eating time on backoff retries inside a 90s wall clock
    const anthropic = new Anthropic({ apiKey, maxRetries: 0 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: any[] = [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }]

    // === BATCH 1 — discovery-only (3–5 searches, ~20–30s) ===
    console.log("[discover] batch 1: calling claude-sonnet-5-5 (max_uses: 5, discovery-only)")
    const response1 = await anthropic.messages.create({
      model:      "claude-sonnet-5-5",
      max_tokens: 5000,
      tools,
      system:     systemPrompt,
      messages:   [{ role: "user", content: buildDiscoveryPrompt({ count: requestedCount }) }],
    }, { timeout: 65_000 })

    const usage1 = response1.usage as { input_tokens: number; output_tokens: number }
    console.log("[discover] batch 1 usage:", {
      input_tokens: usage1.input_tokens, output_tokens: usage1.output_tokens,
    })
    console.log("[discover] batch 1 stop_reason:", response1.stop_reason)

    const confirmedUrls1 = collectUrls(response1.content)
    console.log("[discover] batch 1 search URL count:", confirmedUrls1.size)

    const { companies: batch1New, preFilterCompanies: batch1All, rawText: rawText1 } = processRawText(
      response1.content, confirmedUrls1, new Set(), new Set()
    )
    console.log("[discover] batch 1 raw text (first 300):", rawText1.slice(0, 300))
    console.log("[discover] batch 1:", { total: batch1All.length, afterCrmFilter: batch1New.length })

    let companies = [...batch1New]
    let totalFilteredByCrm = batch1All.length - batch1New.length

    // === BATCH 2 — if fewer than half the requested count survived CRM filtering ===
    if (companies.length < Math.ceil(requestedCount / 2)) {
      console.log("[discover] batch 2: results below threshold, running additional discovery")

      const batch1Domains = new Set(
        batch1All.flatMap(c => { const d = c.website ? extractDomain(c.website) : null; return d ? [d] : [] })
      )
      const batch1NormNames = new Set(
        batch1All.map(c => normalizeCompanyName(c.companyName)).filter(Boolean)
      )
      const needed = requestedCount - companies.length

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tools2: any[] = [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }]
        const response2 = await anthropic.messages.create({
          model:      "claude-sonnet-5-5",
          max_tokens: 3500,
          tools:      tools2,
          system:     systemPrompt,
          messages:   [{
            role:    "user",
            content: buildDiscoveryPrompt({
              count:                   needed,
              isBatch2:                true,
              additionalExcludeNames:  batch1All.map(c => c.companyName).join(", "),
              additionalExcludeDomains: [...batch1Domains],
            }),
          }],
        }, { timeout: 40_000 })

        const usage2 = response2.usage as { input_tokens: number; output_tokens: number }
        console.log("[discover] batch 2 usage:", usage2)

        const confirmedUrls2 = collectUrls(response2.content)
        const { companies: batch2New, preFilterCompanies: batch2All } = processRawText(
          response2.content, confirmedUrls2, batch1Domains, batch1NormNames
        )
        console.log("[discover] batch 2:", { total: batch2All.length, afterCrmFilter: batch2New.length })

        totalFilteredByCrm += batch2All.length - batch2New.length
        companies = [...companies, ...batch2New]
      } catch (err2) {
        // Second batch failure is non-fatal — log and continue with batch 1 results
        console.error("[discover] batch 2 error (non-fatal):", err2 instanceof Error ? err2.message : String(err2))
      }
    }

    // Sort: qualified first (after verification), then potential (by fitScore), then location_unverified
    const TIER_ORDER: Record<QualificationTier, number> = { qualified: 0, potential: 1, location_unverified: 2 }
    companies.sort((a, b) =>
      (TIER_ORDER[a.qualificationTier] - TIER_ORDER[b.qualificationTier]) ||
      (b.fitScore - a.fitScore)
    )

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
      filteredByCrm:      totalFilteredByCrm,
    })

    return NextResponse.json({
      companies,
      qualifiedCount,
      potentialCount,
      locationVerifiedCount,
      filteredCount: totalFilteredByCrm,
      limitationNote,
    })

  } catch (err) {
    const msg   = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack   : undefined
    console.error("[discover] UNHANDLED ERROR:", msg)
    if (stack) console.error("[discover] stack:", stack)
    return NextResponse.json({ error: msg, companies: [] }, { status: 500 })
  }
}
