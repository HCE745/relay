import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getPlatformConfig } from "@/lib/platform-config"
import Anthropic from "@anthropic-ai/sdk"
import { normalizeCompanyName } from "@/lib/prospect-utils"
import {
  extractDomain, collectUrls, processDiscoveryBatch,
  type DiscoveredCompanyBasic, type BatchDiagnostics,
} from "@/lib/discover-utils"

// Single round = max 4 searches, well within 60s
export const maxDuration = 60

export interface RoundResponse {
  companies:       DiscoveredCompanyBasic[]
  round:           number
  subsectorsFound: string[]
  citiesFound:     string[]
  hasMore:         boolean
  roundDurationMs: number
  diagnostics:     BatchDiagnostics
}

type RoundStrategy = "broad" | "subsector_diversify" | "alternate_terms" | "association_directory"

function getRoundStrategy(round: number): RoundStrategy {
  if (round === 1) return "broad"
  if (round === 2) return "subsector_diversify"
  if (round === 3) return "alternate_terms"
  return "association_directory"
}

function buildRoundPrompt(params: {
  round:            number
  strategy:         RoundStrategy
  count:            number
  industryTarget:   string
  locationTarget:   string
  empRange:         string
  stateLabel:       string
  country:          string
  keywordsLine:     string
  contextLine:      string
  excludeNames:     string
  excludeDomains:   string
  accumulatedNames: string[]
  subsectorCounts:  Record<string, number>
  citiesTried:      string[]
}): string {
  const {
    round, strategy, count, industryTarget, locationTarget, empRange, stateLabel, country,
    keywordsLine, contextLine, excludeNames, excludeDomains, accumulatedNames, subsectorCounts, citiesTried,
  } = params

  const alreadyFoundLine = accumulatedNames.length > 0
    ? `\nDo NOT repeat these already-found companies: ${accumulatedNames.slice(0, 100).join(", ")}`
    : ""

  const citiesLine = citiesTried.length > 0
    ? `\nCities already searched: ${citiesTried.slice(0, 15).join(", ")}. Try different cities.`
    : ""

  const coverSubsectors = Object.keys(subsectorCounts)
  const subsectorLine = coverSubsectors.length > 0
    ? `\nSubsectors already found: ${coverSubsectors.join(", ")}. Prioritize OTHER subsectors.`
    : ""

  let searchGuidance: string
  if (strategy === "broad") {
    searchGuidance = `USE WEB SEARCH with 3–4 searches to find diverse companies:
- "${industryTarget} manufacturers ${locationTarget}"
- "${industryTarget} companies ${locationTarget} employees"
- Vary searches across different ${industryTarget} subsectors`
  } else if (strategy === "subsector_diversify") {
    const coveredList = coverSubsectors.length > 0 ? coverSubsectors.join(", ") : "none yet"
    searchGuidance = `USE WEB SEARCH with 3–4 searches focused on UNDERREPRESENTED subsectors:
- Already covered subsectors: ${coveredList}
- Search specifically for other ${industryTarget} subsectors in ${locationTarget}
- Try searches like "[new subsector] manufacturer ${locationTarget}", "[new subsector] company ${locationTarget}"`
  } else if (strategy === "alternate_terms") {
    searchGuidance = `USE WEB SEARCH with 3–4 searches using ALTERNATE INDUSTRY TERMS:
- Try "OEM manufacturer ${locationTarget}", "contract manufacturer ${locationTarget}"
- Try "job shop ${locationTarget}", "custom fabrication ${locationTarget}"
- Try "industrial supplier ${locationTarget}", "${industryTarget} supplier ${locationTarget}"`
  } else {
    searchGuidance = `USE WEB SEARCH with 3–4 searches via INDUSTRY DIRECTORIES AND ASSOCIATIONS:
- Try "[industry association name] members ${locationTarget}"
- Try site:thomasnet.com "${industryTarget}" "${locationTarget}"
- Try "${industryTarget} trade directory ${locationTarget}"`
  }

  return `[ROUND ${round}/4 — ${strategy.replace("_", " ")}] Find up to ${count} real ${industryTarget} companies headquartered in ${locationTarget} that could benefit from Relay — operational coordination software for manufacturing facilities.${keywordsLine}${contextLine}${alreadyFoundLine}${citiesLine}${subsectorLine}

${searchGuidance}

REQUIREMENTS for each company:
- Official, working HTTPS website (required — omit the company if not verified; LinkedIn/ZoomInfo/directories are NOT acceptable)
- Headquarters confirmed in ${locationTarget}
- Looks like it could have roughly ${empRange} (judgment only — do NOT search for headcount)

GEOGRAPHIC RULE: Only return companies with confirmed headquarters in ${locationTarget}.
HONESTY RULE: Return what you verified. Do not fabricate. If fewer than ${count}, return fewer.

EXCLUDE — already in our CRM: ${excludeNames}
EXCLUDE — these domains already tracked: ${excludeDomains}

Return ONLY a JSON array. Each object must have exactly these keys:
- companyName: exact company name
- website: working HTTPS URL (required)
- city: headquarters city
- state: ${stateLabel}
- country: "${country}"
- industry: specific subsector (e.g. "Metal Fabrication", "Food Processing")
- summary: one sentence describing their ${industryTarget} operations and what they produce
- fitScore: integer 0-100 (higher = more complex shop floor, more Relay fit)
- sourceCitations: array of URLs from your web searches

Your entire response must be only the JSON array — nothing before [, nothing after ].`
}

export async function POST(req: NextRequest) {
  const roundStart = Date.now()
  try {
    const session = await getSession()
    if (!session?.superAdmin && !session?.salesUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const discoveryEnabled = (await getPlatformConfig("ai_prospect_discovery_enabled")) !== "false"
    if (!discoveryEnabled) {
      return NextResponse.json({ error: "AI prospect discovery is disabled", disabled: true }, { status: 403 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 })
    }

    const body = await req.json() as {
      country?:           string
      stateProvince?:     string
      industry?:          string
      employeeCountMin?:  number
      employeeCountMax?:  number
      keywords?:          string
      additionalContext?: string
      requestedCount?:    number
      round?:             number
      accumulatedNames?:  string[]
      accumulatedDomains?: string[]
      subsectorCounts?:   Record<string, number>
      citiesTried?:       string[]
    }

    const country         = body.country || "United States"
    const round           = Math.min(Math.max(body.round ?? 1, 1), 4)
    const requestedCount  = Math.min(body.requestedCount ?? 20, 20)
    const accumulatedNames  = body.accumulatedNames  ?? []
    const accumulatedDomains = body.accumulatedDomains ?? []
    const subsectorCounts = body.subsectorCounts ?? {}
    const citiesTried     = body.citiesTried ?? []

    console.log(`[discover/round] round=${round} strategy=${getRoundStrategy(round)} accumulated=${accumulatedNames.length}`)

    // Load CRM data for annotation and exclusion
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
      : country
    const stateLabel     = country === "Canada" ? "province abbreviation" : "2-letter US state code (e.g. IN)"
    const keywordsLine   = body.keywords         ? `\nFocus on: ${body.keywords}` : ""
    const contextLine    = body.additionalContext ? `\nAdditional context: ${body.additionalContext}` : ""

    // Build exclusion sets combining CRM + accumulated from client
    const accDomainSet   = new Set(accumulatedDomains)
    const accNormNameSet = new Set(accumulatedNames.map(n => normalizeCompanyName(n)).filter(Boolean) as string[])

    const allExcludeDomains = [...existingDomains, ...accumulatedDomains].slice(0, 400).join(", ") || "(none)"
    const allExcludeNames   = exclusionList || "(none)"

    const strategy = getRoundStrategy(round)
    const userPrompt = buildRoundPrompt({
      round, strategy,
      count:          requestedCount,
      industryTarget, locationTarget, empRange, stateLabel, country,
      keywordsLine, contextLine,
      excludeNames:   allExcludeNames,
      excludeDomains: allExcludeDomains,
      accumulatedNames, subsectorCounts, citiesTried,
    })

    const systemPrompt = `You are a B2B prospect researcher. Use the web_search tool to find real, verifiable ${industryTarget} companies. Return ONLY a valid JSON array — starting with [ and ending with ]. No markdown, headers, or explanation. If no qualifying companies are found, return [].`

    const anthropic = new Anthropic({ apiKey, maxRetries: 0 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: any[] = [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }]

    const response = await anthropic.messages.create({
      model:      "claude-sonnet-5-5",
      max_tokens: 4000,
      tools,
      system:     systemPrompt,
      messages:   [{ role: "user", content: userPrompt }],
    }, { timeout: 50_000 })

    const usage = response.usage as { input_tokens: number; output_tokens: number }
    console.log(`[discover/round] round=${round} usage:`, usage, "stop_reason:", response.stop_reason)

    const confirmedUrls = collectUrls(response.content)
    console.log(`[discover/round] round=${round} search URL count:`, confirmedUrls.size)

    const result = processDiscoveryBatch(response.content, confirmedUrls, {
      stateProvince:      body.stateProvince,
      domainToProspect,
      nameToProspect,
      domainToLastContact,
      excludeDomains:     accDomainSet,
      excludeNormNames:   accNormNameSet,
    })

    const { companies, diagnostics } = result
    const roundDurationMs = Date.now() - roundStart

    // Collect subsectors and cities from this round's results
    const subsectorsFound = [...new Set(companies.map(c => c.industry).filter(Boolean))]
    const citiesFound     = [...new Set(companies.map(c => c.city).filter(Boolean))]

    // hasMore: continue if we have rounds left AND this round found something
    const hasMore = round < 4 && diagnostics.netNew > 0

    console.log(`[discover/round] round=${round} done:`, {
      ...diagnostics,
      roundDurationMs,
      subsectors:   subsectorsFound.length,
      hasMore,
    })

    return NextResponse.json({
      companies,
      round,
      subsectorsFound,
      citiesFound,
      hasMore,
      roundDurationMs,
      diagnostics,
    } satisfies RoundResponse)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[discover/round] error:", msg)
    return NextResponse.json({ error: msg, companies: [] }, { status: 500 })
  }
}
