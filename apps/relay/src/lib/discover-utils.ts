import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { normalizeCompanyName } from "@/lib/prospect-utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmployeeCountTier = "web_confirmed" | "web_estimated" | "unknown"
export type QualificationTier = "qualified" | "potential" | "location_unverified"

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

export type DiscoveredCompany = DiscoveredCompanyDetails

// ─── Constants ────────────────────────────────────────────────────────────────

export const THIRD_PARTY_PROFILE_DOMAINS = new Set([
  "linkedin.com", "pitchbook.com", "glassdoor.com", "zoominfo.com",
  "crunchbase.com", "dnb.com", "hoovers.com", "manta.com",
  "bloomberg.com", "owler.com", "craft.co", "signalhire.com",
  "rocketreach.co", "apollo.io",
])

export const VALID_TIER = new Set<string>(["web_confirmed", "web_estimated", "unknown"])

export const US_ABBREVS: Record<string, string> = {
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

// ─── Utility functions ────────────────────────────────────────────────────────

export function extractDomain(url: string): string | null {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "") }
  catch { return null }
}

export function isThirdPartyProfileUrl(url: string): boolean {
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "")
    const parts = hostname.split(".")
    for (let i = 0; i < parts.length - 1; i++) {
      if (THIRD_PARTY_PROFILE_DOMAINS.has(parts.slice(i).join("."))) return true
    }
    return false
  } catch { return false }
}

export function normaliseState(raw: string): string {
  const lower = raw.trim().toLowerCase()
  return US_ABBREVS[lower] ?? lower
}

export function extractArray(raw: string): Record<string, unknown>[] | null {
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

export function normalise(raw: Record<string, unknown>): DiscoveredCompanyBasic {
  const fitScore  = Number(raw.fitScore ?? raw.aiFitScore ?? raw.fit_score ?? 70)
  const tierRaw   = String(raw.employeeCountTier ?? raw.employee_count_tier ?? "unknown").toLowerCase()
  const citations = Array.isArray(raw.sourceCitations)
    ? (raw.sourceCitations as unknown[]).filter((u): u is string => typeof u === "string")
    : []
  let websiteRaw = String(raw.website ?? raw.url ?? "")
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
    qualificationTier:  "potential" as QualificationTier,
    sourceCitations:    citations,
    locationVerified:   false,
    summary:            String(raw.summary ?? raw.researchSummary ?? raw.description ?? raw.oneSentenceSummary ?? ""),
    fitScore:           Math.min(100, Math.max(0, isNaN(fitScore) ? 70 : fitScore)),
    crmStatus:          "none",
  }
}

export function collectUrls(content: Anthropic.ContentBlock[]): Set<string> {
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

// ─── Batch processing ─────────────────────────────────────────────────────────

export interface BatchProcessOpts {
  stateProvince?:       string
  domainToProspect:     Map<string, { id: string }>
  nameToProspect:       Map<string, { id: string }>
  domainToLastContact:  Map<string, Date>
  excludeDomains?:      Set<string>
  excludeNormNames?:    Set<string>
}

export interface BatchDiagnostics {
  rawCount:            number
  sessionDedupExcluded: number
  geoMismatch:         number
  crmExcluded:         number
  netNew:              number
}

export interface BatchResult {
  companies:           DiscoveredCompanyBasic[]
  preFilterCompanies:  DiscoveredCompanyBasic[]
  rawText:             string
  diagnostics:         BatchDiagnostics
}

export function processDiscoveryBatch(
  content:       Anthropic.ContentBlock[],
  confirmedUrls: Set<string>,
  opts:          BatchProcessOpts
): BatchResult {
  const textBlocks = content.filter((b): b is Anthropic.TextBlock => b.type === "text")
  if (textBlocks.length === 0) {
    return { companies: [], preFilterCompanies: [], rawText: "", diagnostics: { rawCount: 0, sessionDedupExcluded: 0, geoMismatch: 0, crmExcluded: 0, netNew: 0 } }
  }

  const rawText = textBlocks.at(-1)!.text.trim()
  const parsed  = extractArray(rawText)
  if (!parsed || parsed.length === 0) {
    return { companies: [], preFilterCompanies: [], rawText, diagnostics: { rawCount: 0, sessionDedupExcluded: 0, geoMismatch: 0, crmExcluded: 0, netNew: 0 } }
  }

  const rawCount = parsed.length
  const excludeDomains   = opts.excludeDomains   ?? new Set<string>()
  const excludeNormNames = opts.excludeNormNames ?? new Set<string>()

  let sessionDedupExcluded = 0
  let cos: DiscoveredCompanyBasic[] = parsed
    .map(p => normalise(p))
    .filter(c => {
      if (!c.companyName || c.companyName === "Unknown") return false
      const dom  = c.website ? extractDomain(c.website) : null
      if (dom  && excludeDomains.has(dom))   { sessionDedupExcluded++; return false }
      const norm = normalizeCompanyName(c.companyName)
      if (norm && excludeNormNames.has(norm)) { sessionDedupExcluded++; return false }
      return true
    })

  // Citation validation
  if (confirmedUrls.size > 0) {
    for (const c of cos) {
      c.sourceCitations = c.sourceCitations.filter(url => confirmedUrls.has(url))
    }
  }

  // Geographic validation
  if (opts.stateProvince) {
    const reqNorm = normaliseState(opts.stateProvince)
    for (const c of cos) {
      c.locationVerified = normaliseState(c.state) !== "" && normaliseState(c.state) === reqNorm
    }
  } else {
    for (const c of cos) c.locationVerified = true
  }

  const geoMismatch = cos.filter(c => !c.locationVerified).length

  // Qualification tier
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
      const prospectMatch = opts.domainToProspect.get(websiteDomain)
      const lastContact   = opts.domainToLastContact.get(websiteDomain)
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
      const nameMatch = normName ? opts.nameToProspect.get(normName) : null
      if (nameMatch) {
        c.crmStatus     = "in_crm"
        c.crmProspectId = nameMatch.id
      }
    }
  }

  const preFilterCompanies = [...cos]
  cos = cos.filter(c => c.crmStatus === "none")
  const crmExcluded = preFilterCompanies.length - cos.length

  return {
    companies: cos,
    preFilterCompanies,
    rawText,
    diagnostics: { rawCount, sessionDedupExcluded, geoMismatch, crmExcluded, netNew: cos.length },
  }
}
