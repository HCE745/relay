import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import { normalizeCompanyName } from "@/lib/prospect-utils"
import {
  extractDomain, collectUrls, processDiscoveryBatch,
  type DiscoveredCompanyBasic, type BatchProcessOpts,
} from "@/lib/discover-utils"

// ─── Agent types ──────────────────────────────────────────────────────────────

export interface JobCriteria {
  country:           string
  stateProvince?:    string
  industry:          string
  employeeCountMin:  number
  employeeCountMax:  number
  keywords?:         string
  additionalContext?: string
  requestedCount:    number
}

export interface AgentRound {
  roundNum:         number
  candidateCount:   number
  acceptedCount:    number
  crmFiltered:      number
  geoFiltered:      number
  subsectors:       string[]
  sourceStrategy:   string
}

export interface AgentState {
  seenDomains:      string[]  // normalized domains of all candidates ever seen
  seenNormNames:    string[]  // normalized names of all candidates ever seen
  subsectorsUsed:   string[]  // manufacturing subsectors already searched
  sourceStrategies: string[]  // strategies already tried
  rounds:           AgentRound[]
  totalCandidates:  number
  totalCrmFiltered: number
  totalGeoFiltered: number
}

export const EMPTY_AGENT_STATE: AgentState = {
  seenDomains:      [],
  seenNormNames:    [],
  subsectorsUsed:   [],
  sourceStrategies: [],
  rounds:           [],
  totalCandidates:  0,
  totalCrmFiltered: 0,
  totalGeoFiltered: 0,
}

export interface RoundResult {
  accepted:          DiscoveredCompanyBasic[]
  allCandidates:     DiscoveredCompanyBasic[]
  crmFiltered:       number
  geoFiltered:       number
  inputTokens:       number
  outputTokens:      number
  searchCalls:       number
  subsectors:        string[]
  sourceStrategy:    string
}

// ─── Subsector and strategy pools ────────────────────────────────────────────

const MANUFACTURING_SUBSECTORS = [
  "Metal Fabrication",
  "Food Processing",
  "Plastics Manufacturing",
  "Automotive Parts",
  "Electronics Assembly",
  "Wood Products",
  "Chemical Processing",
  "Printing & Packaging",
  "Textile Manufacturing",
  "Industrial Equipment",
  "Medical Device Manufacturing",
  "Rubber Products",
  "Glass Manufacturing",
  "Aerospace Components",
  "Consumer Goods",
  "Industrial Machinery",
  "Paper Products",
  "Concrete & Building Materials",
  "Fabricated Metal Products",
  "Agricultural Equipment",
]

// Each strategy has a name and instructions for how to find companies
type SourceStrategy = "general_web" | "thomasnet" | "associations" | "industrial_dirs" | "regional"

const STRATEGY_PROMPTS: Record<SourceStrategy, string> = {
  general_web:
    "Search Google and LinkedIn for company names, then verify on LinkedIn for employee counts.",
  thomasnet:
    "Search site:thomasnet.com and site:manta.com for manufacturers. Use ThomasNet product category pages to find suppliers in this region. Also try site:kompass.com.",
  associations:
    "Search for state manufacturing association member lists (e.g. site:in.gov manufacturers, state chamber of commerce). Try '[state] manufacturers association member directory' and '[industry] association [state]'.",
  industrial_dirs:
    "Search site:industrynet.com, site:mfgpages.com, and site:globalspec.com for manufacturers. Also try '[industry] companies [city/state] site:yellowpages.com' and Google Maps searches for manufacturing facilities.",
  regional:
    "Search regional business journals and local news sources. Try '[city] manufacturing company', '[state] business journal manufacturers', and '[industry] company [city] founded'. Find companies that may not appear in national directories.",
}

// ─── Adaptive strategy selection ─────────────────────────────────────────────

function pickSubsectors(state: AgentState, industry: string, count = 3): string[] {
  const pool = industry.toLowerCase().includes("manufactur") ? MANUFACTURING_SUBSECTORS : [industry]
  const unused = pool.filter(s => !state.subsectorsUsed.includes(s))
  if (unused.length === 0) return pool.slice(0, count)
  return unused.slice(0, count)
}

function pickStrategy(state: AgentState, roundNum: number): SourceStrategy {
  const ordered: SourceStrategy[] = ["general_web", "thomasnet", "associations", "industrial_dirs", "regional"]
  const unused = ordered.filter(s => !(state.sourceStrategies as string[]).includes(s))
  if (unused.length > 0) return unused[0]
  return ordered[(roundNum - 1) % ordered.length]
}

function buildAdaptiveHints(state: AgentState): string {
  if (state.rounds.length === 0) return ""

  const hints: string[] = []
  const crmRate = state.totalCandidates > 0 ? state.totalCrmFiltered / state.totalCandidates : 0
  const geoRate = state.totalCandidates > 0 ? state.totalGeoFiltered / state.totalCandidates : 0

  if (crmRate > 0.4) {
    hints.push(
      "Many of the companies you found last time are already in our CRM. " +
      "Focus on LESS-VISIBLE companies: smaller local shops, newer operations, family-owned manufacturers " +
      "that don't appear prominently in Google search results but are real operating businesses. " +
      "Avoid well-known regional names.",
    )
  }
  if (geoRate > 0.3) {
    hints.push(
      "Many previous candidates were from outside the target region. " +
      "Be more precise about headquarters location — verify the city is actually in the target state/province, " +
      "not just a sales office or subsidiary.",
    )
  }
  if (hints.length === 0) {
    hints.push(
      "In previous rounds you found some good candidates. Try different subsectors, " +
      "smaller cities, and different directory sources to find MORE companies.",
    )
  }

  return "\n\nSTRATEGY NOTE FOR THIS ROUND:\n" + hints.join(" ")
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

export function buildSystemPrompt(criteria: JobCriteria): string {
  return (
    `You are a B2B prospect researcher. Use the web_search tool to find real, verifiable ` +
    `${criteria.industry} companies. Return ONLY a valid JSON array — starting with [ and ending with ]. ` +
    `No markdown, headers, or explanation. If no qualifying companies are found, return [].`
  )
}

export function buildRoundPrompt(opts: {
  criteria:         JobCriteria
  state:            AgentState
  roundNum:         number
  needed:           number
  exclusionNames:   string   // comma-separated CRM names to exclude
  exclusionDomains: string[] // CRM domains to exclude
  subsectors:       string[]
  strategy:         SourceStrategy
  isFallback?:      boolean  // batch-2 fast-path: skip headcount verification
}): string {
  const { criteria, state, roundNum, needed, exclusionNames, exclusionDomains, subsectors, strategy, isFallback } = opts
  const empRange    = `${criteria.employeeCountMin}–${criteria.employeeCountMax} employees`
  const location    = criteria.stateProvince
    ? `${criteria.stateProvince}, ${criteria.country}`
    : criteria.country
  const stateLabel  = criteria.country === "Canada" ? "province abbreviation" : "2-letter US state code (e.g. IN)"
  const keywordsLine  = criteria.keywords         ? `\nFocus on: ${criteria.keywords}` : ""
  const contextLine   = criteria.additionalContext ? `\nAdditional context: ${criteria.additionalContext}` : ""

  // Build the exclusion block (CRM + previously seen this job)
  const allExcludedDomains = [...exclusionDomains, ...state.seenDomains].slice(0, 500).join(", ") || "(none)"
  const prevSeenNames      = state.seenNormNames.length > 0
    ? `\nDo NOT repeat these companies already found in this research session: ${state.seenNormNames.slice(0, 100).join(", ")}`
    : ""
  const adaptiveHints      = roundNum > 1 ? buildAdaptiveHints(state) : ""

  const subsectorFocus = subsectors.length > 0
    ? `\nFocus on these ${criteria.industry} subsectors: ${subsectors.join(", ")}.`
    : ""

  const strategyInstructions = STRATEGY_PROMPTS[strategy]

  if (isFallback) {
    return (
      `Find up to ${needed} real ${criteria.industry} companies headquartered in ${location} ` +
      `with approximately ${empRange} that could benefit from Relay — operational coordination software for manufacturing facilities.` +
      `${keywordsLine}${contextLine}${subsectorFocus}${prevSeenNames}${adaptiveHints}\n\n` +
      `SOURCE STRATEGY: ${strategyInstructions}\n\n` +
      `USE WEB SEARCH with 2–3 searches targeting DIFFERENT areas than your previous searches.\n` +
      `REQUIREMENTS: official HTTPS website required; headquarters confirmed in ${location}.\n` +
      `EXCLUDE — already in our CRM: ${exclusionNames || "(none)"}\n` +
      `EXCLUDE — these domains already tracked: ${allExcludedDomains}\n\n` +
      `Return ONLY a JSON array. Each object: companyName, website, city, state (${stateLabel}), ` +
      `country ("${criteria.country}"), industry, summary, fitScore (0-100), ` +
      `estimatedEmployees ("unknown"), employeeCountTier ("unknown"), sourceCitations.\n` +
      `Your entire response must be only the JSON array — nothing before [, nothing after ].`
    )
  }

  return (
    `Find up to ${needed} real ${criteria.industry} companies headquartered in ${location} ` +
    `with approximately ${empRange} that could benefit from Relay — operational coordination software ` +
    `for manufacturing facilities (issue reporting, maintenance requests, digital shift handoffs, QR-code asset tracking).` +
    `${keywordsLine}${contextLine}${subsectorFocus}${prevSeenNames}${adaptiveHints}\n\n` +
    `SOURCE STRATEGY: ${strategyInstructions}\n\n` +
    `USE WEB SEARCH with this two-step process:\n\n` +
    `STEP 1 — DISCOVERY (use 2–3 broad searches):\n` +
    `Search for "${criteria.industry} companies ${location}", ` +
    `"${criteria.industry} manufacturers ${location}", and similar. ` +
    `Build a candidate list. Vary searches across different ${criteria.industry} subsectors.\n\n` +
    `STEP 2 — HEADCOUNT VERIFICATION (use 1 targeted search per candidate):\n` +
    `For each company from Step 1, run a targeted search:\n` +
    `  - Search: "{company name} linkedin.com employees" or "{company name} site:linkedin.com"\n` +
    `  - LinkedIn company pages show ranges like "51-200 employees", "201-500 employees" — use these\n` +
    `  - If LinkedIn gives nothing, try: "{company name} glassdoor employees ${location}"\n` +
    `  - Classify based on what you actually found:\n` +
    `    * "web_confirmed" — LinkedIn or Glassdoor shows an employee count or range entirely within ${empRange}\n` +
    `    * "web_estimated" — LinkedIn or Glassdoor shows a range that OVERLAPS with ${empRange}\n` +
    `    * "unknown" — real ${location} ${criteria.industry} company but NO headcount evidence found\n\n` +
    `REQUIREMENTS for each company:\n` +
    `- Official, working HTTPS website (required — omit if not verified; LinkedIn/ZoomInfo are NOT acceptable)\n` +
    `- Headquarters confirmed in ${location}\n\n` +
    `GEOGRAPHIC RULE: Only return companies with confirmed headquarters in ${location}.\n` +
    `HONESTY RULE: Return what you verified. Do not fabricate. If fewer than ${needed}, return fewer.\n\n` +
    `EXCLUDE — already in our CRM: ${exclusionNames || "(none)"}\n` +
    `EXCLUDE — these domains already tracked: ${allExcludedDomains}\n\n` +
    `Return ONLY a JSON array. Each object must have exactly these keys:\n` +
    `- companyName: exact company name\n` +
    `- website: working HTTPS URL (required — omit the company if not verified)\n` +
    `- city: headquarters city\n` +
    `- state: ${stateLabel}\n` +
    `- country: "${criteria.country}"\n` +
    `- industry: specific ${criteria.industry} subsector (e.g. "Metal Fabrication", "Food Processing")\n` +
    `- estimatedEmployees: employee range string (e.g. "80-150") or "unknown"\n` +
    `- employeeCountTier: "web_confirmed" | "web_estimated" | "unknown"\n` +
    `- summary: one sentence describing their ${criteria.industry} operations and what they produce\n` +
    `- fitScore: integer 0-100 (higher = more complex shop floor operations, more Relay fit)\n` +
    `- sourceCitations: array of URLs from your web searches — include the LinkedIn/Glassdoor URL when found\n\n` +
    `Your entire response must be only the JSON array — nothing before [, nothing after ].`
  )
}

// ─── Agent state updates ──────────────────────────────────────────────────────

export function updateAgentState(
  state:          AgentState,
  allCandidates:  DiscoveredCompanyBasic[],
  accepted:       DiscoveredCompanyBasic[],
  crmFiltered:    number,
  geoFiltered:    number,
  roundNum:       number,
  subsectors:     string[],
  strategy:       string,
): AgentState {
  const newDomains = allCandidates
    .map(c => c.website ? extractDomain(c.website) : null)
    .filter((d): d is string => !!d)
    .filter(d => !state.seenDomains.includes(d))

  const newNames = allCandidates
    .map(c => normalizeCompanyName(c.companyName))
    .filter((n): n is string => !!n)
    .filter(n => !state.seenNormNames.includes(n))

  const newSubsectors = subsectors.filter(s => !state.subsectorsUsed.includes(s))

  return {
    seenDomains:      [...state.seenDomains,      ...newDomains],
    seenNormNames:    [...state.seenNormNames,     ...newNames],
    subsectorsUsed:   [...state.subsectorsUsed,    ...newSubsectors],
    sourceStrategies: [...state.sourceStrategies,  strategy].filter((v, i, a) => a.indexOf(v) === i),
    rounds: [
      ...state.rounds,
      {
        roundNum,
        candidateCount: allCandidates.length,
        acceptedCount:  accepted.length,
        crmFiltered,
        geoFiltered,
        subsectors,
        sourceStrategy: strategy,
      },
    ],
    totalCandidates:  state.totalCandidates  + allCandidates.length,
    totalCrmFiltered: state.totalCrmFiltered + crmFiltered,
    totalGeoFiltered: state.totalGeoFiltered + geoFiltered,
  }
}

// ─── Core round execution ─────────────────────────────────────────────────────
// Runs one research round for a job: calls Claude → processes results → saves to list.
// Returns the round result for the caller to update job state.

export interface RunRoundOpts {
  apiKey:      string
  criteria:    JobCriteria
  state:       AgentState
  roundNum:    number
  needed:      number  // how many more accepted companies we still need
  listId:      string  // research list to append results to
  batchOpts:   BatchProcessOpts
  listSearchState?: string | null  // for the list's requestedState
}

export async function runResearchRound(opts: RunRoundOpts): Promise<RoundResult> {
  const { apiKey, criteria, state, roundNum, needed, listId, batchOpts, listSearchState } = opts

  const subsectors    = pickSubsectors(state, criteria.industry)
  const strategy      = pickStrategy(state, roundNum)
  const anthropic     = new Anthropic({ apiKey, maxRetries: 0 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[]  = [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }]

  const systemPrompt = buildSystemPrompt(criteria)

  // Load CRM exclusion list fresh each round (CRM grows over time)
  const existingProspects = await prisma.prospect.findMany({
    select: { companyName: true, website: true },
  })
  const exclusionNames   = existingProspects.map(p => p.companyName).slice(0, 300).join(", ")
  const exclusionDomains = existingProspects
    .flatMap(p => { const d = p.website ? extractDomain(p.website) : null; return d ? [d] : [] })
    .slice(0, 300)

  // Also exclude what's already in this job's list
  const listDomainRows = await prisma.prospectResearchResult.findMany({
    where:  { listId },
    select: { normalizedDomain: true, companyName: true },
  })
  const listSeenDomains   = listDomainRows.map(r => r.normalizedDomain).filter(Boolean) as string[]
  const listSeenNormNames = listDomainRows.map(r => normalizeCompanyName(r.companyName)).filter(Boolean) as string[]

  const combinedSeenDomains   = [...new Set([...state.seenDomains,    ...listSeenDomains])]
  const combinedSeenNormNames = [...new Set([...state.seenNormNames,  ...listSeenNormNames])]

  const stateWithList: AgentState = {
    ...state,
    seenDomains:   combinedSeenDomains,
    seenNormNames: combinedSeenNormNames,
  }

  const userPrompt = buildRoundPrompt({
    criteria,
    state:            stateWithList,
    roundNum,
    needed,
    exclusionNames,
    exclusionDomains,
    subsectors,
    strategy,
    isFallback:       false,
  })

  console.log(`[research-agent] round ${roundNum}: strategy=${strategy} subsectors=${subsectors.join(",")}`)

  const response = await anthropic.messages.create({
    model:      "claude-sonnet-5-5",
    max_tokens: 5000,
    tools,
    system:     systemPrompt,
    messages:   [{ role: "user", content: userPrompt }],
  }, { timeout: 85_000 })

  const usage       = response.usage as { input_tokens: number; output_tokens: number }
  const confirmedUrls = collectUrls(response.content)
  console.log(`[research-agent] round ${roundNum} stop_reason=${response.stop_reason} searches=${confirmedUrls.size} tokens=${usage.input_tokens}/${usage.output_tokens}`)

  // Guard: no text block → return empty
  const hasText = response.content.some(b => b.type === "text")
  if (!hasText) {
    console.warn(`[research-agent] round ${roundNum}: no text block returned`)
    return { accepted: [], allCandidates: [], crmFiltered: 0, geoFiltered: 0, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, searchCalls: confirmedUrls.size, subsectors, sourceStrategy: strategy }
  }

  const batch = processDiscoveryBatch(response.content, confirmedUrls, batchOpts)
  const { companies: accepted, preFilterCompanies: all, diagnostics: diag } = batch

  console.log(`[research-agent] round ${roundNum}: total=${all.length} crm_filtered=${diag.crmExcluded} geo_filtered=${diag.geoMismatch} accepted=${accepted.length}`)

  // Save accepted companies to the research list
  if (accepted.length > 0) {
    await appendResultsToList(listId, accepted, criteria.country, criteria.stateProvince ?? null)
  }

  return {
    accepted,
    allCandidates:  all,
    crmFiltered:    diag.crmExcluded,
    geoFiltered:    diag.geoMismatch,
    inputTokens:    usage.input_tokens,
    outputTokens:   usage.output_tokens,
    searchCalls:    confirmedUrls.size,
    subsectors,
    sourceStrategy: strategy,
  }
}

// ─── List result saving ───────────────────────────────────────────────────────

function normalizeDomain(website: string | null | undefined): string | null {
  if (!website) return null
  try {
    const url = new URL((website as string).startsWith("http") ? website as string : `https://${website}`)
    return url.hostname.replace(/^www\./, "").toLowerCase().slice(0, 253) || null
  } catch { return null }
}

async function appendResultsToList(
  listId:         string,
  companies:      DiscoveredCompanyBasic[],
  requestedCountry: string,
  requestedState:   string | null,
): Promise<void> {
  for (const c of companies) {
    const nd             = normalizeDomain(c.website || null)
    const verifiedState  = c.state || null
    const locationVerified = !!(requestedState && verifiedState &&
      verifiedState.trim().toLowerCase() === requestedState.trim().toLowerCase())

    try {
      await prisma.prospectResearchResult.create({
        data: {
          listId,
          companyName:         c.companyName,
          website:             c.website || null,
          normalizedDomain:    nd,
          requestedCountry,
          requestedState:      requestedState ?? null,
          verifiedCity:        c.city    || null,
          verifiedState,
          verifiedCountry:     c.country || null,
          locationVerified,
          industry:            c.industry           || null,
          estimatedEmployees:  c.estimatedEmployees || null,
          summary:             c.summary            || null,
          fitScore:            c.fitScore           ?? null,
          sourceCitations:     c.sourceCitations    ?? [],
          employeeCountSource: c.employeeCountTier  ?? null,
          source:              "ai_discover",
        },
      })
    } catch {
      // Duplicate domain in list — skip silently (the @@unique constraint fires)
    }
  }
}

// ─── Job helpers ──────────────────────────────────────────────────────────────

// Conservative per-unit costs — slightly above public list prices so the cap
// acts as a true backstop rather than a soft estimate.
// Claude Sonnet 5.5: $5/1M input, $20/1M output (rounded up from list price).
// Web search: Anthropic charges $10/1000 results ≈ $0.01/call.
const COST_PER_INPUT_TOKEN  = 5e-6   // $5 / 1,000,000
const COST_PER_OUTPUT_TOKEN = 2e-5   // $20 / 1,000,000
const COST_PER_SEARCH       = 0.01   // $10 / 1,000 searches

export function estimatedJobCost(
  inputTokensTotal:  number,
  outputTokensTotal: number,
  searchCallsTotal:  number,
): number {
  return (
    inputTokensTotal  * COST_PER_INPUT_TOKEN +
    outputTokensTotal * COST_PER_OUTPUT_TOKEN +
    searchCallsTotal  * COST_PER_SEARCH
  )
}

export function shouldRunNextRound(
  roundsCompleted:   number,
  roundsMax:         number,
  acceptedCount:     number,
  requestedCount:    number,
  createdAt:         Date,
  timeLimitMs        = 15 * 60 * 1000,
  inputTokensTotal   = 0,
  outputTokensTotal  = 0,
  searchCallsTotal   = 0,
  budgetUsd          = 2.0,
): boolean {
  if (acceptedCount >= requestedCount)                  return false
  if (roundsCompleted >= roundsMax)                     return false
  if (Date.now() - createdAt.getTime() > timeLimitMs)  return false
  if (estimatedJobCost(inputTokensTotal, outputTokensTotal, searchCallsTotal) >= budgetUsd) return false
  return true
}

// Build the BatchProcessOpts needed by processDiscoveryBatch for a job.
// Loads CRM state from DB every time (called once per round, not per call).
export async function buildBatchOpts(criteria: JobCriteria): Promise<BatchProcessOpts> {
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

  return {
    stateProvince:      criteria.stateProvince,
    domainToProspect,
    nameToProspect,
    domainToLastContact,
  }
}
