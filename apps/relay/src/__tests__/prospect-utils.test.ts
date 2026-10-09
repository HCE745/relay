import { describe, it, expect, vi, beforeEach } from "vitest"
import { normalizeCompanyName, normalizeDomain, validateCommissionSplits, findDuplicateProspect } from "@/lib/prospect-utils"

// ── normalizeCompanyName ──────────────────────────────────────────────────────

describe("normalizeCompanyName", () => {
  it("lowercases the name", () => {
    expect(normalizeCompanyName("Relay Software")).toBe("relay software")
  })

  it("strips common suffixes: Inc", () => {
    expect(normalizeCompanyName("Midwest Precision Inc")).toBe("midwest precision")
  })

  it("strips LLC", () => {
    expect(normalizeCompanyName("Buckeye Metal LLC")).toBe("buckeye metal")
  })

  it("strips Corp and punctuation", () => {
    expect(normalizeCompanyName("Spartan Tooling & Die, Corp.")).toBe("spartan tooling die")
  })

  it("strips Ltd", () => {
    expect(normalizeCompanyName("Prairie Management Ltd")).toBe("prairie management")
  })

  it("collapses multiple spaces", () => {
    expect(normalizeCompanyName("  Great   Lakes  Stamping  ")).toBe("great lakes stamping")
  })

  it("returns same normalized value for equivalent names", () => {
    const a = normalizeCompanyName("Midwest Precision Parts Inc.")
    const b = normalizeCompanyName("midwest precision parts")
    expect(a).toBe(b)
  })
})

// ── normalizeDomain ───────────────────────────────────────────────────────────

describe("normalizeDomain", () => {
  it("extracts domain from full URL", () => {
    expect(normalizeDomain("https://www.midwestprecision.com/about")).toBe("midwestprecision.com")
  })

  it("strips www", () => {
    expect(normalizeDomain("www.buckeyemetal.com")).toBe("buckeyemetal.com")
  })

  it("handles bare domain", () => {
    expect(normalizeDomain("getrelay.software")).toBe("getrelay.software")
  })

  it("returns null for null input", () => {
    expect(normalizeDomain(null)).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(normalizeDomain("")).toBeNull()
  })
})

// ── validateCommissionSplits ──────────────────────────────────────────────────

describe("validateCommissionSplits", () => {
  it("returns null for a single 100% attribution", () => {
    expect(validateCommissionSplits([{ splitPercent: 100 }])).toBeNull()
  })

  it("returns null for splits that sum to 100", () => {
    expect(validateCommissionSplits([
      { splitPercent: 60 },
      { splitPercent: 40 },
    ])).toBeNull()
  })

  it("returns error when splits sum to more than 100", () => {
    const result = validateCommissionSplits([
      { splitPercent: 70 },
      { splitPercent: 50 },
    ])
    expect(result).toMatch(/120/)
  })

  it("returns error when splits sum to less than 100", () => {
    const result = validateCommissionSplits([
      { splitPercent: 50 },
      { splitPercent: 30 },
    ])
    expect(result).toMatch(/80/)
  })

  it("returns null for empty array", () => {
    expect(validateCommissionSplits([])).toBeNull()
  })
})

// ── findDuplicateProspect (mocked Prisma) ─────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prospect: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"

const mockProspects = [
  {
    id: "p_existing_1",
    companyName: "Midwest Precision Inc",
    website: "midwestprecision.com",
    assignedToName: "Alice",
    currentCrmStatus: "contacted",
  },
  {
    id: "p_existing_2",
    companyName: "Lakefront Property Services",
    website: "lakefrontps.com",
    assignedToName: "Bob",
    currentCrmStatus: "replied",
  },
]

describe("findDuplicateProspect", () => {
  beforeEach(() => {
    vi.mocked(prisma.prospect.findMany).mockResolvedValue(mockProspects as never)
  })

  it("returns duplicate on matching company name (normalized)", async () => {
    const result = await findDuplicateProspect({ companyName: "Midwest Precision Inc." })
    expect(result).not.toBeNull()
    expect(result?.id).toBe("p_existing_1")
  })

  it("returns duplicate on matching domain", async () => {
    const result = await findDuplicateProspect({
      companyName: "Some Other Name",
      website: "www.lakefrontps.com",
    })
    expect(result).not.toBeNull()
    expect(result?.id).toBe("p_existing_2")
  })

  it("returns null when no match", async () => {
    const result = await findDuplicateProspect({
      companyName: "Totally New Company",
      website: "totallynew.com",
    })
    expect(result).toBeNull()
  })

  it("excludes the record itself when excludeId is provided", async () => {
    vi.mocked(prisma.prospect.findMany).mockResolvedValue([])
    const result = await findDuplicateProspect({
      companyName: "Midwest Precision Inc",
      excludeId: "p_existing_1",
    })
    expect(result).toBeNull()
  })
})
