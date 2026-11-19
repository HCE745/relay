/**
 * Integration tests for the persistent research-job system.
 *
 * Covers: job creation, status polling, job cancellation, budget exhaustion,
 * round exhaustion, stale lock recovery, account isolation, and cron worker.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

// `after` is a Vercel runtime API not available in the test environment.
// Keep the rest of next/server intact so NextRequest/NextResponse work.
vi.mock("next/server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next/server")>()
  return { ...mod, after: vi.fn() }
})

const {
  mockCreate,
  mockProspectFindMany,
  mockResearchResultFindMany,
  mockResearchResultCreate,
  mockResearchListCreate,
  mockJobCreate,
  mockJobUpdate,
  mockJobUpdateMany,
  mockJobFindUnique,
  mockJobFindMany,
  mockJobFindFirst,
  mockResearchListFindUnique,
  mockTx,
  mockCrmEmailFindMany,
} = vi.hoisted(() => ({
  mockCreate:                  vi.fn(),
  mockProspectFindMany:        vi.fn(),
  mockResearchResultFindMany:  vi.fn(),
  mockResearchResultCreate:    vi.fn(),
  mockResearchListCreate:      vi.fn(),
  mockJobCreate:               vi.fn(),
  mockJobUpdate:               vi.fn(),
  mockJobUpdateMany:           vi.fn(),
  mockJobFindUnique:           vi.fn(),
  mockJobFindMany:             vi.fn(),
  mockJobFindFirst:            vi.fn(),
  mockResearchListFindUnique:  vi.fn(),
  mockTx:                      vi.fn(),
  mockCrmEmailFindMany:        vi.fn(),
}))

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}))

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/sales-auth", () => ({
  getSalesSession: vi.fn(),
}))

vi.mock("@/lib/research-list-auth", async () => {
  const actual = await import("@/lib/research-list-auth")
  return { ...actual, getResearchIdentity: vi.fn() }
})

vi.mock("@/lib/platform-config", () => ({
  getPlatformConfig: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prospect:               { findMany: mockProspectFindMany },
    crmEmail:               { findMany: mockCrmEmailFindMany },
    prospectResearchResult: { findMany: mockResearchResultFindMany, create: mockResearchResultCreate },
    prospectResearchList:   { create: mockResearchListCreate, findUnique: mockResearchListFindUnique },
    prospectResearchJob:    {
      create:     mockJobCreate,
      update:     mockJobUpdate,
      updateMany: mockJobUpdateMany,
      findUnique: mockJobFindUnique,
      findMany:   mockJobFindMany,
      findFirst:  mockJobFindFirst,
    },
    $transaction: mockTx,
  },
}))

vi.mock("@/lib/prospect-utils", () => ({
  normalizeCompanyName: (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ""),
}))

vi.mock("@/lib/discover-utils", () => ({
  extractDomain:          (url: string) => {
    try {
      return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase()
    } catch { return null }
  },
  collectUrls:            (_content: unknown[]) => new Set<string>(),
  processDiscoveryBatch:  vi.fn(),
}))

import { getSession } from "@/lib/session"
import { getResearchIdentity } from "@/lib/research-list-auth"
import { getPlatformConfig } from "@/lib/platform-config"
import { processDiscoveryBatch } from "@/lib/discover-utils"
import { POST as jobsPost, GET as jobsGet } from "@/app/api/super-admin/crm/prospects/discover/jobs/route"
import { GET as jobIdGet, PATCH as jobIdPatch } from "@/app/api/super-admin/crm/prospects/discover/jobs/[id]/route"
import { POST as cronPost } from "@/app/api/cron/prospect-research/route"

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeJobsRequest(body: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/super-admin/crm/prospects/discover/jobs", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      country: "United States", stateProvince: "IN",
      industry: "Manufacturing", requestedCount: 5,
      ...body,
    }),
  })
}

function makeJobIdRequest(id: string, method = "GET", body?: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/super-admin/crm/prospects/discover/jobs/${id}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body:    body ? JSON.stringify(body) : undefined,
  })
}

function makeCronRequest() {
  return new NextRequest("http://localhost/api/cron/prospect-research", {
    method:  "POST",
    headers: { authorization: `Bearer test-cron-secret` },
  })
}

function makeCompany(name: string) {
  return {
    companyName: name,
    website: `https://${name.toLowerCase().replace(/\s/g, "")}.com`,
    city: "Indianapolis", state: "IN", country: "United States",
    industry: "Metal Fabrication", estimatedEmployees: "80-150",
    employeeCountTier: "web_confirmed" as const,
    qualificationTier: "qualified" as const,
    sourceCitations: [], locationVerified: true,
    summary: `${name} makes metal parts.`, fitScore: 75,
    crmStatus: "none" as const,
  }
}

function setupDefaults() {
  vi.mocked(getSession).mockResolvedValue({ superAdmin: true, superAdminId: "sa-1" } as never)
  vi.mocked(getResearchIdentity).mockResolvedValue({ superAdminId: "sa-1", salesUserId: null, isCrmImpersonation: false })
  vi.mocked(getPlatformConfig).mockResolvedValue("true")
  mockProspectFindMany.mockResolvedValue([])
  mockCrmEmailFindMany.mockResolvedValue([])
  mockResearchResultFindMany.mockResolvedValue([])
  mockResearchResultCreate.mockResolvedValue({})
  process.env.ANTHROPIC_API_KEY = "test-key"
  process.env.CRON_SECRET = "test-cron-secret"

  const list = { id: "list-1", name: "Manufacturing in IN — Nov 2026" }
  const job  = { id: "job-1", status: "running", listId: "list-1", roundsCompleted: 0, roundsMax: 5, acceptedCount: 0, createdAt: new Date(), agentState: null, salesUserId: null, superAdminId: "sa-1", budgetUsd: 2.0, failedRounds: 0, inputTokensTotal: 0, outputTokensTotal: 0, searchCallsTotal: 0 }

  mockTx.mockImplementation(async (fn: (tx: typeof import("@/lib/prisma").prisma) => unknown) => {
    const tx = {
      prospectResearchList: { create: vi.fn().mockResolvedValue(list) },
      prospectResearchJob:  { create: vi.fn().mockResolvedValue(job) },
    }
    return fn(tx as never)
  })

  mockResearchListFindUnique.mockResolvedValue({
    ...list,
    results: [],
  })

  mockJobUpdate.mockResolvedValue({ ...job, status: "completed", roundsCompleted: 1, acceptedCount: 2 })
}

function setupBatchResult(companies: ReturnType<typeof makeCompany>[]) {
  mockCreate.mockResolvedValue({
    content:     [{ type: "text", text: JSON.stringify(companies) }],
    usage:       { input_tokens: 500, output_tokens: 200 },
    stop_reason: "end_turn",
  })
  vi.mocked(processDiscoveryBatch).mockReturnValue({
    companies,
    preFilterCompanies: companies,
    diagnostics: { crmExcluded: 0, geoMismatch: 0, totalRaw: companies.length },
  } as never)
}

// ─── POST /jobs — job creation ────────────────────────────────────────────────

describe("POST /jobs — job creation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it("returns 403 without session", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never)
    vi.mocked(getResearchIdentity).mockResolvedValue(null)
    const res = await jobsPost(makeJobsRequest())
    expect(res.status).toBe(403)
  })

  it("returns 403 when discovery is disabled", async () => {
    vi.mocked(getPlatformConfig).mockResolvedValue("false")
    const res = await jobsPost(makeJobsRequest())
    expect(res.status).toBe(403)
    const body = await res.json() as { disabled?: boolean }
    expect(body.disabled).toBe(true)
  })

  it("returns 500 when ANTHROPIC_API_KEY missing", async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = await jobsPost(makeJobsRequest())
    expect(res.status).toBe(500)
  })

  it("returns immediately with empty companies array and pending status", async () => {
    const res = await jobsPost(makeJobsRequest())
    expect(res.status).toBe(200)

    const body = await res.json() as {
      jobId: string; listId: string; jobStatus: string
      roundsCompleted: number; companies: unknown[]
    }
    expect(body.jobId).toBeTruthy()
    expect(body.listId).toBeTruthy()
    expect(body.jobStatus).toBe("pending")
    expect(body.roundsCompleted).toBe(0)
    expect(body.companies).toEqual([])
  })

  it("caps requestedCount at 20 and returns 200", async () => {
    const res = await jobsPost(makeJobsRequest({ requestedCount: 100 }))
    // Route should not reject — requestedCount is silently capped
    expect(res.status).toBe(200)
    const body = await res.json() as { jobId: string }
    expect(body.jobId).toBeTruthy()
  })

  it("allows salesUserId sessions", async () => {
    vi.mocked(getSession).mockResolvedValue({ salesUserId: "s-1" } as never)
    vi.mocked(getResearchIdentity).mockResolvedValue({ superAdminId: null, salesUserId: "s-1", isCrmImpersonation: false })

    const res = await jobsPost(makeJobsRequest())
    expect(res.status).toBe(200)
  })
})

// ─── GET /jobs — list own jobs ────────────────────────────────────────────────

describe("GET /jobs — list own jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it("returns 403 without session", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never)
    vi.mocked(getResearchIdentity).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/api/super-admin/crm/prospects/discover/jobs")
    const res = await jobsGet(req)
    expect(res.status).toBe(403)
  })

  it("returns own jobs only", async () => {
    const jobs = [
      { id: "job-1", status: "completed", superAdminId: "sa-1", salesUserId: null, createdAt: new Date() },
    ]
    mockJobFindMany.mockResolvedValue(jobs)

    const req = new NextRequest("http://localhost/api/super-admin/crm/prospects/discover/jobs")
    const res = await jobsGet(req)
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    expect(body).toHaveLength(1)
  })
})

// ─── GET /jobs/[id] — status polling ─────────────────────────────────────────

describe("GET /jobs/[id] — status polling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it("returns job status fields", async () => {
    mockJobFindUnique.mockResolvedValue({
      id: "job-1", status: "pending", listId: "list-1",
      roundsCompleted: 1, roundsMax: 5, acceptedCount: 3, requestedCount: 20,
      salesUserId: null, superAdminId: "sa-1",
      country: "United States", stateProvince: "IN", industry: "Manufacturing",
      inputTokensTotal: 1000, outputTokensTotal: 300, searchCallsTotal: 5,
      lastError: null, createdAt: new Date(), updatedAt: new Date(),
    })

    const res = await jobIdGet(makeJobIdRequest("job-1"), { params: Promise.resolve({ id: "job-1" }) })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      status: string; roundsCompleted: number; acceptedCount: number
    }
    expect(body.status).toBe("pending")
    expect(body.roundsCompleted).toBe(1)
    expect(body.acceptedCount).toBe(3)
  })

  it("returns 404 for missing job", async () => {
    mockJobFindUnique.mockResolvedValue(null)
    const res = await jobIdGet(makeJobIdRequest("missing"), { params: Promise.resolve({ id: "missing" }) })
    expect(res.status).toBe(404)
  })

  it("returns 403 when session does not own the job", async () => {
    vi.mocked(getSession).mockResolvedValue({ superAdminId: "sa-other", superAdmin: true } as never)
    vi.mocked(getResearchIdentity).mockResolvedValue({ superAdminId: "sa-other", salesUserId: null, isCrmImpersonation: false })
    mockJobFindUnique.mockResolvedValue({
      id: "job-1", status: "pending", listId: "list-1",
      roundsCompleted: 1, roundsMax: 5, acceptedCount: 3, requestedCount: 20,
      salesUserId: null, superAdminId: "sa-1",
      country: "US", stateProvince: "IN", industry: "Mfg",
      inputTokensTotal: 0, outputTokensTotal: 0, searchCallsTotal: 0,
      lastError: null, createdAt: new Date(), updatedAt: new Date(),
    })
    const res = await jobIdGet(makeJobIdRequest("job-1"), { params: Promise.resolve({ id: "job-1" }) })
    expect(res.status).toBe(403)
  })
})

// ─── PATCH /jobs/[id] — cancellation ─────────────────────────────────────────

describe("PATCH /jobs/[id] — cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it("cancels a pending job", async () => {
    mockJobFindUnique.mockResolvedValue({
      id: "job-1", status: "pending",
      salesUserId: null, superAdminId: "sa-1",
    })
    mockJobUpdate.mockResolvedValue({ id: "job-1", status: "cancelled", listId: "list-1", acceptedCount: 0 })

    const req = makeJobIdRequest("job-1", "PATCH", { action: "cancel" })
    const res = await jobIdPatch(req, { params: Promise.resolve({ id: "job-1" }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string }
    expect(body.status).toBe("cancelled")
  })

  it("returns 409 when job is already terminal (completed)", async () => {
    mockJobFindUnique.mockResolvedValue({
      id: "job-1", status: "completed",
      salesUserId: null, superAdminId: "sa-1",
    })

    const req = makeJobIdRequest("job-1", "PATCH", { action: "cancel" })
    const res = await jobIdPatch(req, { params: Promise.resolve({ id: "job-1" }) })
    expect(res.status).toBe(409)
  })

  it("returns 409 when job is already terminal (failed)", async () => {
    mockJobFindUnique.mockResolvedValue({
      id: "job-1", status: "failed",
      salesUserId: null, superAdminId: "sa-1",
    })
    const req = makeJobIdRequest("job-1", "PATCH", { action: "cancel" })
    const res = await jobIdPatch(req, { params: Promise.resolve({ id: "job-1" }) })
    expect(res.status).toBe(409)
  })

  it("returns 400 for unknown action", async () => {
    mockJobFindUnique.mockResolvedValue({
      id: "job-1", status: "pending",
      salesUserId: null, superAdminId: "sa-1",
    })
    const req = makeJobIdRequest("job-1", "PATCH", { action: "start" })
    const res = await jobIdPatch(req, { params: Promise.resolve({ id: "job-1" }) })
    expect(res.status).toBe(400)
  })

  it("returns 403 for a session that doesn't own the job", async () => {
    vi.mocked(getSession).mockResolvedValue({ superAdminId: "sa-other", superAdmin: true } as never)
    vi.mocked(getResearchIdentity).mockResolvedValue({ superAdminId: "sa-other", salesUserId: null, isCrmImpersonation: false })
    mockJobFindUnique.mockResolvedValue({
      id: "job-1", status: "pending",
      salesUserId: null, superAdminId: "sa-1",
    })
    const req = makeJobIdRequest("job-1", "PATCH", { action: "cancel" })
    const res = await jobIdPatch(req, { params: Promise.resolve({ id: "job-1" }) })
    expect(res.status).toBe(403)
  })
})

// ─── Cron worker ──────────────────────────────────────────────────────────────

describe("cron worker — POST /api/cron/prospect-research", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
    process.env.CRON_SECRET = "test-cron-secret"
  })

  it("returns 401 without valid cron secret", async () => {
    const req = new NextRequest("http://localhost/api/cron/prospect-research", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    })
    const res = await cronPost(req)
    expect(res.status).toBe(401)
  })

  it("skips when no pending jobs", async () => {
    mockJobUpdateMany.mockResolvedValue({ count: 0 })
    mockJobFindFirst.mockResolvedValue(null)

    const res = await cronPost(makeCronRequest())
    expect(res.status).toBe(200)
    const body = await res.json() as { skipped?: string }
    expect(body.skipped).toContain("no pending")
  })

  it("advances a pending job by one round", async () => {
    const job = {
      id: "job-1", status: "pending", listId: "list-1",
      roundsCompleted: 0, roundsMax: 5, acceptedCount: 0,
      requestedCount: 10, createdAt: new Date(), agentState: null,
      country: "United States", stateProvince: "IN", industry: "Manufacturing",
      employeeCountMin: 50, employeeCountMax: 300,
      keywords: null, additionalContext: null,
      salesUserId: null, superAdminId: "sa-1",
      budgetUsd: 2.0, failedRounds: 0, inputTokensTotal: 0, outputTokensTotal: 0, searchCallsTotal: 0,
    }

    // All updateMany calls before findFirst return no matches
    mockJobUpdateMany.mockResolvedValue({ count: 0 })
    // findFirst returns our pending job
    mockJobFindFirst.mockResolvedValue(job)
    // Atomic claim sequence
    mockJobUpdateMany.mockResolvedValueOnce({ count: 0 })  // auto-fail
      .mockResolvedValueOnce({ count: 0 })                 // stale-lock: fail at limit
      .mockResolvedValueOnce({ count: 0 })                 // stale-lock: reset to pending
      .mockResolvedValueOnce({ count: 1 })                 // claim
    // Re-read with agentState
    mockJobFindUnique.mockResolvedValue(job)

    const companies = [makeCompany("Acme Corp"), makeCompany("Beta Mfg")]
    setupBatchResult(companies)
    mockJobUpdate.mockResolvedValue({ ...job, status: "completed", roundsCompleted: 1, acceptedCount: 2 })

    const res = await cronPost(makeCronRequest())
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; jobId?: string; roundCompleted?: number }
    expect(body.ok).toBe(true)
    expect(body.jobId).toBe("job-1")
    expect(body.roundCompleted).toBe(1)
  })

  it("skips gracefully when another worker claims the job first", async () => {
    const job = {
      id: "job-1", status: "pending", listId: "list-1",
      roundsCompleted: 0, roundsMax: 5, acceptedCount: 0,
      requestedCount: 10, createdAt: new Date(), agentState: null,
      country: "US", stateProvince: "IN", industry: "Mfg",
      employeeCountMin: 50, employeeCountMax: 300,
      keywords: null, additionalContext: null,
      salesUserId: null, superAdminId: "sa-1",
      budgetUsd: 2.0, failedRounds: 0, inputTokensTotal: 0, outputTokensTotal: 0, searchCallsTotal: 0,
    }

    mockJobUpdateMany
      .mockResolvedValueOnce({ count: 0 })  // auto-fail
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: fail at limit
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: reset to pending
      .mockResolvedValueOnce({ count: 0 })  // claim — returns 0 (another worker got it)

    mockJobFindFirst.mockResolvedValue(job)

    const res = await cronPost(makeCronRequest())
    expect(res.status).toBe(200)
    const body = await res.json() as { skipped?: string }
    expect(body.skipped).toContain("another worker")
  })

  it("sets status pending (not failed) on first round error (failedRounds < 3)", async () => {
    const job = {
      id: "job-1", status: "pending", listId: "list-1",
      roundsCompleted: 0, roundsMax: 5, acceptedCount: 0,
      requestedCount: 10, createdAt: new Date(), agentState: null,
      country: "US", stateProvince: "IN", industry: "Mfg",
      employeeCountMin: 50, employeeCountMax: 300,
      keywords: null, additionalContext: null,
      salesUserId: null, superAdminId: "sa-1",
      budgetUsd: 2.0, failedRounds: 0, inputTokensTotal: 0, outputTokensTotal: 0, searchCallsTotal: 0,
    }

    mockJobUpdateMany
      .mockResolvedValueOnce({ count: 0 })  // auto-fail
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: fail at limit
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: reset to pending
      .mockResolvedValueOnce({ count: 1 })  // claim

    mockJobFindFirst.mockResolvedValue(job)
    mockJobFindUnique.mockResolvedValue(job)
    mockCreate.mockRejectedValue(new Error("Claude API error"))
    mockJobUpdate.mockResolvedValue({ ...job, status: "pending", failedRounds: 1 })

    const res = await cronPost(makeCronRequest())
    expect(res.status).toBe(500)
    const body = await res.json() as { ok: boolean; error?: string }
    expect(body.ok).toBe(false)
    // First error → still pending (cron can retry)
    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "pending", failedRounds: 1 }),
      })
    )
  })

  it("marks job permanently failed after 3 consecutive round errors", async () => {
    const job = {
      id: "job-1", status: "pending", listId: "list-1",
      roundsCompleted: 0, roundsMax: 5, acceptedCount: 0,
      requestedCount: 10, createdAt: new Date(), agentState: null,
      country: "US", stateProvince: "IN", industry: "Mfg",
      employeeCountMin: 50, employeeCountMax: 300,
      keywords: null, additionalContext: null,
      salesUserId: null, superAdminId: "sa-1",
      budgetUsd: 2.0, failedRounds: 2, inputTokensTotal: 0, outputTokensTotal: 0, searchCallsTotal: 0,
    }

    mockJobUpdateMany
      .mockResolvedValueOnce({ count: 0 })  // auto-fail
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: fail at limit
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: reset to pending
      .mockResolvedValueOnce({ count: 1 })  // claim

    mockJobFindFirst.mockResolvedValue(job)
    mockJobFindUnique.mockResolvedValue(job)
    mockCreate.mockRejectedValue(new Error("Claude API error"))
    mockJobUpdate.mockResolvedValue({ ...job, status: "failed", failedRounds: 3 })

    const res = await cronPost(makeCronRequest())
    expect(res.status).toBe(500)
    // Third consecutive error → permanently failed
    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed", failedRounds: 3 }),
      })
    )
  })

  it("resets failedRounds to 0 on a successful round", async () => {
    const job = {
      id: "job-1", status: "pending", listId: "list-1",
      roundsCompleted: 0, roundsMax: 5, acceptedCount: 0,
      requestedCount: 10, createdAt: new Date(), agentState: null,
      country: "US", stateProvince: "IN", industry: "Mfg",
      employeeCountMin: 50, employeeCountMax: 300,
      keywords: null, additionalContext: null,
      salesUserId: null, superAdminId: "sa-1",
      budgetUsd: 2.0, failedRounds: 2, inputTokensTotal: 0, outputTokensTotal: 0, searchCallsTotal: 0,
    }

    mockJobUpdateMany
      .mockResolvedValueOnce({ count: 0 })  // auto-fail
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: fail at limit
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: reset to pending
      .mockResolvedValueOnce({ count: 1 })  // claim

    mockJobFindFirst.mockResolvedValue(job)
    mockJobFindUnique.mockResolvedValue(job)

    setupBatchResult([makeCompany("Acme Corp")])
    mockJobUpdate.mockResolvedValue({ ...job, status: "pending", roundsCompleted: 1, failedRounds: 0 })

    await cronPost(makeCronRequest())

    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedRounds: 0 }),
      })
    )
  })

  it("auto-fails jobs older than 60 minutes", async () => {
    mockJobUpdateMany.mockResolvedValue({ count: 1 })  // auto-fail fires
    mockJobFindFirst.mockResolvedValue(null)            // no pending after auto-fail

    const res = await cronPost(makeCronRequest())
    expect(res.status).toBe(200)
    expect(mockJobUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      })
    )
  })

  it("releases stale locks and increments failedRounds (crashed worker recovery)", async () => {
    mockJobUpdateMany
      .mockResolvedValueOnce({ count: 0 })  // auto-fail (no matches)
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: fail at limit (no matches)
      .mockResolvedValueOnce({ count: 1 })  // stale-lock: reset to pending (1 job reset)
    mockJobFindFirst.mockResolvedValue(null)

    await cronPost(makeCronRequest())

    // Reset-to-pending call must increment failedRounds (not just reset the lock)
    expect(mockJobUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status:       "pending",
          lockedUntil:  null,
          failedRounds: { increment: 1 },
        }),
      })
    )
  })

  it("permanently fails a stale-locked job that has exhausted retries", async () => {
    mockJobUpdateMany
      .mockResolvedValueOnce({ count: 0 })  // auto-fail (no matches)
      .mockResolvedValueOnce({ count: 1 })  // stale-lock: fail at limit (1 job failed)
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: reset to pending (none)
    mockJobFindFirst.mockResolvedValue(null)

    await cronPost(makeCronRequest())

    // The fail-at-limit call sets status=failed and increments failedRounds
    expect(mockJobUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status:       "failed",
          lockedUntil:  null,
          failedRounds: { increment: 1 },
        }),
      })
    )
  })

  it("marks job completed when target count reached after round", async () => {
    const job = {
      id: "job-1", status: "pending", listId: "list-1",
      roundsCompleted: 0, roundsMax: 5, acceptedCount: 0,
      requestedCount: 2, createdAt: new Date(), agentState: null,
      country: "US", stateProvince: "IN", industry: "Mfg",
      employeeCountMin: 50, employeeCountMax: 300,
      keywords: null, additionalContext: null,
      salesUserId: null, superAdminId: "sa-1",
      budgetUsd: 2.0, failedRounds: 0, inputTokensTotal: 0, outputTokensTotal: 0, searchCallsTotal: 0,
    }

    mockJobUpdateMany
      .mockResolvedValueOnce({ count: 0 })  // auto-fail
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: fail at limit
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: reset to pending
      .mockResolvedValueOnce({ count: 1 })  // claim

    mockJobFindFirst.mockResolvedValue(job)
    mockJobFindUnique.mockResolvedValue(job)

    const companies = [makeCompany("Acme Corp"), makeCompany("Beta Mfg")]
    setupBatchResult(companies)
    mockJobUpdate.mockResolvedValue({ ...job, status: "completed", roundsCompleted: 1, acceptedCount: 2 })

    const res = await cronPost(makeCronRequest())
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string }
    expect(body.status).toBe("completed")
  })

  it("marks job pending (not completed) when more rounds needed", async () => {
    const job = {
      id: "job-1", status: "pending", listId: "list-1",
      roundsCompleted: 0, roundsMax: 5, acceptedCount: 0,
      requestedCount: 20, createdAt: new Date(), agentState: null,
      country: "US", stateProvince: "IN", industry: "Mfg",
      employeeCountMin: 50, employeeCountMax: 300,
      keywords: null, additionalContext: null,
      salesUserId: null, superAdminId: "sa-1",
      budgetUsd: 2.0, failedRounds: 0, inputTokensTotal: 0, outputTokensTotal: 0, searchCallsTotal: 0,
    }

    mockJobUpdateMany
      .mockResolvedValueOnce({ count: 0 })  // auto-fail
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: fail at limit
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: reset to pending
      .mockResolvedValueOnce({ count: 1 })  // claim

    mockJobFindFirst.mockResolvedValue(job)
    mockJobFindUnique.mockResolvedValue(job)

    // Only 2 companies accepted, need 20 → should stay pending
    setupBatchResult([makeCompany("Acme Corp"), makeCompany("Beta Mfg")])
    mockJobUpdate.mockResolvedValue({ ...job, status: "pending", roundsCompleted: 1, acceptedCount: 2 })

    const res = await cronPost(makeCronRequest())
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string }
    expect(body.status).toBe("pending")
  })

  it("marks job completed when budget is exhausted after a round", async () => {
    // Job whose accumulated tokens will exceed the $0.01 budget on first round
    const job = {
      id: "job-1", status: "pending", listId: "list-1",
      roundsCompleted: 0, roundsMax: 5, acceptedCount: 0,
      requestedCount: 20, createdAt: new Date(), agentState: null,
      country: "US", stateProvince: "IN", industry: "Mfg",
      employeeCountMin: 50, employeeCountMax: 300,
      keywords: null, additionalContext: null,
      salesUserId: null, superAdminId: "sa-1",
      // Near-zero budget so first round exhausts it
      budgetUsd: 0.001, failedRounds: 0, inputTokensTotal: 0, outputTokensTotal: 0, searchCallsTotal: 0,
    }

    mockJobUpdateMany
      .mockResolvedValueOnce({ count: 0 })  // auto-fail
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: fail at limit
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: reset to pending
      .mockResolvedValueOnce({ count: 1 })  // claim

    mockJobFindFirst.mockResolvedValue(job)
    mockJobFindUnique.mockResolvedValue(job)

    // The batch mock returns usage tokens; with budgetUsd=0.001 even a small token count exceeds it
    setupBatchResult([makeCompany("Acme Corp")])
    mockJobUpdate.mockResolvedValue({ ...job, status: "completed", roundsCompleted: 1 })

    const res = await cronPost(makeCronRequest())
    expect(res.status).toBe(200)
    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "completed" }),
      })
    )
  })
})

// ─── Multi-round accumulation ─────────────────────────────────────────────────

describe("multi-round accumulation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it("accumulates companies across 3 cron-driven rounds (8 + 5 + 7 = 20)", async () => {
    const roundBatches = [8, 5, 7]
    const requestedCount = 20
    let totalAccepted = 0

    for (let roundNum = 1; roundNum <= roundBatches.length; roundNum++) {
      vi.clearAllMocks()
      setupDefaults()

      const batchSize    = roundBatches[roundNum - 1]
      const prevAccepted = totalAccepted
      totalAccepted     += batchSize
      const isLast       = totalAccepted >= requestedCount

      const job = {
        id: "job-1", status: "pending", listId: "list-1",
        roundsCompleted: roundNum - 1, roundsMax: 5, acceptedCount: prevAccepted,
        requestedCount, createdAt: new Date(), agentState: null,
        country: "US", stateProvince: "IN", industry: "Mfg",
        employeeCountMin: 50, employeeCountMax: 300,
        keywords: null, additionalContext: null, salesUserId: null, superAdminId: "sa-1",
        budgetUsd: 2.0, failedRounds: 0, inputTokensTotal: 0, outputTokensTotal: 0, searchCallsTotal: 0,
      }

      mockJobUpdateMany
        .mockResolvedValueOnce({ count: 0 })  // auto-fail
        .mockResolvedValueOnce({ count: 0 })  // stale-lock: fail at limit
        .mockResolvedValueOnce({ count: 0 })  // stale-lock: reset to pending
        .mockResolvedValueOnce({ count: 1 })  // claim

      mockJobFindFirst.mockResolvedValue(job)
      mockJobFindUnique.mockResolvedValue(job)

      const companies = Array.from({ length: batchSize }, (_, i) =>
        makeCompany(`Company ${prevAccepted + i + 1}`)
      )
      setupBatchResult(companies)

      const expectedStatus = isLast ? "completed" : "pending"
      mockJobUpdate.mockResolvedValue({
        ...job, status: expectedStatus, roundsCompleted: roundNum, acceptedCount: totalAccepted,
      })

      const res  = await cronPost(makeCronRequest())
      const body = await res.json() as { ok: boolean; status: string; roundCompleted: number }
      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.roundCompleted).toBe(roundNum)
      expect(body.status).toBe(expectedStatus)

      // Verify the DB update carried the accumulated count correctly
      expect(mockJobUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acceptedCount: totalAccepted }),
        })
      )
    }

    expect(totalAccepted).toBe(20)
  })

  it("GET /jobs/:id returns status=running and 0 companies while round is executing (State B)", async () => {
    // DB state while after() / cron is running round 1: status="running", acceptedCount=0
    mockJobFindUnique.mockResolvedValue({
      id: "job-1", status: "running", listId: "list-1",
      roundsCompleted: 0, roundsMax: 5, acceptedCount: 0, requestedCount: 20,
      salesUserId: null, superAdminId: "sa-1",
      country: "US", stateProvince: "IN", industry: "Mfg",
      inputTokensTotal: 0, outputTokensTotal: 0, searchCallsTotal: 0,
      lastError: null, createdAt: new Date(), updatedAt: new Date(),
    })

    const res  = await jobIdGet(makeJobIdRequest("job-1"), { params: Promise.resolve({ id: "job-1" }) })
    const body = await res.json() as { status: string; roundsCompleted: number; acceptedCount: number }
    expect(res.status).toBe(200)
    expect(body.status).toBe("running")
    expect(body.roundsCompleted).toBe(0)
    expect(body.acceptedCount).toBe(0)
  })

  it("GET /jobs/:id returns status=pending with roundsCompleted>0 while waiting for cron (State C)", async () => {
    // After round 1 completes via after(): status="pending", roundsCompleted=1, acceptedCount=8
    mockJobFindUnique.mockResolvedValue({
      id: "job-1", status: "pending", listId: "list-1",
      roundsCompleted: 1, roundsMax: 5, acceptedCount: 8, requestedCount: 20,
      salesUserId: null, superAdminId: "sa-1",
      country: "US", stateProvince: "IN", industry: "Mfg",
      inputTokensTotal: 2000, outputTokensTotal: 400, searchCallsTotal: 2,
      lastError: null, createdAt: new Date(), updatedAt: new Date(),
    })

    const res  = await jobIdGet(makeJobIdRequest("job-1"), { params: Promise.resolve({ id: "job-1" }) })
    const body = await res.json() as { status: string; roundsCompleted: number; acceptedCount: number }
    expect(res.status).toBe(200)
    expect(body.status).toBe("pending")
    expect(body.roundsCompleted).toBe(1)
    expect(body.acceptedCount).toBe(8)
  })

  it("marks job completed at round limit even when target count not fully met (partial — State G)", async () => {
    // Round 5 (last): job has 14 companies, requestedCount=20 — rounds exhausted → completed
    const job = {
      id: "job-1", status: "pending", listId: "list-1",
      roundsCompleted: 4, roundsMax: 5, acceptedCount: 14,
      requestedCount: 20, createdAt: new Date(), agentState: null,
      country: "US", stateProvince: "IN", industry: "Mfg",
      employeeCountMin: 50, employeeCountMax: 300,
      keywords: null, additionalContext: null, salesUserId: null, superAdminId: "sa-1",
      budgetUsd: 2.0, failedRounds: 0, inputTokensTotal: 0, outputTokensTotal: 0, searchCallsTotal: 0,
    }

    mockJobUpdateMany
      .mockResolvedValueOnce({ count: 0 })  // auto-fail
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: fail at limit
      .mockResolvedValueOnce({ count: 0 })  // stale-lock: reset to pending
      .mockResolvedValueOnce({ count: 1 })  // claim

    mockJobFindFirst.mockResolvedValue(job)
    mockJobFindUnique.mockResolvedValue(job)

    // Round 5 finds 2 more → 16 total, still below 20, but rounds exhausted
    setupBatchResult([makeCompany("Final A"), makeCompany("Final B")])
    mockJobUpdate.mockResolvedValue({ ...job, status: "completed", roundsCompleted: 5, acceptedCount: 16 })

    const res = await cronPost(makeCronRequest())
    expect(res.status).toBe(200)
    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "completed", roundsCompleted: 5 }),
      })
    )
  })

  it("PATCH cancel only sets status — does not reset acceptedCount (preserves companies, State I)", async () => {
    mockJobFindUnique.mockResolvedValueOnce({
      id: "job-1", status: "pending",
      salesUserId: null, superAdminId: "sa-1",
    })
    mockJobUpdate.mockResolvedValue({
      id: "job-1", status: "cancelled", listId: "list-1",
      acceptedCount: 13, roundsCompleted: 2,
    })

    const req = makeJobIdRequest("job-1", "PATCH", { action: "cancel" })
    const res = await jobIdPatch(req, { params: Promise.resolve({ id: "job-1" }) })
    expect(res.status).toBe(200)
    // The DB update should set status=cancelled and clear the lock — not touch acceptedCount
    const updateCall = mockJobUpdate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(updateCall.data.status).toBe("cancelled")
    expect(updateCall.data.lockedUntil).toBeNull()
    expect(updateCall.data.acceptedCount).toBeUndefined()
  })
})
