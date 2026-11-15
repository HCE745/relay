import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getPlatformConfig } from "@/lib/platform-config"
import Anthropic from "@anthropic-ai/sdk"
import { normalizeCompanyName } from "@/lib/prospect-utils"
import {
  extractDomain, collectUrls, processDiscoveryBatch,
  type EmployeeCountTier, type QualificationTier,
  type DiscoveredCompanyBasic, type DiscoveredCompanyDetails, type DiscoveredCompany,
} from "@/lib/discover-utils"

// Re-export types so existing imports from this route continue to work
export type { EmployeeCountTier, QualificationTier, DiscoveredCompanyBasic, DiscoveredCompanyDetails, DiscoveredCompany }

// 90s gives web-search calls room to breathe
export const maxDuration = 90

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
    const exclusionList = existingProspects.map(p => p.companyName).slice(0, 300).join(", ")
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

      if (opts.isBatch2) {
        // Batch 2 is a fast fallback — discovery only, no headcount verification
        return `Find up to ${opts.count} real ${industryTarget} companies headquartered in ${locationTarget} with approximately ${empRange} that could benefit from Relay — operational coordination software for manufacturing facilities.${keywordsLine}${contextLine}${batch2Note}

USE WEB SEARCH with 2–3 searches targeting DIFFERENT areas than your previous search:
- Try different ${industryTarget} subsectors, different cities, or adjacent industry terms
- Do NOT repeat any of the excluded companies below

REQUIREMENTS: official HTTPS website required; headquarters confirmed in ${locationTarget}; LinkedIn/ZoomInfo/directories are NOT acceptable as the company website.

EXCLUDE — already in our CRM: ${excludeNames}
EXCLUDE — these domains already tracked: ${excludeDomains}

Return ONLY a JSON array. Each object: companyName, website, city, state (${stateLabel}), country ("${country}"), industry, summary, fitScore (0-100), estimatedEmployees ("unknown"), employeeCountTier ("unknown"), sourceCitations.
Your entire response must be only the JSON array — nothing before [, nothing after ].`
      }

      return `Find up to ${opts.count} real ${industryTarget} companies headquartered in ${locationTarget} with approximately ${empRange} that could benefit from Relay — operational coordination software for manufacturing facilities (issue reporting, maintenance requests, digital shift handoffs, QR-code asset tracking).${keywordsLine}${contextLine}

USE WEB SEARCH with this two-step process:

STEP 1 — DISCOVERY (use 2–3 broad searches):
Search for "${industryTarget} companies ${locationTarget}", "${industryTarget} manufacturers ${locationTarget}", and similar. Build a candidate list. Vary searches across different ${industryTarget} subsectors.

STEP 2 — HEADCOUNT VERIFICATION (use 1 targeted search per candidate):
For each company from Step 1, run a targeted search:
  - Search: "{company name} linkedin.com employees" or "{company name} site:linkedin.com"
  - LinkedIn company pages show ranges like "51-200 employees", "201-500 employees" — use these
  - If LinkedIn gives nothing, try: "{company name} glassdoor employees ${locationTarget}"
  - Classify based on what you actually found:
    * "web_confirmed" — LinkedIn or Glassdoor shows an employee count or range entirely within ${empRange}
    * "web_estimated" — LinkedIn or Glassdoor shows a range that OVERLAPS with ${empRange}
    * "unknown" — real ${locationTarget} ${industryTarget} company but NO headcount evidence found after searching LinkedIn and Glassdoor

IMPORTANT: Allocate enough searches so you do a headcount lookup for every company you plan to include. Only mark "unknown" after genuinely trying LinkedIn and Glassdoor.

REQUIREMENTS for each company:
- Official, working HTTPS website (required — omit the company if not verified; LinkedIn/ZoomInfo/directories are NOT acceptable)
- Headquarters confirmed in ${locationTarget}

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
- industry: specific ${industryTarget} subsector (e.g. "Metal Fabrication", "Food Processing")
- estimatedEmployees: employee range string (e.g. "80-150") or "unknown"
- employeeCountTier: "web_confirmed" | "web_estimated" | "unknown"
- summary: one sentence describing their ${industryTarget} operations and what they produce
- fitScore: integer 0-100 (higher = more complex shop floor operations, more Relay fit)
- sourceCitations: array of URLs from your web searches — include the LinkedIn/Glassdoor URL when found

Your entire response must be only the JSON array — nothing before [, nothing after ].`
    }

    const batchOpts = {
      stateProvince:      body.stateProvince,
      domainToProspect,
      nameToProspect,
      domainToLastContact,
    }

    const anthropic = new Anthropic({ apiKey, maxRetries: 0 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: any[] = [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }]

    // === BATCH 1: discovery + headcount verification ===
    console.log("[discover] batch 1: calling claude-sonnet-5-5 (max_uses: 8, discovery+verify)")
    const response1 = await anthropic.messages.create({
      model:      "claude-sonnet-5-5",
      max_tokens: 5000,
      tools,
      system:     systemPrompt,
      messages:   [{ role: "user", content: buildDiscoveryPrompt({ count: requestedCount }) }],
    // 8 searches × ~6s avg = ~48s; 80s SDK timeout leaves a buffer before Vercel's 90s wall
    }, { timeout: 80_000 })

    const usage1 = response1.usage as { input_tokens: number; output_tokens: number }
    console.log("[discover] batch 1 usage:", { input_tokens: usage1.input_tokens, output_tokens: usage1.output_tokens })
    console.log("[discover] batch 1 stop_reason:", response1.stop_reason)

    const confirmedUrls1 = collectUrls(response1.content)
    console.log("[discover] batch 1 search URL count:", confirmedUrls1.size)

    // Guard: Claude must return at least one text block
    const hasTextBlock = response1.content.some(b => b.type === "text")
    if (!hasTextBlock) {
      console.error("[discover] no text blocks; content types:", response1.content.map(b => b.type).join(", "))
      return NextResponse.json({ error: "AI returned no text content", companies: [] }, { status: 502 })
    }

    const batch1Result = processDiscoveryBatch(response1.content, confirmedUrls1, batchOpts)
    const { companies: batch1New, preFilterCompanies: batch1All, rawText: rawText1 } = batch1Result
    console.log("[discover] batch 1 raw text (first 300):", rawText1.slice(0, 300))
    console.log("[discover] batch 1:", { total: batch1All.length, afterCrmFilter: batch1New.length })

    let companies      = [...batch1New]
    let rawCount       = batch1All.length
    let totalFilteredByCrm = batch1All.length - batch1New.length

    // === BATCH 2 — if fewer than half the requested count survived CRM filtering ===
    if (companies.length < Math.ceil(requestedCount / 2)) {
      console.log("[discover] batch 2: results below threshold, running additional discovery")

      const batch1Domains = new Set(
        batch1All.flatMap(c => { const d = c.website ? extractDomain(c.website) : null; return d ? [d] : [] })
      )
      const batch1NormNames = new Set(
        batch1All.map(c => normalizeCompanyName(c.companyName)).filter(Boolean) as string[]
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
        const batch2Result = processDiscoveryBatch(response2.content, confirmedUrls2, {
          ...batchOpts,
          excludeDomains:   batch1Domains,
          excludeNormNames: batch1NormNames,
        })
        const { companies: batch2New, preFilterCompanies: batch2All } = batch2Result
        console.log("[discover] batch 2:", { total: batch2All.length, afterCrmFilter: batch2New.length })

        rawCount           += batch2All.length
        totalFilteredByCrm += batch2All.length - batch2New.length
        companies = [...companies, ...batch2New]
      } catch (err2) {
        console.error("[discover] batch 2 error (non-fatal):", err2 instanceof Error ? err2.message : String(err2))
      }
    }

    // Sort: qualified first, then potential, then location_unverified
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
      rawCount,
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
