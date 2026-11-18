/**
 * Tests for Sales Manager Rep View — Part 1 (Research Lists) + Stage C (Performance).
 *
 * Covers:
 * - GET /api/sales/manager/rep-view/[repId]/research-lists: auth, record isolation, isExplicitlySaved filter
 * - GET /api/sales/manager/rep-view/[repId]/performance: auth, record isolation, period param
 * - Cross-manager access returns 403 on both endpoints
 * - Unauthenticated access returns 403
 * - Data is scoped to target repId
 * - No write endpoints on either route
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }))

const mockSalesUserFindUnique    = vi.fn()
const mockResearchListFindMany   = vi.fn()
const mockDailyFindMany          = vi.fn()
const mockOppCount               = vi.fn()
const mockOppAggregate           = vi.fn()
const mockActivityGroupBy        = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesUser:              { findUnique: (...a: unknown[]) => mockSalesUserFindUnique(...a) },
    prospectResearchList:   { findMany: (...a: unknown[]) => mockResearchListFindMany(...a) },
    salesDailyActivity:     { findMany: (...a: unknown[]) => mockDailyFindMany(...a) },
    crmOpportunity:         {
      count:     (...a: unknown[]) => mockOppCount(...a),
      aggregate: (...a: unknown[]) => mockOppAggregate(...a),
      findMany:  () => Promise.resolve([]),
    },
    salesCrmActivity:       { groupBy: (...a: unknown[]) => mockActivityGroupBy(...a) },
    crmEmail:               { count: () => Promise.resolve(0) },
  },
}))

import { getSession } from "@/lib/session"
import { GET as GET_LISTS }   from "@/app/api/sales/manager/rep-view/[repId]/research-lists/route"
import { GET as GET_PERF }    from "@/app/api/sales/manager/rep-view/[repId]/performance/route"

function params(repId: string) {
  return { params: Promise.resolve({ repId }) }
}
function makeReq(search = "") {
  return new Request(`http://localhost/api/test${search}`)
}
function saSession()      { return { superAdmin: true } }
function managerSession() { return { salesUserId: "mgr1", salesUserRole: "admin_sales" } }
function repSession()     { return { salesUserId: "rep1", salesUserRole: "sales_rep" } }
function managerRecord()  { return { id: "mgr1", isActive: true, role: "admin_sales", name: "Manager", isDemo: false } }
function assignedRep()    { return { id: "rep1", isActive: true, role: "sales_rep",   name: "Rep",     isDemo: false, managerId: "mgr1" } }
function otherRep()       { return { id: "rep2", isActive: true, role: "sales_rep",   name: "Other",   isDemo: false, managerId: "mgr99" } }

beforeEach(() => {
  vi.clearAllMocks()
  // Default aggregate return
  mockOppAggregate.mockResolvedValue({ _sum: { value: null }, _count: { _all: 0 } })
  mockOppCount.mockResolvedValue(0)
  mockDailyFindMany.mockResolvedValue([])
  mockActivityGroupBy.mockResolvedValue([])
  mockResearchListFindMany.mockResolvedValue([])
})

// ─── research-lists ───────────────────────────────────────────────────────────

describe("GET /api/sales/manager/rep-view/[repId]/research-lists", () => {
  it("returns 403 for unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await GET_LISTS(makeReq(), params("rep1"))
    expect(res.status).toBe(403)
  })

  it("returns 403 for sales_rep caller", async () => {
    vi.mocked(getSession).mockResolvedValue(repSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(assignedRep())
    const res = await GET_LISTS(makeReq(), params("rep1"))
    expect(res.status).toBe(403)
  })

  it("returns 403 for cross-manager access", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce(otherRep())
    const res = await GET_LISTS(makeReq(), params("rep2"))
    expect(res.status).toBe(403)
  })

  it("returns 200 for assigned manager", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce(assignedRep())
    mockResearchListFindMany.mockResolvedValue([
      { id: "l1", name: "MI Manufacturing", status: "active", createdAt: new Date(), _count: { results: 12 } },
    ])
    const res = await GET_LISTS(makeReq(), params("rep1"))
    expect(res.status).toBe(200)
    const data = await res.json() as unknown[]
    expect(data).toHaveLength(1)
  })

  it("query filters by salesUserId and isExplicitlySaved: true", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce(assignedRep())
    mockResearchListFindMany.mockResolvedValue([])
    await GET_LISTS(makeReq(), params("rep1"))
    const whereArg = mockResearchListFindMany.mock.calls[0][0].where
    expect(whereArg).toMatchObject({ salesUserId: "rep1", isExplicitlySaved: true })
  })

  it("super-admin can view any rep's research lists", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(otherRep())
    mockResearchListFindMany.mockResolvedValue([])
    const res = await GET_LISTS(makeReq(), params("rep2"))
    expect(res.status).toBe(200)
  })

  it("no write endpoints on research-lists route", async () => {
    const mod = await import("@/app/api/sales/manager/rep-view/[repId]/research-lists/route")
    expect((mod as Record<string, unknown>).POST).toBeUndefined()
    expect((mod as Record<string, unknown>).PATCH).toBeUndefined()
    expect((mod as Record<string, unknown>).DELETE).toBeUndefined()
  })
})

// ─── performance ──────────────────────────────────────────────────────────────

describe("GET /api/sales/manager/rep-view/[repId]/performance", () => {
  it("returns 403 for unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await GET_PERF(makeReq(), params("rep1"))
    expect(res.status).toBe(403)
  })

  it("returns 403 for sales_rep caller", async () => {
    vi.mocked(getSession).mockResolvedValue(repSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(assignedRep())
    const res = await GET_PERF(makeReq(), params("rep1"))
    expect(res.status).toBe(403)
  })

  it("returns 403 for cross-manager access", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce(otherRep())
    const res = await GET_PERF(makeReq(), params("rep2"))
    expect(res.status).toBe(403)
  })

  it("returns 200 with totals for assigned manager", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce(assignedRep())
    mockDailyFindMany.mockResolvedValue([
      { date: new Date(), emailsSent: 5, followUpsWorked: 3, prospectsContacted: 2,
        prospectsAdded: 1, tasksCompleted: 2, demosLogged: 1, timeInAppMinutes: 120 },
    ])
    const res = await GET_PERF(makeReq(), params("rep1"))
    expect(res.status).toBe(200)
    const data = await res.json() as { totals: { emailsSent: number } }
    expect(data.totals.emailsSent).toBe(5)
  })

  it("daily query is scoped to repId", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce({ ...assignedRep(), id: "rep77", managerId: "mgr1" })
    await GET_PERF(makeReq(), params("rep77"))
    const whereArg = mockDailyFindMany.mock.calls[0][0].where
    expect(whereArg.salesUserId).toBe("rep77")
  })

  it("accepts period query param and defaults to 30d", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(assignedRep())
    const res = await GET_PERF(makeReq("?period=7d"), params("rep1"))
    expect(res.status).toBe(200)
    const data = await res.json() as { period: string }
    expect(data.period).toBe("7d")
  })

  it("ignores invalid period and falls back to 30d", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(assignedRep())
    const res = await GET_PERF(makeReq("?period=lifetime"), params("rep1"))
    expect(res.status).toBe(200)
    const data = await res.json() as { period: string }
    expect(data.period).toBe("30d")
  })

  it("no write endpoints on performance route", async () => {
    const mod = await import("@/app/api/sales/manager/rep-view/[repId]/performance/route")
    expect((mod as Record<string, unknown>).POST).toBeUndefined()
    expect((mod as Record<string, unknown>).PATCH).toBeUndefined()
    expect((mod as Record<string, unknown>).DELETE).toBeUndefined()
  })

  it("super-admin can view any rep's performance", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(otherRep())
    const res = await GET_PERF(makeReq(), params("rep2"))
    expect(res.status).toBe(200)
  })
})
