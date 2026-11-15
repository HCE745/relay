/**
 * Tests for research-agent.ts — pure-function layer.
 *
 * Covers: updateAgentState, shouldRunNextRound, buildSystemPrompt,
 * buildRoundPrompt adaptive hints, and runResearchRound (mocked Anthropic).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

const mockCreate = vi.fn()

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prospect:               { findMany: vi.fn() },
    crmEmail:               { findMany: vi.fn() },
    prospectResearchResult: { findMany: vi.fn(), create: vi.fn() },
  },
}))

vi.mock("@/lib/prospect-utils", () => ({
  normalizeCompanyName: (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ""),
}))

vi.mock("@/lib/discover-utils", () => ({
  extractDomain:          (url: string) => {
    try {
      const h = new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      return h.replace(/^www\./, "").toLowerCase()
    } catch { return null }
  },
  collectUrls:            (_content: unknown[]) => new Set<string>(),
  processDiscoveryBatch:  vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { processDiscoveryBatch } from "@/lib/discover-utils"
import {
  updateAgentState,
  shouldRunNextRound,
  buildSystemPrompt,
  buildRoundPrompt,
  runResearchRound,
  EMPTY_AGENT_STATE,
  type JobCriteria,
  type AgentState,
} from "@/lib/research-agent"

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_CRITERIA: JobCriteria = {
  country:          "United States",
  stateProvince:    "IN",
  industry:         "Manufacturing",
  employeeCountMin: 50,
  employeeCountMax: 300,
  requestedCount:   20,
}

function makeCompany(name: string, website = `https://${name.toLowerCase().replace(/\s/g, "")}.com`) {
  return {
    companyName:        name,
    website,
    city:               "Indianapolis",
    state:              "IN",
    country:            "United States",
    industry:           "Metal Fabrication",
    estimatedEmployees: "80-150",
    employeeCountTier:  "web_confirmed" as const,
    qualificationTier:  "qualified" as const,
    sourceCitations:    [],
    locationVerified:   true,
    summary:            `${name} makes parts.`,
    fitScore:           75,
    crmStatus:          "none" as const,
  }
}

function setupPrismaMocks() {
  vi.mocked(prisma.prospect.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.crmEmail.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.prospectResearchResult.findMany).mockResolvedValue([] as never)
  vi.mocked(prisma.prospectResearchResult.create).mockResolvedValue({} as never)
}

// ─── updateAgentState ─────────────────────────────────────────────────────────

describe("updateAgentState", () => {
  it("accumulates seen domains", () => {
    const all   = [makeCompany("Acme Corp"), makeCompany("Beta Mfg")]
    const state = updateAgentState(EMPTY_AGENT_STATE, all, all, 0, 0, 1, ["Metal Fabrication"], "general_web")
    expect(state.seenDomains).toContain("acmecorp.com")
    expect(state.seenDomains).toContain("betamfg.com")
  })

  it("accumulates seen normalized names", () => {
    const all   = [makeCompany("Acme Corp")]
    const state = updateAgentState(EMPTY_AGENT_STATE, all, all, 0, 0, 1, [], "general_web")
    expect(state.seenNormNames).toContain("acmecorp")
  })

  it("tracks source strategies without duplicates", () => {
    const s1 = updateAgentState(EMPTY_AGENT_STATE, [], [], 0, 0, 1, [], "general_web")
    const s2 = updateAgentState(s1, [], [], 0, 0, 2, [], "general_web")
    expect(s2.sourceStrategies.filter(s => s === "general_web").length).toBe(1)
  })

  it("accumulates crm and geo filtered totals", () => {
    const state = updateAgentState(EMPTY_AGENT_STATE, [], [], 3, 2, 1, [], "general_web")
    expect(state.totalCrmFiltered).toBe(3)
    expect(state.totalGeoFiltered).toBe(2)
  })

  it("adds round record", () => {
    const state = updateAgentState(EMPTY_AGENT_STATE, [makeCompany("X")], [makeCompany("X")], 1, 0, 1, ["Metal Fabrication"], "thomasnet")
    expect(state.rounds).toHaveLength(1)
    expect(state.rounds[0].roundNum).toBe(1)
    expect(state.rounds[0].sourceStrategy).toBe("thomasnet")
  })

  it("does not duplicate already-seen domains", () => {
    const co  = makeCompany("Acme Corp")
    const s1  = updateAgentState(EMPTY_AGENT_STATE, [co], [co], 0, 0, 1, [], "general_web")
    const s2  = updateAgentState(s1, [co], [co], 0, 0, 2, [], "thomasnet")
    const doms = s2.seenDomains.filter(d => d === "acmecorp.com")
    expect(doms).toHaveLength(1)
  })

  it("tracks subsectors used", () => {
    const state = updateAgentState(EMPTY_AGENT_STATE, [], [], 0, 0, 1, ["Metal Fabrication", "Food Processing"], "general_web")
    expect(state.subsectorsUsed).toContain("Metal Fabrication")
    expect(state.subsectorsUsed).toContain("Food Processing")
  })
})

// ─── shouldRunNextRound ───────────────────────────────────────────────────────

describe("shouldRunNextRound", () => {
  const recentDate = new Date()

  it("returns true when under target, rounds, and time", () => {
    expect(shouldRunNextRound(1, 5, 10, 20, recentDate)).toBe(true)
  })

  it("returns false when acceptedCount >= requestedCount", () => {
    expect(shouldRunNextRound(1, 5, 20, 20, recentDate)).toBe(false)
  })

  it("returns false when roundsCompleted >= roundsMax", () => {
    expect(shouldRunNextRound(5, 5, 5, 20, recentDate)).toBe(false)
  })

  it("returns false when time limit exceeded", () => {
    const oldDate = new Date(Date.now() - 16 * 60 * 1000)
    expect(shouldRunNextRound(1, 5, 5, 20, oldDate)).toBe(false)
  })

  it("respects custom timeLimitMs", () => {
    const oldDate = new Date(Date.now() - 5 * 60 * 1000)
    // 10 min limit — 5 min old should still pass
    expect(shouldRunNextRound(1, 5, 5, 20, oldDate, 10 * 60 * 1000)).toBe(true)
    // 3 min limit — 5 min old should fail
    expect(shouldRunNextRound(1, 5, 5, 20, oldDate, 3 * 60 * 1000)).toBe(false)
  })
})

// ─── buildSystemPrompt ────────────────────────────────────────────────────────

describe("buildSystemPrompt", () => {
  it("contains industry and JSON instruction", () => {
    const p = buildSystemPrompt(BASE_CRITERIA)
    expect(p).toContain("Manufacturing")
    expect(p).toContain("JSON array")
  })
})

// ─── buildRoundPrompt — adaptive hints ───────────────────────────────────────

describe("buildRoundPrompt adaptive hints", () => {
  it("omits STRATEGY NOTE on round 1", () => {
    const p = buildRoundPrompt({
      criteria:         BASE_CRITERIA,
      state:            EMPTY_AGENT_STATE,
      roundNum:         1,
      needed:           20,
      exclusionNames:   "",
      exclusionDomains: [],
      subsectors:       ["Metal Fabrication"],
      strategy:         "general_web",
    })
    expect(p).not.toContain("STRATEGY NOTE FOR THIS ROUND")
  })

  it("includes STRATEGY NOTE on round 2 with no specific problem", () => {
    const state: AgentState = {
      ...EMPTY_AGENT_STATE,
      totalCandidates:  10,
      totalCrmFiltered: 2,
      totalGeoFiltered: 1,
      rounds: [{
        roundNum: 1, candidateCount: 10, acceptedCount: 7,
        crmFiltered: 2, geoFiltered: 1,
        subsectors: ["Metal Fabrication"], sourceStrategy: "general_web",
      }],
    }
    const p = buildRoundPrompt({
      criteria:         BASE_CRITERIA,
      state,
      roundNum:         2,
      needed:           13,
      exclusionNames:   "",
      exclusionDomains: [],
      subsectors:       ["Food Processing"],
      strategy:         "thomasnet",
    })
    expect(p).toContain("STRATEGY NOTE FOR THIS ROUND")
  })

  it("includes LESS-VISIBLE hint when CRM exclusion rate > 40%", () => {
    const state: AgentState = {
      ...EMPTY_AGENT_STATE,
      totalCandidates:  10,
      totalCrmFiltered: 5,
      totalGeoFiltered: 0,
      rounds: [{
        roundNum: 1, candidateCount: 10, acceptedCount: 5,
        crmFiltered: 5, geoFiltered: 0,
        subsectors: [], sourceStrategy: "general_web",
      }],
    }
    const p = buildRoundPrompt({
      criteria: BASE_CRITERIA, state, roundNum: 2, needed: 15,
      exclusionNames: "", exclusionDomains: [], subsectors: [], strategy: "thomasnet",
    })
    expect(p).toContain("already in our CRM")
    expect(p).toContain("LESS-VISIBLE")
  })

  it("includes geo hint when geo mismatch rate > 30%", () => {
    const state: AgentState = {
      ...EMPTY_AGENT_STATE,
      totalCandidates:  10,
      totalCrmFiltered: 0,
      totalGeoFiltered: 4,
      rounds: [{
        roundNum: 1, candidateCount: 10, acceptedCount: 6,
        crmFiltered: 0, geoFiltered: 4,
        subsectors: [], sourceStrategy: "general_web",
      }],
    }
    const p = buildRoundPrompt({
      criteria: BASE_CRITERIA, state, roundNum: 2, needed: 14,
      exclusionNames: "", exclusionDomains: [], subsectors: [], strategy: "thomasnet",
    })
    expect(p).toContain("outside the target region")
  })

  it("excludes seen domains in prompt", () => {
    const state: AgentState = {
      ...EMPTY_AGENT_STATE,
      seenDomains: ["acmecorp.com"],
    }
    const p = buildRoundPrompt({
      criteria: BASE_CRITERIA, state, roundNum: 1, needed: 20,
      exclusionNames: "", exclusionDomains: [], subsectors: [], strategy: "general_web",
    })
    expect(p).toContain("acmecorp.com")
  })

  it("includes fallback prompt without verification steps", () => {
    const p = buildRoundPrompt({
      criteria: BASE_CRITERIA, state: EMPTY_AGENT_STATE, roundNum: 1, needed: 5,
      exclusionNames: "", exclusionDomains: [], subsectors: [], strategy: "general_web",
      isFallback: true,
    })
    expect(p).not.toContain("STEP 2 — HEADCOUNT VERIFICATION")
    expect(p).toContain("unknown")
  })
})

// ─── runResearchRound ─────────────────────────────────────────────────────────

describe("runResearchRound", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupPrismaMocks()
  })

  function makeResponse(companies: object[]) {
    return {
      content:     [{ type: "text", text: JSON.stringify(companies) }],
      usage:       { input_tokens: 1000, output_tokens: 300 },
      stop_reason: "end_turn",
    }
  }

  const baseBatchOpts = {
    existingProspects:   [],
    domainToProspect:    new Map(),
    nameToProspect:      new Map(),
    domainToLastContact: new Map(),
    requestedCountry:    "United States",
    requestedState:      "IN",
  }

  it("returns accepted companies and token counts", async () => {
    const co = makeCompany("Acme Corp")
    mockCreate.mockResolvedValue(makeResponse([co]))
    vi.mocked(processDiscoveryBatch).mockReturnValue({
      companies:           [co],
      preFilterCompanies:  [co],
      diagnostics:         { crmExcluded: 0, geoMismatch: 0, totalRaw: 1 },
    } as never)

    const result = await runResearchRound({
      apiKey:   "test",
      criteria: BASE_CRITERIA,
      state:    EMPTY_AGENT_STATE,
      roundNum: 1,
      needed:   20,
      listId:   "list-1",
      batchOpts: baseBatchOpts,
    })

    expect(result.accepted).toHaveLength(1)
    expect(result.inputTokens).toBe(1000)
    expect(result.outputTokens).toBe(300)
    expect(result.crmFiltered).toBe(0)
    expect(result.geoFiltered).toBe(0)
  })

  it("returns empty result when no text block in response", async () => {
    mockCreate.mockResolvedValue({
      content:     [{ type: "tool_use", id: "x", name: "web_search", input: {} }],
      usage:       { input_tokens: 500, output_tokens: 0 },
      stop_reason: "tool_use",
    })

    const result = await runResearchRound({
      apiKey: "test", criteria: BASE_CRITERIA, state: EMPTY_AGENT_STATE,
      roundNum: 1, needed: 20, listId: "list-1", batchOpts: baseBatchOpts,
    })

    expect(result.accepted).toHaveLength(0)
    expect(result.allCandidates).toHaveLength(0)
  })

  it("saves accepted companies to list", async () => {
    const co = makeCompany("SaveMe Inc")
    mockCreate.mockResolvedValue(makeResponse([co]))
    vi.mocked(processDiscoveryBatch).mockReturnValue({
      companies:           [co],
      preFilterCompanies:  [co],
      diagnostics:         { crmExcluded: 0, geoMismatch: 0, totalRaw: 1 },
    } as never)

    await runResearchRound({
      apiKey: "test", criteria: BASE_CRITERIA, state: EMPTY_AGENT_STATE,
      roundNum: 1, needed: 20, listId: "list-99", batchOpts: baseBatchOpts,
    })

    expect(prisma.prospectResearchResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ listId: "list-99", companyName: "SaveMe Inc" }),
      })
    )
  })

  it("does not save when no companies accepted", async () => {
    mockCreate.mockResolvedValue(makeResponse([]))
    vi.mocked(processDiscoveryBatch).mockReturnValue({
      companies:           [],
      preFilterCompanies:  [],
      diagnostics:         { crmExcluded: 0, geoMismatch: 0, totalRaw: 0 },
    } as never)

    await runResearchRound({
      apiKey: "test", criteria: BASE_CRITERIA, state: EMPTY_AGENT_STATE,
      roundNum: 1, needed: 20, listId: "list-99", batchOpts: baseBatchOpts,
    })

    expect(prisma.prospectResearchResult.create).not.toHaveBeenCalled()
  })

  it("reports CRM and geo filtered counts from processDiscoveryBatch", async () => {
    const co = makeCompany("Acme Corp")
    mockCreate.mockResolvedValue(makeResponse([co]))
    vi.mocked(processDiscoveryBatch).mockReturnValue({
      companies:           [],
      preFilterCompanies:  [co, makeCompany("Beta"), makeCompany("Gamma"), makeCompany("Delta")],
      diagnostics:         { crmExcluded: 2, geoMismatch: 1, totalRaw: 4 },
    } as never)

    const result = await runResearchRound({
      apiKey: "test", criteria: BASE_CRITERIA, state: EMPTY_AGENT_STATE,
      roundNum: 1, needed: 20, listId: "list-1", batchOpts: baseBatchOpts,
    })

    expect(result.crmFiltered).toBe(2)
    expect(result.geoFiltered).toBe(1)
    expect(result.accepted).toHaveLength(0)
  })

  it("excludes already-seen list domains from agent state", async () => {
    vi.mocked(prisma.prospectResearchResult.findMany).mockResolvedValue([
      { normalizedDomain: "existing.com", companyName: "Existing Co" },
    ] as never)

    const co = makeCompany("New Co", "https://newco.com")
    mockCreate.mockResolvedValue(makeResponse([co]))
    vi.mocked(processDiscoveryBatch).mockReturnValue({
      companies:           [co],
      preFilterCompanies:  [co],
      diagnostics:         { crmExcluded: 0, geoMismatch: 0, totalRaw: 1 },
    } as never)

    await runResearchRound({
      apiKey: "test", criteria: BASE_CRITERIA, state: EMPTY_AGENT_STATE,
      roundNum: 1, needed: 20, listId: "list-1", batchOpts: baseBatchOpts,
    })

    // The prompt passed to Claude should contain the existing domain
    const callArgs = mockCreate.mock.calls[0][0] as { messages: { content: string }[] }
    const userMsg = callArgs.messages[0].content
    expect(userMsg).toContain("existing.com")
  })
})
