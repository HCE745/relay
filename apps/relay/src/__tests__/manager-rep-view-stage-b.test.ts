/**
 * Tests for Sales Manager Rep View — Stage B (read-only CRM workspace views).
 *
 * Covers:
 * - GET /api/sales/manager/rep-view/[repId]/prospects: auth, record isolation
 * - GET /api/sales/manager/rep-view/[repId]/tasks: auth, record isolation
 * - GET /api/sales/manager/rep-view/[repId]/opportunities: auth, record isolation
 * - Unauthorized cross-manager access returns 403
 * - Unauthenticated access returns 403
 * - Data returned is scoped to the target repId
 * - No write/mutation endpoints exist under rep-view
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}))

const mockProspectFindMany    = vi.fn()
const mockProspectCount       = vi.fn()
const mockCrmTaskFindMany     = vi.fn()
const mockOppFindMany         = vi.fn()
const mockSalesUserFindUnique = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prospect:        { findMany: (...a: unknown[]) => mockProspectFindMany(...a),    count: (...a: unknown[]) => mockProspectCount(...a) },
    crmTask:         { findMany: (...a: unknown[]) => mockCrmTaskFindMany(...a) },
    crmOpportunity:  { findMany: (...a: unknown[]) => mockOppFindMany(...a) },
    salesUser:       { findUnique: (...a: unknown[]) => mockSalesUserFindUnique(...a) },
  },
}))

import { getSession } from "@/lib/session"
import { GET as GET_PROSPECTS }    from "@/app/api/sales/manager/rep-view/[repId]/prospects/route"
import { GET as GET_TASKS }        from "@/app/api/sales/manager/rep-view/[repId]/tasks/route"
import { GET as GET_OPPS }         from "@/app/api/sales/manager/rep-view/[repId]/opportunities/route"

function params(repId: string) {
  return { params: Promise.resolve({ repId }) }
}

function makeReq(): Request {
  return new Request("http://localhost/api/test")
}

function managerSession(id = "mgr1") {
  return { salesUserId: id, salesUserRole: "admin_sales" }
}
function repSession() {
  return { salesUserId: "rep1", salesUserRole: "sales_rep" }
}
function saSession() {
  return { superAdmin: true }
}

// Manager's SalesUser record
function managerRecord(id = "mgr1") {
  return { id, isActive: true, role: "admin_sales", name: "Manager", isDemo: false }
}
// Rep assigned to mgr1
function assignedRepRecord(id = "rep1") {
  return { id, isActive: true, role: "sales_rep", name: "Rep", isDemo: false, managerId: "mgr1" }
}
// Rep assigned to a different manager
function otherRepRecord(id = "rep2") {
  return { id, isActive: true, role: "sales_rep", name: "Other Rep", isDemo: false, managerId: "mgr99" }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── prospects ───────────────────────────────────────────────────────────────

describe("GET /api/sales/manager/rep-view/[repId]/prospects", () => {
  it("returns 403 for unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await GET_PROSPECTS(makeReq(), params("rep1"))
    expect(res.status).toBe(403)
  })

  it("returns 403 for sales_rep caller", async () => {
    vi.mocked(getSession).mockResolvedValue(repSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(assignedRepRecord())
    const res = await GET_PROSPECTS(makeReq(), params("rep1"))
    expect(res.status).toBe(403)
  })

  it("returns 403 when manager tries to view an unassigned rep (cross-manager)", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    // getSalesSession internal lookup for "mgr1"
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      // getManagerRepView lookup for the rep
      .mockResolvedValueOnce(otherRepRecord())
    const res = await GET_PROSPECTS(makeReq(), params("rep2"))
    expect(res.status).toBe(403)
  })

  it("returns 200 with rep's prospects for assigned manager", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce(assignedRepRecord())
    mockProspectFindMany.mockResolvedValue([
      { id: "p1", companyName: "Acme", currentCrmStatus: "researched", industry: "Manufacturing", aiFitScore: 85 },
    ])
    const res = await GET_PROSPECTS(makeReq(), params("rep1"))
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(data).toHaveLength(1)
    // Verify query was scoped to the rep
    const whereArg = mockProspectFindMany.mock.calls[0][0].where
    expect(whereArg).toMatchObject({ assignedToId: "rep1" })
  })

  it("super-admin can view any rep's prospects", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(otherRepRecord())
    mockProspectFindMany.mockResolvedValue([])
    const res = await GET_PROSPECTS(makeReq(), params("rep2"))
    expect(res.status).toBe(200)
  })

  it("data is isolated — query uses correct assignedToId", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce({ ...assignedRepRecord(), id: "rep99", managerId: "mgr1" })
    mockProspectFindMany.mockResolvedValue([])
    await GET_PROSPECTS(makeReq(), params("rep99"))
    const whereArg = mockProspectFindMany.mock.calls[0][0].where
    expect(whereArg.assignedToId).toBe("rep99")
  })
})

// ─── tasks ────────────────────────────────────────────────────────────────────

describe("GET /api/sales/manager/rep-view/[repId]/tasks", () => {
  it("returns 403 for unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await GET_TASKS(makeReq(), params("rep1"))
    expect(res.status).toBe(403)
  })

  it("returns 403 for cross-manager access", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce(otherRepRecord())
    const res = await GET_TASKS(makeReq(), params("rep2"))
    expect(res.status).toBe(403)
  })

  it("returns 200 with tasks scoped to rep", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce(assignedRepRecord())
    mockCrmTaskFindMany.mockResolvedValue([
      { id: "t1", title: "Call Acme", taskType: "call", dueAt: null, completedAt: null, priority: "normal" },
    ])
    const res = await GET_TASKS(makeReq(), params("rep1"))
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(data).toHaveLength(1)
    const whereArg = mockCrmTaskFindMany.mock.calls[0][0].where
    expect(whereArg).toMatchObject({ assignedToId: "rep1" })
  })

  it("no POST/PUT/PATCH/DELETE — route only exports GET", async () => {
    const mod = await import("@/app/api/sales/manager/rep-view/[repId]/tasks/route")
    expect((mod as Record<string, unknown>).POST).toBeUndefined()
    expect((mod as Record<string, unknown>).PATCH).toBeUndefined()
    expect((mod as Record<string, unknown>).DELETE).toBeUndefined()
  })
})

// ─── opportunities ────────────────────────────────────────────────────────────

describe("GET /api/sales/manager/rep-view/[repId]/opportunities", () => {
  it("returns 403 for unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await GET_OPPS(makeReq(), params("rep1"))
    expect(res.status).toBe(403)
  })

  it("returns 403 for cross-manager access", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce(otherRepRecord())
    const res = await GET_OPPS(makeReq(), params("rep2"))
    expect(res.status).toBe(403)
  })

  it("returns 200 with opportunities scoped to rep", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce(assignedRepRecord())
    mockOppFindMany.mockResolvedValue([
      { id: "o1", title: "Acme Deal", stage: "Qualified", value: "10000", closeDate: null },
    ])
    const res = await GET_OPPS(makeReq(), params("rep1"))
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(data).toHaveLength(1)
    const whereArg = mockOppFindMany.mock.calls[0][0].where
    expect(whereArg).toMatchObject({ assignedToId: "rep1" })
  })

  it("no POST/PUT/PATCH/DELETE — route only exports GET", async () => {
    const mod = await import("@/app/api/sales/manager/rep-view/[repId]/opportunities/route")
    expect((mod as Record<string, unknown>).POST).toBeUndefined()
    expect((mod as Record<string, unknown>).PATCH).toBeUndefined()
    expect((mod as Record<string, unknown>).DELETE).toBeUndefined()
  })

  it("super-admin can view any rep's opportunities", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(otherRepRecord())
    mockOppFindMany.mockResolvedValue([])
    const res = await GET_OPPS(makeReq(), params("rep2"))
    expect(res.status).toBe(200)
  })

  it("data is isolated — query uses correct assignedToId", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue({ ...otherRepRecord(), id: "rep55" })
    mockOppFindMany.mockResolvedValue([])
    await GET_OPPS(makeReq(), params("rep55"))
    const whereArg = mockOppFindMany.mock.calls[0][0].where
    expect(whereArg.assignedToId).toBe("rep55")
  })
})

// ─── prospects route only exports GET ────────────────────────────────────────

describe("Read-only route constraint — prospects", () => {
  it("no POST/PUT/PATCH/DELETE on prospects route", async () => {
    const mod = await import("@/app/api/sales/manager/rep-view/[repId]/prospects/route")
    expect((mod as Record<string, unknown>).POST).toBeUndefined()
    expect((mod as Record<string, unknown>).PATCH).toBeUndefined()
    expect((mod as Record<string, unknown>).DELETE).toBeUndefined()
  })
})
