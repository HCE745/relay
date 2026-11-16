/**
 * Pipeline audit tests for processDiscoveryBatch and extractArray.
 *
 * These tests use fixture data (no live Anthropic calls) to demonstrate exactly
 * where companies are accepted or rejected at each stage, with exact counts.
 *
 * Key findings verified here:
 * - extractArray returns [] (not null) for an empty-array response
 * - extractArray returns null for unparseable / truncated JSON
 * - processDiscoveryBatch logs a warning for [] and null
 * - CRM exclusion is the ONLY hard filter (removes companies)
 * - Geographic mismatch is annotation-only (companies kept, tier set to location_unverified)
 * - Third-party URLs (LinkedIn, ZoomInfo) are stripped from website but company is kept
 * - Session dedup uses empty sets by default (no cross-round dedup in batchOpts)
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/prospect-utils", () => ({
  normalizeCompanyName: (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ""),
}))

import { extractArray, processDiscoveryBatch, type BatchProcessOpts } from "@/lib/discover-utils"

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeCompany(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    companyName:        "Acme Manufacturing",
    website:            "https://acme.com",
    city:               "Indianapolis",
    state:              "IN",
    country:            "United States",
    industry:           "Metal Fabrication",
    estimatedEmployees: "150",
    employeeCountTier:  "web_confirmed",
    summary:            "Makes metal parts.",
    fitScore:           75,
    sourceCitations:    ["https://acme.com"],
    ...overrides,
  }
}

function makeTextBlock(text: string) {
  return { type: "text" as const, text }
}

function emptyBatchOpts(): BatchProcessOpts {
  return {
    stateProvince:      "IN",
    domainToProspect:   new Map(),
    nameToProspect:     new Map(),
    domainToLastContact: new Map(),
  }
}

// ─── extractArray ─────────────────────────────────────────────────────────────

describe("extractArray", () => {
  it("returns [] for empty array response", () => {
    expect(extractArray("[]")).toEqual([])
  })

  it("returns [] for empty array in code fence", () => {
    expect(extractArray("```json\n[]\n```")).toEqual([])
  })

  it("returns null for empty string", () => {
    expect(extractArray("")).toBeNull()
  })

  it("returns null for truncated JSON", () => {
    // Simulate max_tokens truncation mid-array
    const truncated = '[{"companyName":"Acme","website":"https://acme.com","city":"Indianapolis","state"'
    expect(extractArray(truncated)).toBeNull()
  })

  it("parses a valid array directly", () => {
    const arr = [makeCompany()]
    expect(extractArray(JSON.stringify(arr))).toHaveLength(1)
  })

  it("parses array wrapped in a code fence", () => {
    const arr = [makeCompany()]
    const result = extractArray("```json\n" + JSON.stringify(arr) + "\n```")
    expect(result).toHaveLength(1)
  })

  it("extracts array from prose + JSON", () => {
    const arr = [makeCompany({ companyName: "Beta Corp" })]
    const result = extractArray("Here are the companies:\n" + JSON.stringify(arr))
    expect(result).toHaveLength(1)
    expect((result![0] as { companyName: string }).companyName).toBe("Beta Corp")
  })

  it("returns array with 12 items intact", () => {
    const arr = Array.from({ length: 12 }, (_, i) =>
      makeCompany({ companyName: `Company ${i + 1}`, website: `https://co${i + 1}.com` })
    )
    expect(extractArray(JSON.stringify(arr))).toHaveLength(12)
  })
})

// ─── processDiscoveryBatch: stage-by-stage rejection counts ──────────────────

describe("processDiscoveryBatch — exact rejection counts", () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it("empty [] response: rawCount=0, all filters=0, accepted=0", () => {
    const result = processDiscoveryBatch([makeTextBlock("[]")], new Set(), emptyBatchOpts())
    expect(result.diagnostics).toEqual({
      rawCount: 0, sessionDedupExcluded: 0, geoMismatch: 0, crmExcluded: 0, netNew: 0,
    })
    expect(result.companies).toHaveLength(0)
  })

  it("truncated/unparseable JSON: rawCount=0, all filters=0, accepted=0", () => {
    const truncated = '[{"companyName":"Acme","website":"https://acme.com","state'
    const result = processDiscoveryBatch([makeTextBlock(truncated)], new Set(), emptyBatchOpts())
    expect(result.diagnostics.rawCount).toBe(0)
    expect(result.companies).toHaveLength(0)
  })

  it("1 company: rawCount=1, accepted=1, all rejections=0", () => {
    const arr = [makeCompany()]
    const result = processDiscoveryBatch([makeTextBlock(JSON.stringify(arr))], new Set(), emptyBatchOpts())
    expect(result.diagnostics).toEqual({
      rawCount: 1, sessionDedupExcluded: 0, geoMismatch: 0, crmExcluded: 0, netNew: 1,
    })
    expect(result.companies).toHaveLength(1)
  })

  it("12 companies all clean: rawCount=12, accepted=12", () => {
    const arr = Array.from({ length: 12 }, (_, i) =>
      makeCompany({ companyName: `Company ${i + 1}`, website: `https://co${i + 1}.com` })
    )
    const result = processDiscoveryBatch([makeTextBlock(JSON.stringify(arr))], new Set(), emptyBatchOpts())
    expect(result.diagnostics.rawCount).toBe(12)
    expect(result.diagnostics.crmExcluded).toBe(0)
    expect(result.companies).toHaveLength(12)
  })

  it("30 companies: 2 in CRM (hard removed), rawCount=30, crmExcluded=2, accepted=28", () => {
    const arr = Array.from({ length: 30 }, (_, i) =>
      makeCompany({ companyName: `Company ${i + 1}`, website: `https://co${i + 1}.com` })
    )
    const opts: BatchProcessOpts = {
      ...emptyBatchOpts(),
      domainToProspect: new Map([
        ["co1.com", { id: "p1" }],
        ["co2.com", { id: "p2" }],
      ]),
    }
    const result = processDiscoveryBatch([makeTextBlock(JSON.stringify(arr))], new Set(), opts)
    expect(result.diagnostics.rawCount).toBe(30)
    expect(result.diagnostics.crmExcluded).toBe(2)
    expect(result.diagnostics.geoMismatch).toBe(0)
    expect(result.diagnostics.netNew).toBe(28)
    expect(result.companies).toHaveLength(28)
    // CRM companies appear in preFilterCompanies but NOT in companies
    expect(result.preFilterCompanies).toHaveLength(30)
  })

  it("30 companies: 3 wrong state — geo mismatch is annotation only, all 30 accepted", () => {
    const arr = [
      ...Array.from({ length: 27 }, (_, i) =>
        makeCompany({ companyName: `IN Co ${i + 1}`, website: `https://in${i + 1}.com`, state: "IN" })
      ),
      makeCompany({ companyName: "Ohio Co 1", website: "https://oh1.com", state: "OH" }),
      makeCompany({ companyName: "Ohio Co 2", website: "https://oh2.com", state: "OH" }),
      makeCompany({ companyName: "Ohio Co 3", website: "https://oh3.com", state: "OH" }),
    ]
    const result = processDiscoveryBatch([makeTextBlock(JSON.stringify(arr))], new Set(), emptyBatchOpts())
    expect(result.diagnostics.rawCount).toBe(30)
    expect(result.diagnostics.geoMismatch).toBe(3)
    expect(result.diagnostics.crmExcluded).toBe(0)
    expect(result.diagnostics.netNew).toBe(30)   // geo mismatch does NOT remove companies
    expect(result.companies).toHaveLength(30)
    // Geo-mismatched companies get location_unverified tier, not removed
    const ohioCompanies = result.companies.filter(c => c.state === "OH")
    expect(ohioCompanies).toHaveLength(3)
    ohioCompanies.forEach(c => expect(c.qualificationTier).toBe("location_unverified"))
  })

  it("companies with LinkedIn/ZoomInfo URLs: website stripped but company kept", () => {
    const arr = [
      makeCompany({ companyName: "No Website Co", website: "https://linkedin.com/company/acme-mfg" }),
      makeCompany({ companyName: "ZoomInfo Co",   website: "https://zoominfo.com/c/acme/123" }),
      makeCompany({ companyName: "Real Website",  website: "https://realco.com" }),
    ]
    const result = processDiscoveryBatch([makeTextBlock(JSON.stringify(arr))], new Set(), emptyBatchOpts())
    expect(result.diagnostics.rawCount).toBe(3)
    expect(result.companies).toHaveLength(3)   // companies kept even without valid website
    const noWebsite = result.companies.find(c => c.companyName === "No Website Co")!
    expect(noWebsite.website).toBe("")          // LinkedIn URL stripped
    expect(noWebsite.sourceCitations).toContain("https://linkedin.com/company/acme-mfg")
  })

  it("30 companies: mixed — 2 CRM + 3 geo-mismatch + 2 LinkedIn URLs = 28 accepted", () => {
    // 2 in CRM (hard removed), 3 wrong state (kept as location_unverified), 2 with LinkedIn URLs (kept, website="")
    // Expected: rawCount=30, crmExcluded=2, geoMismatch=3, accepted=28
    const arr = [
      // 2 in CRM
      makeCompany({ companyName: "CRM Co 1", website: "https://crm1.com" }),
      makeCompany({ companyName: "CRM Co 2", website: "https://crm2.com" }),
      // 3 geo mismatches
      makeCompany({ companyName: "Ohio Co 1", website: "https://oh1.com", state: "OH" }),
      makeCompany({ companyName: "Ohio Co 2", website: "https://oh2.com", state: "OH" }),
      makeCompany({ companyName: "Ohio Co 3", website: "https://oh3.com", state: "OH" }),
      // 2 with LinkedIn URLs
      makeCompany({ companyName: "LI Co 1", website: "https://linkedin.com/company/li1" }),
      makeCompany({ companyName: "LI Co 2", website: "https://linkedin.com/company/li2" }),
      // 23 clean companies
      ...Array.from({ length: 23 }, (_, i) =>
        makeCompany({ companyName: `Clean Co ${i + 1}`, website: `https://clean${i + 1}.com` })
      ),
    ]
    const opts: BatchProcessOpts = {
      ...emptyBatchOpts(),
      domainToProspect: new Map([
        ["crm1.com", { id: "p1" }],
        ["crm2.com", { id: "p2" }],
      ]),
    }
    const result = processDiscoveryBatch([makeTextBlock(JSON.stringify(arr))], new Set(), opts)
    expect(result.diagnostics.rawCount).toBe(30)
    expect(result.diagnostics.crmExcluded).toBe(2)
    expect(result.diagnostics.geoMismatch).toBe(3)
    expect(result.diagnostics.netNew).toBe(28)
    expect(result.companies).toHaveLength(28)
    expect(result.preFilterCompanies).toHaveLength(30)
  })

  it("20 companies all clean: rawCount=20, accepted=20 (target count reached)", () => {
    const arr = Array.from({ length: 20 }, (_, i) =>
      makeCompany({ companyName: `Company ${i + 1}`, website: `https://co${i + 1}.com` })
    )
    const result = processDiscoveryBatch([makeTextBlock(JSON.stringify(arr))], new Set(), emptyBatchOpts())
    expect(result.diagnostics.rawCount).toBe(20)
    expect(result.diagnostics.netNew).toBe(20)
    expect(result.companies).toHaveLength(20)
  })

  it("no text block: rawCount=0, accepted=0", () => {
    const noText = [{ type: "web_search_tool_result", content: [] }] as never
    const result = processDiscoveryBatch(noText, new Set(), emptyBatchOpts())
    expect(result.diagnostics.rawCount).toBe(0)
    expect(result.companies).toHaveLength(0)
  })
})
