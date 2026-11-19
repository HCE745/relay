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
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/session",   () => ({ getSession:        vi.fn() }))
vi.mock("@/lib/sales-auth",() => ({ getSalesSession:   vi.fn() }))

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

import { getSession }      from "@/lib/session"
import { getSalesSession } from "@/lib/sales-auth"
import { GET as listsGET, POST as listsPOST } from "@/app/api/super-admin/crm/prospects/discover/lists/route"
import { GET as listDetailGET, POST as listDetailPOST } from "@/app/api/super-admin/crm/prospects/discover/lists/[id]/route"
import { POST as promotePOST } from "@/app/api/super-admin/crm/prospects/discover/lists/[id]/promote/route"

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function repASession()  { return { salesUserId: "repA", superAdminId: null } }
function repBSession()  { return { salesUserId: "repB", superAdminId: null } }
function mgr1Session()  { return { salesUserId: "mgr1", salesUserRole: "admin_sales", superAdminId: null } }
function mgr2Session()  { return { salesUserId: "mgr2", salesUserRole: "admin_sales", superAdminId: null } }
function saSession()    { return { salesUserId: null,   superAdminId: "sa1", superAdmin: true } }

function saInfoSession() {
  return { salesUserId: "sa", salesUserRole: "super_admin", salesUserName: "Super Admin", isSuperAdmin: true, isManager: true, isRep: false, isDemo: false, isCrmImpersonation: false }
}
function repASalesInfo() {
  return { salesUserId: "repA", salesUserRole: "sales_rep", salesUserName: "Rep A", isSuperAdmin: false, isManager: false, isRep: true, isDemo: false, isCrmImpersonation: false }
}

function ownedByRepA() { return { id: "listA", salesUserId: "repA", superAdminId: null, isShared: false } }
function ownedByRepB() { return { id: "listB", salesUserId: "repB", superAdminId: null, isShared: false } }
function ownedBySA()   { return { id: "listSA", salesUserId: null,  superAdminId: "sa1", isShared: false } }
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
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await listsGET()
    expect(res.status).toBe(403)
  })

  it("rep sees only their own lists (salesUserId match)", async () => {
    vi.mocked(getSession).mockResolvedValue(repASession() as never)
    mockListFindMany.mockResolvedValue([])
    await listsGET()
    const call = mockListFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where).toMatchObject({ salesUserId: "repA", isExplicitlySaved: true })
    // No OR clause containing isShared
    expect(JSON.stringify(call.where)).not.toContain('"isShared"')
  })

  it("admin_sales manager sees only their own lists (no isShared broadcast)", async () => {
    vi.mocked(getSession).mockResolvedValue(mgr1Session() as never)
    mockListFindMany.mockResolvedValue([])
    await listsGET()
    const call = mockListFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where).toMatchObject({ salesUserId: "mgr1", isExplicitlySaved: true })
    expect(JSON.stringify(call.where)).not.toContain('"isShared"')
  })

  it("super-admin sees only SA-owned lists (superAdminId match)", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockListFindMany.mockResolvedValue([])
    await listsGET()
    const call = mockListFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(call.where).toMatchObject({ superAdminId: "sa1", isExplicitlySaved: true })
    expect(JSON.stringify(call.where)).not.toContain('"isShared"')
  })

  it("rep A does not receive rep B's lists even if they are marked isShared", async () => {
    vi.mocked(getSession).mockResolvedValue(repASession() as never)
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
    vi.mocked(getSession).mockResolvedValue(repASession() as never)
    mockListCreate.mockResolvedValue({ id: "new", isShared: false })
    const res = await listsPOST(makeReq({ name: "My list", isShared: true }) as never)
    expect(res.status).toBe(201)
    const createCall = mockListCreate.mock.calls[0]![0] as { data: { isShared: boolean } }
    expect(createCall.data.isShared).toBe(false)
  })

  it("admin_sales manager cannot create a shared list via forged body", async () => {
    vi.mocked(getSession).mockResolvedValue(mgr1Session() as never)
    mockListCreate.mockResolvedValue({ id: "new", isShared: false })
    await listsPOST(makeReq({ name: "Manager list", isShared: true }) as never)
    const createCall = mockListCreate.mock.calls[0]![0] as { data: { isShared: boolean } }
    expect(createCall.data.isShared).toBe(false)
  })

  it("super-admin CAN create a shared list", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockListCreate.mockResolvedValue({ id: "new", isShared: true })
    await listsPOST(makeReq({ name: "SA shared", isShared: true }) as never)
    const createCall = mockListCreate.mock.calls[0]![0] as { data: { isShared: boolean } }
    expect(createCall.data.isShared).toBe(true)
  })
})

// ─── GET /discover/lists/[id] — detail access ─────────────────────────────────

describe("GET /discover/lists/[id] — ownership required", () => {
  it("403 when rep A requests rep B's list", async () => {
    vi.mocked(getSession).mockResolvedValue(repASession() as never)
    mockListFindUnique.mockResolvedValue(listDetailWithResults(ownedByRepB()))
    const res = await listDetailGET(makeReq() as never, params("listB"))
    expect(res.status).toBe(403)
  })

  it("403 when rep A requests rep B's list even if isShared=true", async () => {
    vi.mocked(getSession).mockResolvedValue(repASession() as never)
    mockListFindUnique.mockResolvedValue(listDetailWithResults(sharedByRepB()))
    const res = await listDetailGET(makeReq() as never, params("listBS"))
    expect(res.status).toBe(403)
  })

  it("403 when manager 1 requests manager 2's list", async () => {
    vi.mocked(getSession).mockResolvedValue(mgr1Session() as never)
    mockListFindUnique.mockResolvedValue(listDetailWithResults({ ...ownedByRepB(), salesUserId: "mgr2" }))
    const res = await listDetailGET(makeReq() as never, params("listMgr2"))
    expect(res.status).toBe(403)
  })

  it("200 when rep A requests their own list", async () => {
    vi.mocked(getSession).mockResolvedValue(repASession() as never)
    mockListFindUnique.mockResolvedValue(listDetailWithResults(ownedByRepA()))
    const res = await listDetailGET(makeReq() as never, params("listA"))
    expect(res.status).toBe(200)
  })

  it("200 when SA requests their own SA-owned list", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockListFindUnique.mockResolvedValue(listDetailWithResults(ownedBySA()))
    const res = await listDetailGET(makeReq() as never, params("listSA"))
    expect(res.status).toBe(200)
  })

  it("403 when SA requests a rep's list (SA only owns SA lists)", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockListFindUnique.mockResolvedValue(listDetailWithResults(ownedByRepA()))
    const res = await listDetailGET(makeReq() as never, params("listA"))
    expect(res.status).toBe(403)
  })

  it("404 for non-existent list", async () => {
    vi.mocked(getSession).mockResolvedValue(repASession() as never)
    mockListFindUnique.mockResolvedValue(null)
    const res = await listDetailGET(makeReq() as never, params("does-not-exist"))
    expect(res.status).toBe(404)
  })
})

// ─── POST /discover/lists/[id] — Find More (append research) ─────────────────

describe("POST /discover/lists/[id] — Find More requires ownership", () => {
  it("403 when rep A tries to append to rep B's list", async () => {
    vi.mocked(getSession).mockResolvedValue(repASession() as never)
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
    vi.mocked(getSession).mockResolvedValue(repASession() as never)
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
    vi.mocked(getSession).mockResolvedValue(repASession() as never)
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
    vi.mocked(getSession).mockResolvedValue(repASession() as never)
    vi.mocked(getSalesSession).mockResolvedValue(repASalesInfo() as never)
    mockListFindUnique.mockResolvedValue(ownedByRepB())
    const res = await promotePOST(
      makeReq({ resultIds: ["r1"] }) as never,
      params("listB"),
    )
    expect(res.status).toBe(403)
  })

  it("403 when isShared=true but caller does not own the list", async () => {
    vi.mocked(getSession).mockResolvedValue(repASession() as never)
    vi.mocked(getSalesSession).mockResolvedValue(repASalesInfo() as never)
    mockListFindUnique.mockResolvedValue(sharedByRepB())
    const res = await promotePOST(
      makeReq({ resultIds: ["r1"] }) as never,
      params("listBS"),
    )
    expect(res.status).toBe(403)
  })

  it("403 for unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(getSalesSession).mockResolvedValue(null)
    const res = await promotePOST(makeReq({ resultIds: ["r1"] }) as never, params("listA"))
    expect(res.status).toBe(403)
  })
})
