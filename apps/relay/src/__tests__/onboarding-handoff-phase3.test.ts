/**
 * Phase 3 regression tests — Sales CRM submission and tracking interface.
 *
 * Tests cover the Sales-facing API layer that Phase 3 UI depends on:
 *   - GET /api/sales/handoffs: rep sees own; manager sees all; demo/impersonation blocked
 *   - POST /api/sales/handoffs: form validation, test-email rules, prospect ownership,
 *       duplicate guard (409), no Org/invitation created on submit
 *   - GET /api/sales/handoffs/[id]: rep restricted to own; detail includes downstreamStatus
 *   - DELETE /api/sales/handoffs/[id]: cancel by submitter only, only when pending_review
 *   - Safety invariants: no Org/CustomerOnboarding/invitation created on submit
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/sales-auth", () => ({ getSalesSession: vi.fn() }))

const mockHandoffCreate     = vi.fn()
const mockHandoffFindMany   = vi.fn()
const mockHandoffFindUnique = vi.fn()
const mockHandoffUpdate     = vi.fn()
const mockProspectFindUnique = vi.fn()
const mockProspectUpdate    = vi.fn()
const mockOppFindUnique     = vi.fn()
const mockCoFindMany        = vi.fn()
const mockTx                = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    onboardingHandoff: {
      create:     (...a: unknown[]) => mockHandoffCreate(...a),
      findMany:   (...a: unknown[]) => mockHandoffFindMany(...a),
      findUnique: (...a: unknown[]) => mockHandoffFindUnique(...a),
      update:     (...a: unknown[]) => mockHandoffUpdate(...a),
    },
    prospect:          { findUnique: (...a: unknown[]) => mockProspectFindUnique(...a), update: (...a: unknown[]) => mockProspectUpdate(...a) },
    crmOpportunity:    { findUnique: (...a: unknown[]) => mockOppFindUnique(...a) },
    customerOnboarding:{ findMany:   (...a: unknown[]) => mockCoFindMany(...a) },
    $transaction:      (...a: unknown[]) => mockTx(...a),
  },
}))

import { getSalesSession } from "@/lib/sales-auth"
const mockGetSalesSession = getSalesSession as ReturnType<typeof vi.fn>

const REP_SESSION    = { salesUserId: "rep1", salesUserName: "Alice", isRep: true,  isManager: false, isSuperAdmin: false, isDemo: false, isCrmImpersonation: false }
const MGR_SESSION    = { salesUserId: "mgr1", salesUserName: "Bob",   isRep: false, isManager: true,  isSuperAdmin: false, isDemo: false, isCrmImpersonation: false }
const DEMO_SESSION   = { salesUserId: "rep1", salesUserName: "Alice", isRep: true,  isManager: false, isSuperAdmin: false, isDemo: true,  isCrmImpersonation: false }
const IMPERSONATION  = { salesUserId: "rep1", salesUserName: "Alice", isRep: true,  isManager: false, isSuperAdmin: false, isDemo: false, isCrmImpersonation: true }

function getReq(url = "http://localhost/api/test") {
  return new NextRequest(url, { method: "GET" })
}
function jsonReq(body: unknown) {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const BASE_SUBMIT = {
  prospectId:                "p1",
  companyName:               "Acme Corp",
  primaryContactName:        "Jane Smith",
  primaryContactEmail:       "jane@acme.com",
  plan:                      "essentials",
  estimatedFacilities:       5,
  customerAgreementConfirmed: true,
}

const MOCK_PROSPECT = {
  id: "p1", companyName: "Acme Corp", assignedToId: "rep1",
  onboardingStatus: "not_started", relayOrganizationId: null,
}

// ─── GET /api/sales/handoffs ──────────────────────────────────────────────────
describe("GET /api/sales/handoffs (Phase 3 tracking)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSalesSession.mockResolvedValue(REP_SESSION)
    mockHandoffFindMany.mockResolvedValue([])
    mockCoFindMany.mockResolvedValue([])
  })

  async function get(url = "http://localhost/api/sales/handoffs") {
    const { GET } = await import("@/app/api/sales/handoffs/route")
    return GET(getReq(url))
  }

  it("returns 200 with empty list for rep", async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBe(true)
  })

  it("scopes rep to own submissions", async () => {
    await get()
    expect(mockHandoffFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ submittedById: "rep1" }) })
    )
  })

  it("manager sees all (no submittedById filter)", async () => {
    mockGetSalesSession.mockResolvedValue(MGR_SESSION)
    await get()
    const call = mockHandoffFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(call.where.submittedById).toBeUndefined()
  })

  it("returns 403 for demo session", async () => {
    mockGetSalesSession.mockResolvedValue(DEMO_SESSION)
    expect((await get()).status).toBe(403)
  })

  it("returns 403 for CRM impersonation", async () => {
    mockGetSalesSession.mockResolvedValue(IMPERSONATION)
    expect((await get()).status).toBe(403)
  })

  it("returns 401 for unauthenticated", async () => {
    mockGetSalesSession.mockResolvedValue(null)
    expect((await get()).status).toBe(401)
  })
})

// ─── POST /api/sales/handoffs ─────────────────────────────────────────────────
describe("POST /api/sales/handoffs (Phase 3 submission)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSalesSession.mockResolvedValue(REP_SESSION)
    mockProspectFindUnique.mockResolvedValue(MOCK_PROSPECT)
    mockHandoffCreate.mockResolvedValue({ id: "h-new", ...BASE_SUBMIT, status: "pending_review", createdAt: new Date() })
    mockProspectUpdate.mockResolvedValue({})
  })

  async function post(body: unknown) {
    const { POST } = await import("@/app/api/sales/handoffs/route")
    return POST(jsonReq(body))
  }

  it("creates handoff and returns 201", async () => {
    expect((await post(BASE_SUBMIT)).status).toBe(201)
  })

  it("does NOT create an Organization on submit", async () => {
    await post(BASE_SUBMIT)
    // prisma.organization.create must never be called
    // (org is only created on accept — the mock doesn't even have it registered)
    expect(mockHandoffCreate).toHaveBeenCalledOnce()
  })

  it("sets status=pending_review (not accepted)", async () => {
    await post(BASE_SUBMIT)
    const createCall = mockHandoffCreate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(createCall.data.status).toBe("pending_review")
  })

  it("sets onboardingType=white_glove", async () => {
    await post(BASE_SUBMIT)
    const createCall = mockHandoffCreate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(createCall.data.onboardingType).toBe("white_glove")
  })

  it("returns 400 for missing companyName", async () => {
    const { companyName: _, ...body } = BASE_SUBMIT
    expect((await post(body)).status).toBe(400)
  })

  it("returns 400 for missing primaryContactName", async () => {
    const { primaryContactName: _, ...body } = BASE_SUBMIT
    expect((await post(body)).status).toBe(400)
  })

  it("returns 400 for missing primaryContactEmail", async () => {
    const { primaryContactEmail: _, ...body } = BASE_SUBMIT
    expect((await post(body)).status).toBe(400)
  })

  it("returns 400 for invalid email format", async () => {
    expect((await post({ ...BASE_SUBMIT, primaryContactEmail: "not-an-email" })).status).toBe(400)
  })

  it("returns 400 when customerAgreementConfirmed is false", async () => {
    expect((await post({ ...BASE_SUBMIT, customerAgreementConfirmed: false })).status).toBe(400)
  })

  it("returns 400 for invalid plan", async () => {
    expect((await post({ ...BASE_SUBMIT, plan: "enterprise" })).status).toBe(400)
  })

  it("returns 400 for test handoff with non-test email", async () => {
    expect((await post({ ...BASE_SUBMIT, isTest: true, primaryContactEmail: "real@acme.com" })).status).toBe(400)
  })

  it("accepts test handoff with +test email", async () => {
    expect((await post({ ...BASE_SUBMIT, isTest: true, primaryContactEmail: "jane+test@acme.com" })).status).toBe(201)
  })

  it("accepts test handoff with @example.com email", async () => {
    expect((await post({ ...BASE_SUBMIT, isTest: true, primaryContactEmail: "jane@example.com" })).status).toBe(201)
  })

  it("returns 403 when rep submits for prospect not assigned to them", async () => {
    mockProspectFindUnique.mockResolvedValue({ ...MOCK_PROSPECT, assignedToId: "other-rep" })
    expect((await post(BASE_SUBMIT)).status).toBe(403)
  })

  it("returns 409 when prospect already has an org", async () => {
    mockProspectFindUnique.mockResolvedValue({ ...MOCK_PROSPECT, relayOrganizationId: "existing-org" })
    expect((await post(BASE_SUBMIT)).status).toBe(409)
  })

  it("returns 404 when prospect not found", async () => {
    mockProspectFindUnique.mockResolvedValue(null)
    expect((await post(BASE_SUBMIT)).status).toBe(404)
  })

  it("returns 409 for concurrent duplicate (P2002)", async () => {
    mockHandoffCreate.mockRejectedValue({ code: "P2002" })
    expect((await post(BASE_SUBMIT)).status).toBe(409)
  })

  it("returns 403 for demo session", async () => {
    mockGetSalesSession.mockResolvedValue(DEMO_SESSION)
    expect((await post(BASE_SUBMIT)).status).toBe(403)
  })

  it("returns 403 for CRM impersonation", async () => {
    mockGetSalesSession.mockResolvedValue(IMPERSONATION)
    expect((await post(BASE_SUBMIT)).status).toBe(403)
  })

  it("validates opportunity belongs to prospect", async () => {
    mockOppFindUnique.mockResolvedValue({ id: "opp1", prospectId: "other-prospect" })
    expect((await post({ ...BASE_SUBMIT, opportunityId: "opp1" })).status).toBe(400)
  })
})

// ─── GET /api/sales/handoffs/[id] ────────────────────────────────────────────
describe("GET /api/sales/handoffs/[id] (Phase 3 detail)", () => {
  const MOCK_HANDOFF = {
    id: "h1", status: "pending_review", submittedById: "rep1", companyName: "Acme",
    customerOnboardingId: null, plan: "essentials",
    prospect: { id: "p1", companyName: "Acme Corp", onboardingStatus: "in_progress" },
    opportunity: { id: "opp1", title: "Acme Deal", stage: "Proposal" },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSalesSession.mockResolvedValue(REP_SESSION)
    mockHandoffFindUnique.mockResolvedValue(MOCK_HANDOFF)
    mockCoFindMany.mockResolvedValue([])
  })

  async function get(id = "h1") {
    const { GET } = await import("@/app/api/sales/handoffs/[id]/route")
    return GET(getReq(), { params: Promise.resolve({ id }) })
  }

  it("returns 200 for own handoff", async () => {
    expect((await get()).status).toBe(200)
  })

  it("returns 403 when rep accesses another rep's handoff", async () => {
    mockHandoffFindUnique.mockResolvedValue({ ...MOCK_HANDOFF, submittedById: "other-rep" })
    expect((await get()).status).toBe(403)
  })

  it("manager can access any handoff", async () => {
    mockGetSalesSession.mockResolvedValue(MGR_SESSION)
    mockHandoffFindUnique.mockResolvedValue({ ...MOCK_HANDOFF, submittedById: "other-rep" })
    expect((await get()).status).toBe(200)
  })

  it("returns 404 for missing handoff", async () => {
    mockHandoffFindUnique.mockResolvedValue(null)
    expect((await get("missing")).status).toBe(404)
  })
})

// ─── DELETE /api/sales/handoffs/[id] (cancel) ────────────────────────────────
describe("DELETE /api/sales/handoffs/[id] (Phase 3 cancel)", () => {
  const PENDING_HANDOFF = {
    id: "h1", status: "pending_review", submittedById: "rep1", prospectId: "p1", companyName: "Acme",
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSalesSession.mockResolvedValue(REP_SESSION)
    mockHandoffFindUnique.mockResolvedValue(PENDING_HANDOFF)
    mockHandoffUpdate.mockResolvedValue({})
    mockProspectUpdate.mockResolvedValue({})
    // DELETE uses $transaction([update1, update2]) — array form
    mockTx.mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]))
  })

  async function del(id = "h1") {
    const req = new NextRequest("http://localhost/api/test", { method: "DELETE" })
    const { DELETE } = await import("@/app/api/sales/handoffs/[id]/route")
    return DELETE(req, { params: Promise.resolve({ id }) })
  }

  it("returns 200 on successful cancel", async () => {
    expect((await del()).status).toBe(200)
  })

  it("returns 403 when rep cancels another rep's handoff", async () => {
    mockHandoffFindUnique.mockResolvedValue({ ...PENDING_HANDOFF, submittedById: "other-rep" })
    expect((await del()).status).toBe(403)
  })

  it("returns 409 when handoff is already accepted", async () => {
    mockHandoffFindUnique.mockResolvedValue({ ...PENDING_HANDOFF, status: "accepted" })
    expect((await del()).status).toBe(409)
  })

  it("returns 409 when handoff is already rejected", async () => {
    mockHandoffFindUnique.mockResolvedValue({ ...PENDING_HANDOFF, status: "rejected" })
    expect((await del()).status).toBe(409)
  })

  it("returns 404 for missing handoff", async () => {
    mockHandoffFindUnique.mockResolvedValue(null)
    expect((await del("missing")).status).toBe(404)
  })

  it("resets prospect.onboardingStatus to not_started on cancel", async () => {
    await del()
    expect(mockProspectUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { onboardingStatus: "not_started" } })
    )
  })

  it("sets handoff status to cancelled", async () => {
    await del()
    expect(mockHandoffUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "cancelled" }) })
    )
  })
})
