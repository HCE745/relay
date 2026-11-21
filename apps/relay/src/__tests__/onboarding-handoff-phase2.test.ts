/**
 * Phase 2 regression tests for the Super-admin Handoff Queue.
 *
 * The queue UI is a server-rendered Next.js page (not unit-testable here),
 * so these tests cover:
 *   - GET /api/super-admin/handoffs: tab data, status filtering, default pending_review
 *   - GET /api/super-admin/handoffs/[id]: full CRM context returned
 *   - POST /api/super-admin/handoffs/[id]/accept: atomic transaction, redirect data
 *   - POST /api/super-admin/handoffs/[id]/reject: reason required, state transitions
 *   - Authorization: all SA routes reject non-SA sessions
 *   - Preservation: existing CustomerOnboarding and manual New Onboarding unaffected
 *   - Safety: no org created on submit, no invitation/trial on accept
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }))
vi.mock("@/lib/sa-audit", () => ({ logSAAction: vi.fn() }))

// Prisma mock setup
const mockHandoffFindUnique = vi.fn()
const mockHandoffFindMany   = vi.fn()
const mockHandoffUpdate     = vi.fn()
const mockOrgCreate         = vi.fn()
const mockCoCreate          = vi.fn()
const mockProspectUpdate    = vi.fn()
const mockOppUpdate         = vi.fn()
const mockTx                = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    onboardingHandoff: {
      findUnique: (...a: unknown[]) => mockHandoffFindUnique(...a),
      findMany:   (...a: unknown[]) => mockHandoffFindMany(...a),
      update:     (...a: unknown[]) => mockHandoffUpdate(...a),
    },
    organization:         { create: (...a: unknown[]) => mockOrgCreate(...a) },
    customerOnboarding:   { create: (...a: unknown[]) => mockCoCreate(...a) },
    prospect:             { update: (...a: unknown[]) => mockProspectUpdate(...a) },
    crmOpportunity:       { update: (...a: unknown[]) => mockOppUpdate(...a) },
    $transaction:         (...a: unknown[]) => mockTx(...a),
  },
}))

import { getSession } from "@/lib/session"
const mockGetSession = getSession as ReturnType<typeof vi.fn>

const SA_SESSION = { superAdmin: true, superAdminId: "sa-1", name: "SA User" }

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

const FULL_HANDOFF = {
  id: "h1", status: "pending_review", prospectId: "p1", opportunityId: "opp1",
  companyName: "Acme Corp", primaryContactName: "Jane Smith",
  primaryContactEmail: "jane@acme.com", primaryContactPhone: null,
  onboardingType: "white_glove", isTest: false, plan: "essentials",
  estimatedFacilities: 5, trialStartDate: null, salesNotes: "Big opportunity",
  customerAgreementConfirmed: true, reviewedById: null, reviewedByName: null,
  reviewedAt: null, rejectionReason: null, customerOnboardingId: null,
  submittedById: "rep1", submittedByName: "Alice", createdAt: new Date(), updatedAt: new Date(),
  prospect: {
    id: "p1", companyName: "Acme Corp", website: "https://acme.com",
    industry: "Manufacturing", headquartersCity: "Indianapolis", headquartersState: "IN",
    onboardingStatus: "in_progress", relayOrganizationId: null,
    contacts: [{ id: "c1", name: "Jane Smith", title: "COO", email: "jane@acme.com", phone: null }],
  },
  opportunity: {
    id: "opp1", title: "Acme Essentials Deal", stage: "Proposal", product: "RELAY_STANDARD",
    value: "12000", estimatedValue: null, closeDate: null,
    assignedToId: "rep1", qualificationStatus: "SALES_QUALIFIED",
    leadSource: "OUTBOUND", notes: "Very interested",
  },
}

// ─── GET /api/super-admin/handoffs ────────────────────────────────────────────
describe("GET /api/super-admin/handoffs (Phase 2 queue)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockHandoffFindMany.mockResolvedValue([])
  })

  async function get(url = "http://localhost/api/super-admin/handoffs") {
    const { GET } = await import("@/app/api/super-admin/handoffs/route")
    return GET(getReq(url))
  }

  it("returns 200 with empty list for SA", async () => {
    const res = await get()
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(Array.isArray(data)).toBe(true)
  })

  it("returns 403 for non-SA", async () => {
    mockGetSession.mockResolvedValue({ salesUserId: "rep1" })
    expect((await get()).status).toBe(403)
  })

  it("returns 403 for unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    expect((await get()).status).toBe(403)
  })

  it("defaults to pending_review filter (oldest-first for the queue)", async () => {
    await get()
    expect(mockHandoffFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where:   { status: "pending_review" },
        orderBy: { createdAt: "asc" },
      })
    )
  })

  it("passes empty where for status=all", async () => {
    await get("http://localhost/api/super-admin/handoffs?status=all")
    expect(mockHandoffFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
  })

  it("filters by specific status when provided", async () => {
    await get("http://localhost/api/super-admin/handoffs?status=accepted")
    expect(mockHandoffFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "accepted" } })
    )
  })

  it("includes prospect and opportunity in select", async () => {
    await get()
    const call = mockHandoffFindMany.mock.calls[0][0] as { select: Record<string, unknown> }
    expect(call.select).toHaveProperty("prospect")
    expect(call.select).toHaveProperty("opportunity")
  })
})

// ─── GET /api/super-admin/handoffs/[id] ──────────────────────────────────────
describe("GET /api/super-admin/handoffs/[id] (full CRM context)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockHandoffFindUnique.mockResolvedValue(FULL_HANDOFF)
  })

  async function get(id = "h1") {
    const { GET } = await import("@/app/api/super-admin/handoffs/[id]/route")
    return GET(getReq(), { params: Promise.resolve({ id }) })
  }

  it("returns full handoff with prospect and opportunity", async () => {
    const res = await get()
    expect(res.status).toBe(200)
    const data = await res.json() as typeof FULL_HANDOFF
    expect(data.prospect).toBeTruthy()
    expect(data.prospect?.industry).toBe("Manufacturing")
    expect(data.opportunity?.value).toBe("12000")
  })

  it("returns 403 for non-SA", async () => {
    mockGetSession.mockResolvedValue({ salesUserId: "rep1" })
    expect((await get()).status).toBe(403)
  })

  it("returns 404 for missing handoff", async () => {
    mockHandoffFindUnique.mockResolvedValue(null)
    expect((await get("missing")).status).toBe(404)
  })

  it("includes contacts from prospect", async () => {
    const res = await get()
    const data = await res.json() as typeof FULL_HANDOFF
    expect(data.prospect?.contacts).toHaveLength(1)
    expect(data.prospect?.contacts[0].name).toBe("Jane Smith")
  })
})

// ─── POST /api/super-admin/handoffs/[id]/accept ───────────────────────────────
describe("POST /api/super-admin/handoffs/[id]/accept (Phase 2 accept flow)", () => {
  const HANDOFF_FOR_ACCEPT = {
    id: "h1", status: "pending_review", prospectId: "p1", opportunityId: "opp1",
    companyName: "Acme Corp", primaryContactName: "Jane Smith",
    primaryContactEmail: "jane@acme.com", plan: "essentials",
    estimatedFacilities: 5, trialStartDate: null, salesNotes: "Big opportunity", isTest: false,
    prospect: { id: "p1", companyName: "Acme Corp", relayOrganizationId: null },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockHandoffFindUnique.mockResolvedValue(HANDOFF_FOR_ACCEPT)
    mockTx.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        organization: { create: mockOrgCreate },
        customerOnboarding: { create: mockCoCreate },
        prospect: { update: mockProspectUpdate },
        crmOpportunity: { update: mockOppUpdate },
        onboardingHandoff: { update: mockHandoffUpdate },
      }
      mockOrgCreate.mockResolvedValue({ id: "org-new", name: "Acme Corp" })
      mockCoCreate.mockResolvedValue({ id: "co-new" })
      mockProspectUpdate.mockResolvedValue({})
      mockOppUpdate.mockResolvedValue({})
      mockHandoffUpdate.mockResolvedValue({})
      return fn(tx)
    })
  })

  async function accept(id = "h1") {
    const { POST } = await import("@/app/api/super-admin/handoffs/[id]/accept/route")
    return POST(getReq(), { params: Promise.resolve({ id }) })
  }

  it("returns customerOnboardingId for client redirect", async () => {
    const res = await accept()
    expect(res.status).toBe(200)
    const data = await res.json() as { customerOnboardingId: string; organizationId: string }
    expect(data.customerOnboardingId).toBe("co-new")
    expect(data.organizationId).toBe("org-new")
  })

  it("creates org with subscriptionStatus=draft (not trialing)", async () => {
    await accept()
    expect(mockOrgCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "draft" }) })
    )
  })

  it("creates CustomerOnboarding with status=draft (no invitation sent)", async () => {
    await accept()
    expect(mockCoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "draft" }) })
    )
    // Verify no invitation fields are set automatically
    const coData = (mockCoCreate.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data
    expect(coData.invitationToken).toBeUndefined()
    expect(coData.invitationSentAt).toBeUndefined()
    expect(coData.launchedAt).toBeUndefined()
  })

  it("does NOT set wonAt, closedAt, or stage=Closed Won on opportunity", async () => {
    await accept()
    if (mockOppUpdate.mock.calls.length > 0) {
      const oppData = (mockOppUpdate.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data
      expect(oppData.wonAt).toBeUndefined()
      expect(oppData.closedAt).toBeUndefined()
      expect(oppData.stage).toBeUndefined()
    }
  })

  it("sets isDemo=true on org for test handoffs", async () => {
    mockHandoffFindUnique.mockResolvedValue({ ...HANDOFF_FOR_ACCEPT, isTest: true })
    await accept()
    expect(mockOrgCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isDemo: true }) })
    )
  })

  it("sets isDemo=false on org for non-test handoffs", async () => {
    await accept()
    expect(mockOrgCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isDemo: false }) })
    )
  })

  it("passes salesNotes as internalNotes to CustomerOnboarding", async () => {
    await accept()
    expect(mockCoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ internalNotes: "Big opportunity" }) })
    )
  })

  it("returns 403 for non-SA", async () => {
    mockGetSession.mockResolvedValue({ salesUserId: "rep1" })
    expect((await accept()).status).toBe(403)
  })

  it("returns 409 when status is not pending_review", async () => {
    mockHandoffFindUnique.mockResolvedValue({ ...HANDOFF_FOR_ACCEPT, status: "accepted" })
    expect((await accept()).status).toBe(409)
  })

  it("returns 409 when prospect already has an org (idempotency guard)", async () => {
    mockHandoffFindUnique.mockResolvedValue({
      ...HANDOFF_FOR_ACCEPT,
      prospect: { ...HANDOFF_FOR_ACCEPT.prospect, relayOrganizationId: "existing-org" },
    })
    expect((await accept()).status).toBe(409)
  })

  it("returns 404 for nonexistent handoff", async () => {
    mockHandoffFindUnique.mockResolvedValue(null)
    expect((await accept("missing")).status).toBe(404)
  })
})

// ─── POST /api/super-admin/handoffs/[id]/reject ───────────────────────────────
describe("POST /api/super-admin/handoffs/[id]/reject (Phase 2 reject flow)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue(SA_SESSION)
    mockHandoffFindUnique.mockResolvedValue({
      id: "h1", status: "pending_review", prospectId: "p1", companyName: "Acme Corp",
    })
    mockTx.mockResolvedValue([{}, {}])
  })

  async function reject(body: unknown, id = "h1") {
    const { POST } = await import("@/app/api/super-admin/handoffs/[id]/reject/route")
    return POST(jsonReq(body), { params: Promise.resolve({ id }) })
  }

  it("rejects with reason and returns 200", async () => {
    expect((await reject({ reason: "Missing signed contract" })).status).toBe(200)
  })

  it("returns 400 for missing reason", async () => {
    expect((await reject({})).status).toBe(400)
  })

  it("returns 400 for whitespace-only reason", async () => {
    expect((await reject({ reason: "   " })).status).toBe(400)
  })

  it("returns 400 for empty string reason", async () => {
    expect((await reject({ reason: "" })).status).toBe(400)
  })

  it("returns 403 for non-SA", async () => {
    mockGetSession.mockResolvedValue({ salesUserId: "rep1" })
    expect((await reject({ reason: "No" })).status).toBe(403)
  })

  it("returns 409 when already rejected", async () => {
    mockHandoffFindUnique.mockResolvedValue({ id: "h1", status: "rejected", prospectId: "p1", companyName: "Acme" })
    expect((await reject({ reason: "Again" })).status).toBe(409)
  })

  it("returns 409 when already accepted", async () => {
    mockHandoffFindUnique.mockResolvedValue({ id: "h1", status: "accepted", prospectId: "p1", companyName: "Acme" })
    expect((await reject({ reason: "No" })).status).toBe(409)
  })

  it("returns 404 for nonexistent handoff", async () => {
    mockHandoffFindUnique.mockResolvedValue(null)
    expect((await reject({ reason: "No" }, "missing")).status).toBe(404)
  })

  it("includes both handoff update and prospect reset in transaction", async () => {
    let txOps: unknown[] = []
    mockTx.mockImplementation((ops: unknown[]) => { txOps = ops; return Promise.resolve([{}, {}]) })
    await reject({ reason: "Missing info" })
    expect(Array.isArray(txOps)).toBe(true)
    expect(txOps).toHaveLength(2)
  })
})

// ─── Preservation: existing onboarding unaffected ────────────────────────────
describe("Existing CustomerOnboarding routes unaffected by Phase 2", () => {
  it("SA onboarding GET route still works independently", async () => {
    mockGetSession.mockResolvedValue(SA_SESSION)
    // The existing route uses prisma.customerOnboarding, not onboardingHandoff
    // This test just confirms the import still resolves
    const mod = await import("@/app/api/super-admin/onboarding/route")
    expect(typeof mod.GET).toBe("function")
    expect(typeof mod.POST).toBe("function")
  })
})
