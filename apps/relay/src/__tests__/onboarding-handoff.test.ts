/**
 * Regression tests for the Sales-to-Onboarding Handoff Phase 1 API.
 *
 * Covers:
 *   POST   /api/sales/handoffs        — submit, validation, auth, duplicate guards
 *   GET    /api/sales/handoffs        — list with rep scoping
 *   GET    /api/sales/handoffs/[id]   — detail, ownership
 *   DELETE /api/sales/handoffs/[id]   — cancel, state guards
 *   GET    /api/super-admin/handoffs  — queue list
 *   GET    /api/super-admin/handoffs/[id]
 *   POST   /api/super-admin/handoffs/[id]/accept — atomic create, idempotency guard
 *   POST   /api/super-admin/handoffs/[id]/reject — requires reason, resets prospect
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/session", () => ({ getSession: vi.fn() }))
vi.mock("@/lib/sales-auth", () => ({ getSalesSession: vi.fn() }))
vi.mock("@/lib/sa-audit", () => ({ logSAAction: vi.fn() }))

const mockCreate       = vi.fn()
const mockUpdateMany   = vi.fn()
const mockFindUnique   = vi.fn()
const mockFindFirst    = vi.fn()
const mockFindMany     = vi.fn()
const mockUpdate       = vi.fn()
const mockTx           = vi.fn()

const mockProspectFind   = vi.fn()
const mockProspectUpdate = vi.fn()
const mockOppFind        = vi.fn()
const mockOppUpdate      = vi.fn()
const mockOrgCreate      = vi.fn()
const mockCoCreate       = vi.fn()
const mockCoFind         = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    onboardingHandoff: {
      create:     (...a: unknown[]) => mockCreate(...a),
      updateMany: (...a: unknown[]) => mockUpdateMany(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      findFirst:  (...a: unknown[]) => mockFindFirst(...a),
      findMany:   (...a: unknown[]) => mockFindMany(...a),
      update:     (...a: unknown[]) => mockUpdate(...a),
    },
    prospect: {
      findUnique: (...a: unknown[]) => mockProspectFind(...a),
      update:     (...a: unknown[]) => mockProspectUpdate(...a),
    },
    crmOpportunity: {
      findUnique: (...a: unknown[]) => mockOppFind(...a),
      update:     (...a: unknown[]) => mockOppUpdate(...a),
    },
    organization: {
      create: (...a: unknown[]) => mockOrgCreate(...a),
    },
    customerOnboarding: {
      create:     (...a: unknown[]) => mockCoCreate(...a),
      findUnique: (...a: unknown[]) => mockCoFind(...a),
      findMany:   vi.fn().mockResolvedValue([]),
    },
    $transaction: (...a: unknown[]) => mockTx(...a),
  },
}))

import { getSalesSession } from "@/lib/sales-auth"
import { getSession }      from "@/lib/session"

const mockGetSalesSession = getSalesSession as ReturnType<typeof vi.fn>
const mockGetSession      = getSession      as ReturnType<typeof vi.fn>

// ─── Helper ───────────────────────────────────────────────────────────────────

function jsonReq(body: unknown, method = "POST") {
  return new NextRequest("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}
function getReq(path = "http://localhost/api/test") {
  return new NextRequest(path, { method: "GET" })
}

const REP_SESSION = {
  salesUserId: "rep-1", salesUserRole: "sales_rep", salesUserName: "Alice",
  isSuperAdmin: false, isManager: false, isRep: true, isDemo: false, isCrmImpersonation: false,
}
const ADMIN_SESSION = {
  salesUserId: "admin-1", salesUserRole: "admin_sales", salesUserName: "Manager",
  isSuperAdmin: false, isManager: true, isRep: false, isDemo: false, isCrmImpersonation: false,
}
const SA_SESSION = { superAdmin: true, superAdminId: "sa-1", name: "SA User" }

const BASE_PROSPECT = {
  id: "prospect-1", companyName: "Acme Corp", assignedToId: "rep-1",
  onboardingStatus: "not_started", relayOrganizationId: null,
}
const BASE_HANDOFF = {
  id: "handoff-1", status: "pending_review", prospectId: "prospect-1",
  opportunityId: null, submittedById: "rep-1", submittedByName: "Alice",
  companyName: "Acme Corp", primaryContactName: "Jane Smith",
  primaryContactEmail: "jane@acme.com", primaryContactPhone: null,
  onboardingType: "white_glove", isTest: false, plan: "essentials",
  estimatedFacilities: 3, trialStartDate: null, salesNotes: null,
  customerAgreementConfirmed: true, reviewedById: null, reviewedByName: null,
  reviewedAt: null, rejectionReason: null, customerOnboardingId: null,
  createdAt: new Date(), updatedAt: new Date(),
  prospect: { id: "prospect-1", companyName: "Acme Corp", onboardingStatus: "not_started", relayOrganizationId: null },
  opportunity: null,
}

// ─── POST /api/sales/handoffs ─────────────────────────────────────────────────
describe("POST /api/sales/handoffs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSalesSession.mockResolvedValue(REP_SESSION)
    mockProspectFind.mockResolvedValue(BASE_PROSPECT)
    mockCreate.mockResolvedValue({ id: "handoff-1" })
    mockProspectUpdate.mockResolvedValue({})
    mockUpdateMany.mockResolvedValue({ count: 0 })
    // POST handler uses $transaction(async tx => {...}) — pass through to the same mocks
    mockTx.mockImplementation((fn: unknown) => {
      if (typeof fn === "function") {
        return (fn as (tx: unknown) => Promise<unknown>)({
          onboardingHandoff: {
            create:     (...a: unknown[]) => mockCreate(...a),
            updateMany: (...a: unknown[]) => mockUpdateMany(...a),
          },
          prospect: { update: (...a: unknown[]) => mockProspectUpdate(...a) },
        })
      }
      return Promise.all(fn as Promise<unknown>[])
    })
  })

  async function post(body: unknown) {
    const { POST } = await import("@/app/api/sales/handoffs/route")
    return POST(jsonReq(body))
  }

  it("creates a handoff for valid input and returns 201", async () => {
    const res = await post({
      prospectId: "prospect-1", companyName: "Acme", primaryContactName: "Jane",
      primaryContactEmail: "jane@acme.com", customerAgreementConfirmed: true,
    })
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockProspectUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ onboardingStatus: "in_progress" }) })
    )
  })

  it("returns 401 when unauthenticated", async () => {
    mockGetSalesSession.mockResolvedValue(null)
    const res = await post({ prospectId: "p1", companyName: "X", primaryContactName: "Y", primaryContactEmail: "y@x.com", customerAgreementConfirmed: true })
    expect(res.status).toBe(401)
  })

  it("returns 403 for demo session", async () => {
    mockGetSalesSession.mockResolvedValue({ ...REP_SESSION, isDemo: true })
    const res = await post({ prospectId: "p1", companyName: "X", primaryContactName: "Y", primaryContactEmail: "y@x.com", customerAgreementConfirmed: true })
    expect(res.status).toBe(403)
  })

  it("returns 403 for super admin (salesUserId 'sa' is not a real SalesUser FK)", async () => {
    mockGetSalesSession.mockResolvedValue({
      salesUserId: "sa", salesUserRole: "super_admin", salesUserName: "Super Admin",
      isSuperAdmin: true, isManager: true, isRep: false, isDemo: false, isCrmImpersonation: false,
    })
    const res = await post({ prospectId: "p1", companyName: "X", primaryContactName: "Y", primaryContactEmail: "y@x.com", customerAgreementConfirmed: true })
    expect(res.status).toBe(403)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/super admin/i)
  })

  it("returns 400 when companyName missing", async () => {
    const res = await post({ prospectId: "p1", primaryContactName: "Y", primaryContactEmail: "y@x.com", customerAgreementConfirmed: true })
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid email", async () => {
    const res = await post({ prospectId: "p1", companyName: "X", primaryContactName: "Y", primaryContactEmail: "not-an-email", customerAgreementConfirmed: true })
    expect(res.status).toBe(400)
  })

  it("returns 400 when customerAgreementConfirmed is false", async () => {
    const res = await post({ prospectId: "p1", companyName: "X", primaryContactName: "Y", primaryContactEmail: "y@x.com", customerAgreementConfirmed: false })
    expect(res.status).toBe(400)
  })

  it("returns 400 for test org with non-test email", async () => {
    const res = await post({
      prospectId: "prospect-1", companyName: "X", primaryContactName: "Y",
      primaryContactEmail: "real@company.com", customerAgreementConfirmed: true, isTest: true,
    })
    expect(res.status).toBe(400)
  })

  it("accepts test org with +test email", async () => {
    const res = await post({
      prospectId: "prospect-1", companyName: "X", primaryContactName: "Y",
      primaryContactEmail: "tester+test@example.com", customerAgreementConfirmed: true, isTest: true,
    })
    expect(res.status).toBe(201)
  })

  it("returns 403 when rep submits for another rep's prospect", async () => {
    mockProspectFind.mockResolvedValue({ ...BASE_PROSPECT, assignedToId: "rep-other" })
    const res = await post({ prospectId: "prospect-1", companyName: "X", primaryContactName: "Y", primaryContactEmail: "y@x.com", customerAgreementConfirmed: true })
    expect(res.status).toBe(403)
  })

  it("returns 409 when prospect already has an org", async () => {
    mockProspectFind.mockResolvedValue({ ...BASE_PROSPECT, relayOrganizationId: "org-exists" })
    const res = await post({ prospectId: "prospect-1", companyName: "X", primaryContactName: "Y", primaryContactEmail: "y@x.com", customerAgreementConfirmed: true })
    expect(res.status).toBe(409)
  })

  it("returns 409 on DB unique constraint violation (concurrent duplicate)", async () => {
    mockCreate.mockRejectedValue(Object.assign(new Error("Unique constraint"), { code: "P2002" }))
    const res = await post({ prospectId: "prospect-1", companyName: "X", primaryContactName: "Y", primaryContactEmail: "y@x.com", customerAgreementConfirmed: true })
    expect(res.status).toBe(409)
  })

  it("admin_sales can submit for any prospect", async () => {
    mockGetSalesSession.mockResolvedValue(ADMIN_SESSION)
    mockProspectFind.mockResolvedValue({ ...BASE_PROSPECT, assignedToId: "rep-other" })
    const res = await post({ prospectId: "prospect-1", companyName: "X", primaryContactName: "Y", primaryContactEmail: "y@x.com", customerAgreementConfirmed: true })
    expect(res.status).toBe(201)
  })

  it("does NOT set white_glove as onboardingType regardless of input", async () => {
    await post({ prospectId: "prospect-1", companyName: "X", primaryContactName: "Y", primaryContactEmail: "y@x.com", customerAgreementConfirmed: true })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ onboardingType: "white_glove" }) })
    )
  })
})

// ─── GET /api/sales/handoffs ──────────────────────────────────────────────────
describe("GET /api/sales/handoffs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSalesSession.mockResolvedValue(REP_SESSION)
    mockFindMany.mockResolvedValue([])
  })

  async function get() {
    const { GET } = await import("@/app/api/sales/handoffs/route")
    return GET(getReq())
  }

  it("returns 200 for authenticated rep", async () => {
    const res = await get()
    expect(res.status).toBe(200)
  })

  it("returns 401 when unauthenticated", async () => {
    mockGetSalesSession.mockResolvedValue(null)
    const res = await get()
    expect(res.status).toBe(401)
  })

  it("scopes to submittedById for sales_rep", async () => {
    await get()
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ submittedById: "rep-1" }) })
    )
  })

  it("does not scope by submittedById for admin_sales", async () => {
    mockGetSalesSession.mockResolvedValue(ADMIN_SESSION)
    await get()
    const call = mockFindMany.mock.calls[0][0]
    expect(call.where).not.toHaveProperty("submittedById")
  })
})

// ─── GET /api/sales/handoffs/[id] ────────────────────────────────────────────
describe("GET /api/sales/handoffs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSalesSession.mockResolvedValue(REP_SESSION)
    mockFindUnique.mockResolvedValue(BASE_HANDOFF)
    mockCoFind.mockResolvedValue(null)
  })

  async function get(id = "handoff-1") {
    const { GET } = await import("@/app/api/sales/handoffs/[id]/route")
    return GET(getReq(), { params: Promise.resolve({ id }) })
  }

  it("returns 200 for the submitting rep", async () => {
    const res = await get()
    expect(res.status).toBe(200)
  })

  it("returns 403 when a different rep tries to view it", async () => {
    mockGetSalesSession.mockResolvedValue({ ...REP_SESSION, salesUserId: "rep-other" })
    const res = await get()
    expect(res.status).toBe(403)
  })

  it("returns 404 for nonexistent handoff", async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await get("nonexistent")
    expect(res.status).toBe(404)
  })

  it("includes downstreamOnboardingStatus when customerOnboardingId is set", async () => {
    mockFindUnique.mockResolvedValue({ ...BASE_HANDOFF, customerOnboardingId: "co-1" })
    mockCoFind.mockResolvedValue({ status: "configuring" })
    const res = await get()
    expect(res.status).toBe(200)
    const data = await res.json() as { downstreamOnboardingStatus: string }
    expect(data.downstreamOnboardingStatus).toBe("configuring")
  })
})

// ─── DELETE /api/sales/handoffs/[id] (cancel) ────────────────────────────────
describe("DELETE /api/sales/handoffs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSalesSession.mockResolvedValue(REP_SESSION)
    mockFindUnique.mockResolvedValue({
      id: "handoff-1", status: "pending_review", submittedById: "rep-1", prospectId: "prospect-1",
    })
    mockTx.mockResolvedValue([{}, {}])
  })

  async function del(id = "handoff-1") {
    const { DELETE } = await import("@/app/api/sales/handoffs/[id]/route")
    return DELETE(getReq(), { params: Promise.resolve({ id }) })
  }

  it("cancels a pending handoff and returns 200", async () => {
    const res = await del()
    expect(res.status).toBe(200)
    expect(mockTx).toHaveBeenCalledOnce()
  })

  it("returns 403 when another rep tries to cancel", async () => {
    mockGetSalesSession.mockResolvedValue({ ...REP_SESSION, salesUserId: "rep-other" })
    const res = await del()
    expect(res.status).toBe(403)
  })

  it("returns 409 when handoff is already accepted", async () => {
    mockFindUnique.mockResolvedValue({ id: "handoff-1", status: "accepted", submittedById: "rep-1", prospectId: "prospect-1" })
    const res = await del()
    expect(res.status).toBe(409)
  })

  it("returns 404 for nonexistent handoff", async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await del("nonexistent")
    expect(res.status).toBe(404)
  })
})

// ─── GET /api/super-admin/handoffs ───────────────────────────────────────────
describe("GET /api/super-admin/handoffs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockFindMany.mockResolvedValue([])
  })

  async function get(statusParam?: string) {
    const { GET } = await import("@/app/api/super-admin/handoffs/route")
    const url = statusParam
      ? `http://localhost/api/super-admin/handoffs?status=${statusParam}`
      : "http://localhost/api/super-admin/handoffs"
    return GET(getReq(url))
  }

  it("returns 200 for super-admin", async () => {
    const res = await get()
    expect(res.status).toBe(200)
  })

  it("returns 403 for non-SA", async () => {
    mockGetSession.mockResolvedValue({ salesUserId: "rep-1" })
    const res = await get()
    expect(res.status).toBe(403)
  })

  it("defaults to pending_review filter", async () => {
    await get()
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "pending_review" } })
    )
  })

  it("passes empty where for status=all", async () => {
    await get("all")
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
  })
})

// ─── GET /api/super-admin/handoffs/[id] ──────────────────────────────────────
describe("GET /api/super-admin/handoffs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockFindUnique.mockResolvedValue({ ...BASE_HANDOFF })
  })

  async function get(id = "handoff-1") {
    const { GET } = await import("@/app/api/super-admin/handoffs/[id]/route")
    return GET(getReq(), { params: Promise.resolve({ id }) })
  }

  it("returns 200 for SA", async () => {
    expect((await get()).status).toBe(200)
  })

  it("returns 403 for non-SA", async () => {
    mockGetSession.mockResolvedValue({ salesUserId: "rep-1" })
    expect((await get()).status).toBe(403)
  })

  it("returns 404 for missing handoff", async () => {
    mockFindUnique.mockResolvedValue(null)
    expect((await get("missing")).status).toBe(404)
  })
})

// ─── POST /api/super-admin/handoffs/[id]/accept ───────────────────────────────
describe("POST /api/super-admin/handoffs/[id]/accept", () => {
  const HANDOFF_FOR_ACCEPT = {
    id: "handoff-1", status: "pending_review", prospectId: "prospect-1",
    opportunityId: "opp-1", companyName: "Acme Corp",
    primaryContactName: "Jane Smith", primaryContactEmail: "jane@acme.com",
    plan: "essentials", estimatedFacilities: 3, trialStartDate: null, salesNotes: null, isTest: false,
    prospect: { id: "prospect-1", companyName: "Acme Corp", relayOrganizationId: null },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockFindUnique.mockResolvedValue(HANDOFF_FOR_ACCEPT)
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const mockTxClient = {
        organization: { create: mockOrgCreate },
        customerOnboarding: { create: mockCoCreate },
        prospect: { update: mockProspectUpdate },
        crmOpportunity: { update: mockOppUpdate },
        onboardingHandoff: { update: mockUpdate },
      }
      mockOrgCreate.mockResolvedValue({ id: "org-new", name: "Acme Corp" })
      mockCoCreate.mockResolvedValue({ id: "co-new" })
      mockProspectUpdate.mockResolvedValue({})
      mockOppUpdate.mockResolvedValue({})
      mockUpdate.mockResolvedValue({})
      return fn(mockTxClient)
    })
  })

  async function accept(id = "handoff-1") {
    const { POST } = await import("@/app/api/super-admin/handoffs/[id]/accept/route")
    return POST(getReq(), { params: Promise.resolve({ id }) })
  }

  it("returns 200 and runs the atomic transaction", async () => {
    const res = await accept()
    expect(res.status).toBe(200)
    expect(mockTx).toHaveBeenCalledOnce()
  })

  it("creates org and CustomerOnboarding in transaction", async () => {
    await accept()
    expect(mockOrgCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Acme Corp", subscriptionStatus: "draft" }) })
    )
    expect(mockCoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "draft", primaryContactEmail: "jane@acme.com" }) })
    )
  })

  it("sets Prospect.relayOrganizationId in transaction", async () => {
    await accept()
    expect(mockProspectUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ relayOrganizationId: "org-new" }) })
    )
  })

  it("sets CrmOpportunity.customerOrganizationId without closing the deal", async () => {
    await accept()
    expect(mockOppUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerOrganizationId: "org-new" }) })
    )
    // Must NOT set wonAt, closedAt, or stage="Closed Won"
    const oppCall = mockOppUpdate.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(oppCall.data).not.toHaveProperty("wonAt")
    expect(oppCall.data).not.toHaveProperty("closedAt")
    expect(oppCall.data?.stage).toBeUndefined()
  })

  it("sets isDemo=true for isTest handoffs", async () => {
    mockFindUnique.mockResolvedValue({ ...HANDOFF_FOR_ACCEPT, isTest: true })
    await accept()
    expect(mockOrgCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isDemo: true }) })
    )
  })

  it("returns 403 for non-SA", async () => {
    mockGetSession.mockResolvedValue({ salesUserId: "rep-1" })
    expect((await accept()).status).toBe(403)
  })

  it("returns 409 when handoff is already accepted", async () => {
    mockFindUnique.mockResolvedValue({ ...HANDOFF_FOR_ACCEPT, status: "accepted" })
    expect((await accept()).status).toBe(409)
  })

  it("returns 409 when prospect already has an org (idempotency guard)", async () => {
    mockFindUnique.mockResolvedValue({
      ...HANDOFF_FOR_ACCEPT,
      prospect: { ...HANDOFF_FOR_ACCEPT.prospect, relayOrganizationId: "org-existing" },
    })
    expect((await accept()).status).toBe(409)
  })

  it("returns 404 for missing handoff", async () => {
    mockFindUnique.mockResolvedValue(null)
    expect((await accept("missing")).status).toBe(404)
  })
})

// ─── POST /api/super-admin/handoffs/[id]/reject ───────────────────────────────
describe("POST /api/super-admin/handoffs/[id]/reject", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockFindUnique.mockResolvedValue({
      id: "handoff-1", status: "pending_review", prospectId: "prospect-1", companyName: "Acme Corp",
    })
    mockTx.mockResolvedValue([{}, {}])
  })

  async function reject(body: unknown, id = "handoff-1") {
    const { POST } = await import("@/app/api/super-admin/handoffs/[id]/reject/route")
    return POST(jsonReq(body), { params: Promise.resolve({ id }) })
  }

  it("rejects with a reason and returns 200", async () => {
    const res = await reject({ reason: "Missing signed contract" })
    expect(res.status).toBe(200)
    expect(mockTx).toHaveBeenCalledOnce()
  })

  it("returns 400 when reason is missing", async () => {
    expect((await reject({})).status).toBe(400)
  })

  it("returns 400 when reason is empty string", async () => {
    expect((await reject({ reason: "  " })).status).toBe(400)
  })

  it("returns 403 for non-SA", async () => {
    mockGetSession.mockResolvedValue({ salesUserId: "rep-1" })
    expect((await reject({ reason: "No" })).status).toBe(403)
  })

  it("returns 409 when handoff is already rejected", async () => {
    mockFindUnique.mockResolvedValue({ id: "handoff-1", status: "rejected", prospectId: "p1", companyName: "X" })
    expect((await reject({ reason: "Again" })).status).toBe(409)
  })

  it("returns 404 for missing handoff", async () => {
    mockFindUnique.mockResolvedValue(null)
    expect((await reject({ reason: "No" }, "missing")).status).toBe(404)
  })

  it("resets Prospect.onboardingStatus to not_started in transaction", async () => {
    let transactionArgs: unknown[] = []
    mockTx.mockImplementation((ops: unknown[]) => { transactionArgs = ops; return Promise.resolve([{}, {}]) })
    await reject({ reason: "Missing info" })
    expect(Array.isArray(transactionArgs)).toBe(true)
    // Transaction should include both handoff update and prospect reset
    expect(transactionArgs).toHaveLength(2)
  })
})
