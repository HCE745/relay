/**
 * Regression tests: Find Prospects Saved Lists cross-account isolation.
 *
 * Covers:
 * - Rep A cannot list or open Rep B's saved lists
 * - Rep A cannot continue research (Find More) on Rep B's lists
 * - Rep A cannot promote results from Rep B's lists
 * - Managers cannot access unrelated managers' lists
 * - Super-admin sees only their own lists in ordinary interface
 * - Forged isShared values in POST body do not expand visibility
 * - Direct URL/API access is denied when unauthorized
 * - CRM impersonation: SA sees impersonated rep's lists, not their own
 * - CRM impersonation: list creation uses rep's identity
 * - CRM impersonation: Find More and promotion respect rep's ownership
 * - Expired/invalid impersonation falls back to SA's own identity
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/session",    () => ({ getSession: vi.fn() }))
vi.mock("@/lib/sales-auth", () => ({ getSalesSession: vi.fn() }))

// Partial mock: keep listIsOwner real, mock only getResearchIdentity
vi.mock("@/lib/research-list-auth", async () => {
  const actual = await import("@/lib/research-list-auth")
  return { ...actual, getResearchIdentity: vi.fn() }
})

const mockListFindMany   = vi.fn()
const mockListFindUnique = vi.fn()
const mockResultCreate   = vi.fn()
const mockListCreate     = vi.fn()
const mockResultGroupBy  = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prospectResearchList:   {
      findMany:   (...a: unknown[]) => mockListFindMany(...a),
      findUnique: (...a: unknown[]) => mockListFindUnique(...a),
      create:     (...a: unknown[]) => mockListCreate(...a),
    },
    prospectResearchResult: {
      create:  (...a: unknown[]) => mockResultCreate(...a),
      groupBy: (...a: unknown[]) => mockResultGroupBy(...a),
    },
  },
}))

import { getSalesSession }      from "@/lib/sales-auth"
import { getResearchIdentity }  from "@/lib/research-list-auth"
import { GET as listsGET, POST as listsPOST } from "@/app/api/super-admin/crm/prospects/discover/lists/route"
import { GET as listDetailGET, POST as listDetailPOST } from "@/app/api/super-admin/crm/prospects/discover/lists/[id]/route"
import { POST as promotePOST } from "@/app/api/super-admin/crm/prospects/discover/lists/[id]/promote/route"

// ─── Identity fixtures ─────────────────────────────────────────────────────────

function repAIdentity()  { return { superAdminId: null, salesUserId: "repA", isCrmImpersonation: false } }
function repBIdentity()  { return { superAdminId: null, salesUserId: "repB", isCrmImpersonation: false } }
function mgr1Identity()  { return { superAdminId: null, salesUserId: "mgr1", isCrmImpersonation: false } }
function mgr2Identity()  { return { superAdminId: null, salesUserId: "mgr2", isCrmImpersonation: false } }
function saIdentity()    { return { superAdminId: "sa1", salesUserId: null,   isCrmImpersonation: false } }

// SA impersonating Rachel
function saImpersonatingRachel() { return { superAdminId: null, salesUserId: "rachel", isCrmImpersonation: true } }

// SalesSession fixtures (used for promote route which calls getSalesSession())
function saInfoSession() {
  return { salesUserId: "sa", salesUserRole: "super_admin", salesUserName: "Super Admin", isSuperAdmin: true, isManager: true, isRep: false, isDemo: false, isCrmImpersonation: false }
}
function repASalesInfo() {
  return { salesUserId: "repA", salesUserRole: "sales_rep", salesUserName: "Rep A", isSuperAdmin: false, isManager: false, isRep: true, isDemo: false, isCrmImpersonation: false }
}
function rachelSalesInfo() {
  return { salesUserId: "rachel", salesUserRole: "sales_rep", salesUserName: "Rachel Schneider", isSuperAdmin: false, isManager: false, isRep: true, isDemo: false, isCrmImpersonation: true }
}

function ownedByRepA() { return { id: "listA", salesUserId: "repA", superAdminId: null, isShared: false } }
function ownedByRepB() { return { id: "listB", salesUserId: "repB", superAdminId: null, isShared: false } }
function ownedBySA()   { return { id: "listSA", salesUserId: null,  superAdminId: "sa1", isShared: false } }
function ownedByRachel(){ return { id: "listRachel", salesUserId: "rachel", superAdminId: null, isShared: false } }
// A list that has isShared: true but is owned by repB
function sharedByRepB(){ return { id: "listBS", salesUserId: "repB", superAdminId: null, isShared: true } }

function listDetailWithResults(base: { id: string; salesUserId: string | null; superAdminId: string | null; isShared: boolean }) {
  return { ...base, results: [], _count: { results: 0 }, name: "Test", status: "active", isExplicitlySaved: true, createdAt: new Date().toISOString() }
}

function makeReq(body?: unknown) {
  const req = new Request("http://localhost/", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  return req
}
function params(id: string) { return { params: Promise.resolve({ id }) } }

beforeEach(() => {
  vi.clearAllMocks()
  mockResultGroupBy.mockResolvedValue([])
  mockResultCreate.mockResolvedValue({})
})

// ─── GET /discover/lists — listing ────────────────────────────────────────────

describe("GET /discover/lists — ownership scoping", () => {
  it("returns 403 for unauthenticated", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(null)
    const res = await listsGET()
    expect(res.status).toBe(403)
  })

  it("rep sees only their own lists (salesUserId match)", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(repAIdentity())
    mockListFindMany.mockResolvedValue([])
    await listsGET()
    const call = mockListFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where).toMatchObject({ salesUserId: "repA", isExplicitlySaved: true })
    // No OR clause containing isShared
    expect(JSON.stringify(call.where)).not.toContain('"isShared"')
  })

  it("admin_sales manager sees only their own lists (no isShared broadcast)", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(mgr1Identity())
    mockListFindMany.mockResolvedValue([])
    await listsGET()
    const call = mockListFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where).toMatchObject({ salesUserId: "mgr1", isExplicitlySaved: true })
    expect(JSON.stringify(call.where)).not.toContain('"isShared"')
  })

  it("super-admin sees only SA-owned lists (superAdminId match)", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saIdentity())
    mockListFindMany.mockResolvedValue([])
    await listsGET()
    const call = mockListFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where).toMatchObject({ superAdminId: "sa1", isExplicitlySaved: true })
    expect(JSON.stringify(call.where)).not.toContain('"isShared"')
  })

  it("rep A does not receive rep B's lists even if they are marked isShared", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(repAIdentity())
    // Simulate DB returning nothing (repA has no lists); repB's shared list is NOT returned
    mockListFindMany.mockResolvedValue([])
    const res = await listsGET()
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(data).toHaveLength(0)
    // Verify the query has no OR clause that would pull in other users' lists
    const call = mockListFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where).not.toHaveProperty("OR")
  })
})

// ─── POST /discover/lists — create with isShared ──────────────────────────────

describe("POST /discover/lists — isShared gating", () => {
  it("ordinary rep cannot create a shared list (isShared forced to false)", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(repAIdentity())
    mockListCreate.mockResolvedValue({ id: "new", isShared: false })
    const res = await listsPOST(makeReq({ name: "My list", isShared: true }) as never)
    expect(res.status).toBe(201)
    const createCall = mockListCreate.mock.calls[0]![0] as { data: { isShared: boolean } }
    expect(createCall.data.isShared).toBe(false)
  })

  it("admin_sales manager cannot create a shared list via forged body", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(mgr1Identity())
    mockListCreate.mockResolvedValue({ id: "new", isShared: false })
    await listsPOST(makeReq({ name: "Manager list", isShared: true }) as never)
    const createCall = mockListCreate.mock.calls[0]![0] as { data: { isShared: boolean } }
    expect(createCall.data.isShared).toBe(false)
  })

  it("super-admin CAN create a shared list", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saIdentity())
    mockListCreate.mockResolvedValue({ id: "new", isShared: true })
    await listsPOST(makeReq({ name: "SA shared", isShared: true }) as never)
    const createCall = mockListCreate.mock.calls[0]![0] as { data: { isShared: boolean } }
    expect(createCall.data.isShared).toBe(true)
  })
})

// ─── GET /discover/lists/[id] — detail access ─────────────────────────────────

describe("GET /discover/lists/[id] — ownership required", () => {
  it("403 when rep A requests rep B's list", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(repAIdentity())
    mockListFindUnique.mockResolvedValue(listDetailWithResults(ownedByRepB()))
    const res = await listDetailGET(makeReq() as never, params("listB"))
    expect(res.status).toBe(403)
  })

  it("403 when rep A requests rep B's list even if isShared=true", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(repAIdentity())
    mockListFindUnique.mockResolvedValue(listDetailWithResults(sharedByRepB()))
    const res = await listDetailGET(makeReq() as never, params("listBS"))
    expect(res.status).toBe(403)
  })

  it("403 when manager 1 requests manager 2's list", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(mgr1Identity())
    mockListFindUnique.mockResolvedValue(listDetailWithResults({ ...ownedByRepB(), salesUserId: "mgr2" }))
    const res = await listDetailGET(makeReq() as never, params("listMgr2"))
    expect(res.status).toBe(403)
  })

  it("200 when rep A requests their own list", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(repAIdentity())
    mockListFindUnique.mockResolvedValue(listDetailWithResults(ownedByRepA()))
    const res = await listDetailGET(makeReq() as never, params("listA"))
    expect(res.status).toBe(200)
  })

  it("200 when SA requests their own SA-owned list", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saIdentity())
    mockListFindUnique.mockResolvedValue(listDetailWithResults(ownedBySA()))
    const res = await listDetailGET(makeReq() as never, params("listSA"))
    expect(res.status).toBe(200)
  })

  it("403 when SA requests a rep's list (SA only owns SA lists)", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saIdentity())
    mockListFindUnique.mockResolvedValue(listDetailWithResults(ownedByRepA()))
    const res = await listDetailGET(makeReq() as never, params("listA"))
    expect(res.status).toBe(403)
  })

  it("404 for non-existent list", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(repAIdentity())
    mockListFindUnique.mockResolvedValue(null)
    const res = await listDetailGET(makeReq() as never, params("does-not-exist"))
    expect(res.status).toBe(404)
  })
})

// ─── POST /discover/lists/[id] — Find More (append research) ─────────────────

describe("POST /discover/lists/[id] — Find More requires ownership", () => {
  it("403 when rep A tries to append to rep B's list", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(repAIdentity())
    mockListFindUnique.mockResolvedValue({
      ...ownedByRepB(),
      _count: { results: 0 },
      results: [],
      searchState: null,
    })
    const res = await listDetailPOST(
      makeReq({ results: [{ companyName: "ACME" }] }) as never,
      params("listB"),
    )
    expect(res.status).toBe(403)
  })

  it("403 when isShared=true but caller is not the owner", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(repAIdentity())
    mockListFindUnique.mockResolvedValue({
      ...sharedByRepB(),
      _count: { results: 0 },
      results: [],
      searchState: null,
    })
    const res = await listDetailPOST(
      makeReq({ results: [{ companyName: "ACME" }] }) as never,
      params("listBS"),
    )
    expect(res.status).toBe(403)
  })

  it("200 when rep A appends to their own list", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(repAIdentity())
    mockListFindUnique
      .mockResolvedValueOnce({ ...ownedByRepA(), _count: { results: 0 }, results: [], searchState: null })
      .mockResolvedValueOnce({ ...ownedByRepA(), _count: { results: 1 } })
    const res = await listDetailPOST(
      makeReq({ results: [{ companyName: "ACME" }] }) as never,
      params("listA"),
    )
    expect(res.status).toBe(200)
  })
})

// ─── POST /discover/lists/[id]/promote ────────────────────────────────────────

describe("POST /discover/lists/[id]/promote — requires ownership", () => {
  it("403 when rep A tries to promote from rep B's list", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(repAIdentity())
    vi.mocked(getSalesSession).mockResolvedValue(repASalesInfo() as never)
    mockListFindUnique.mockResolvedValue(ownedByRepB())
    const res = await promotePOST(
      makeReq({ resultIds: ["r1"] }) as never,
      params("listB"),
    )
    expect(res.status).toBe(403)
  })

  it("403 when isShared=true but caller does not own the list", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(repAIdentity())
    vi.mocked(getSalesSession).mockResolvedValue(repASalesInfo() as never)
    mockListFindUnique.mockResolvedValue(sharedByRepB())
    const res = await promotePOST(
      makeReq({ resultIds: ["r1"] }) as never,
      params("listBS"),
    )
    expect(res.status).toBe(403)
  })

  it("403 for unauthenticated", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(null)
    vi.mocked(getSalesSession).mockResolvedValue(null)
    const res = await promotePOST(makeReq({ resultIds: ["r1"] }) as never, params("listA"))
    expect(res.status).toBe(403)
  })
})

// ─── CRM impersonation session identity ───────────────────────────────────────

describe("CRM impersonation — Saved Lists identity resolution", () => {
  it("SA impersonating Rachel sees Rachel's lists, not SA's", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saImpersonatingRachel())
    mockListFindMany.mockResolvedValue([])
    await listsGET()
    const call = mockListFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    // Must scope by Rachel's salesUserId, NOT by SA's superAdminId
    expect(call.where).toMatchObject({ salesUserId: "rachel", isExplicitlySaved: true })
    expect(call.where).not.toHaveProperty("superAdminId")
  })

  it("SA outside impersonation sees only SA-owned lists", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saIdentity())
    mockListFindMany.mockResolvedValue([])
    await listsGET()
    const call = mockListFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where).toMatchObject({ superAdminId: "sa1", isExplicitlySaved: true })
    expect(call.where).not.toHaveProperty("salesUserId")
  })

  it("ordinary rep outside impersonation sees only their own lists", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(repAIdentity())
    mockListFindMany.mockResolvedValue([])
    await listsGET()
    const call = mockListFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where).toMatchObject({ salesUserId: "repA", isExplicitlySaved: true })
    expect(call.where).not.toHaveProperty("superAdminId")
  })

  it("list creation during impersonation assigns to Rachel (salesUserId), not SA (superAdminId)", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saImpersonatingRachel())
    mockListCreate.mockResolvedValue({ id: "new-list", salesUserId: "rachel", superAdminId: null, isShared: false })
    await listsPOST(makeReq({ name: "Rachel's research" }) as never)
    const createCall = mockListCreate.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(createCall.data.salesUserId).toBe("rachel")
    expect(createCall.data.superAdminId).toBeNull()
  })

  it("list creation during impersonation cannot create shared lists", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saImpersonatingRachel())
    mockListCreate.mockResolvedValue({ id: "new-list", isShared: false })
    await listsPOST(makeReq({ name: "Rachel's research", isShared: true }) as never)
    const createCall = mockListCreate.mock.calls[0]![0] as { data: { isShared: boolean } }
    // superAdminId is null during impersonation, so isShared is forced false
    expect(createCall.data.isShared).toBe(false)
  })

  it("SA impersonating Rachel can open Rachel's list (200)", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saImpersonatingRachel())
    mockListFindUnique.mockResolvedValue(listDetailWithResults(ownedByRachel()))
    const res = await listDetailGET(makeReq() as never, params("listRachel"))
    expect(res.status).toBe(200)
  })

  it("SA impersonating Rachel cannot open SA's own list (403)", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saImpersonatingRachel())
    mockListFindUnique.mockResolvedValue(listDetailWithResults(ownedBySA()))
    const res = await listDetailGET(makeReq() as never, params("listSA"))
    expect(res.status).toBe(403)
  })

  it("SA impersonating Rachel can Find More on Rachel's list (200)", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saImpersonatingRachel())
    mockListFindUnique
      .mockResolvedValueOnce({ ...ownedByRachel(), _count: { results: 0 }, results: [], searchState: null })
      .mockResolvedValueOnce({ ...ownedByRachel(), _count: { results: 1 } })
    const res = await listDetailPOST(
      makeReq({ results: [{ companyName: "ACME" }] }) as never,
      params("listRachel"),
    )
    expect(res.status).toBe(200)
  })

  it("SA impersonating Rachel cannot Find More on SA's list (403)", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saImpersonatingRachel())
    mockListFindUnique.mockResolvedValue({
      ...ownedBySA(),
      _count: { results: 0 },
      results: [],
      searchState: null,
    })
    const res = await listDetailPOST(
      makeReq({ results: [{ companyName: "ACME" }] }) as never,
      params("listSA"),
    )
    expect(res.status).toBe(403)
  })

  it("promote: SA impersonating Rachel can promote from Rachel's list (ownership check passes)", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saImpersonatingRachel())
    vi.mocked(getSalesSession).mockResolvedValue(rachelSalesInfo() as never)
    // No results to actually promote — just verify ownership passes (resultIds empty → 400 not 403)
    mockListFindUnique.mockResolvedValue(ownedByRachel())
    const res = await promotePOST(
      makeReq({ resultIds: [] }) as never,
      params("listRachel"),
    )
    // Ownership passes (not 403); empty resultIds gives 400
    expect(res.status).not.toBe(403)
  })

  it("promote: SA impersonating Rachel cannot promote from SA's list (403)", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saImpersonatingRachel())
    vi.mocked(getSalesSession).mockResolvedValue(rachelSalesInfo() as never)
    mockListFindUnique.mockResolvedValue(ownedBySA())
    const res = await promotePOST(
      makeReq({ resultIds: ["r1"] }) as never,
      params("listSA"),
    )
    expect(res.status).toBe(403)
  })

  it("expired impersonation falls back to SA's own identity and cannot access Rachel's list", async () => {
    // getSalesSession() falls through to SA path when impersonation expires
    // getResearchIdentity() therefore returns SA identity
    vi.mocked(getResearchIdentity).mockResolvedValue(saIdentity())
    mockListFindUnique.mockResolvedValue(listDetailWithResults(ownedByRachel()))
    const res = await listDetailGET(makeReq() as never, params("listRachel"))
    // SA's own superAdminId !== Rachel's superAdminId (null) → 403
    expect(res.status).toBe(403)
  })

  it("expired impersonation falls back to SA listing SA's own lists", async () => {
    vi.mocked(getResearchIdentity).mockResolvedValue(saIdentity())
    mockListFindMany.mockResolvedValue([])
    await listsGET()
    const call = mockListFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where).toMatchObject({ superAdminId: "sa1", isExplicitlySaved: true })
  })

  it("direct access to another rep's list is still prohibited during impersonation", async () => {
    // SA impersonating Rachel cannot access repA's list
    vi.mocked(getResearchIdentity).mockResolvedValue(saImpersonatingRachel())
    mockListFindUnique.mockResolvedValue(listDetailWithResults(ownedByRepA()))
    const res = await listDetailGET(makeReq() as never, params("listA"))
    expect(res.status).toBe(403)
  })
})
