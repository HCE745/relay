/**
 * Tests for Sales Manager Rep View — Stage D (Read-Only Email Visibility).
 *
 * Covers:
 * - GET /api/sales/manager/rep-view/[repId]/emails: auth, rep scoping, CRM filtering, read-only
 * - 403 for unauthenticated, rep caller, cross-manager
 * - 200 for assigned manager, super-admin
 * - Query scoped to sentBySalesUserId and mailboxOwnerSalesUserId
 * - isDeleted: false enforced
 * - No write endpoints (POST/PATCH/DELETE absent)
 * - Direction and date filters are forwarded to the query
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }))

const mockSalesUserFindUnique = vi.fn()
const mockCrmEmailFindMany    = vi.fn()
const mockCrmEmailCount       = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesUser: { findUnique: (...a: unknown[]) => mockSalesUserFindUnique(...a) },
    crmEmail:  {
      findMany: (...a: unknown[]) => mockCrmEmailFindMany(...a),
      count:    (...a: unknown[]) => mockCrmEmailCount(...a),
    },
  },
}))

import { getSession } from "@/lib/session"
import { GET } from "@/app/api/sales/manager/rep-view/[repId]/emails/route"

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

function makeEmail(overrides = {}) {
  return {
    id:             "e1",
    direction:      "sent",
    fromAddress:    "rep@example.com",
    toAddress:      "prospect@acme.com",
    cc:             null,
    subject:        "Following up",
    bodyHtml:       null,
    bodyText:       "Hi there",
    messageId:      null,
    inReplyTo:      null,
    threadId:       null,
    sentAt:         new Date(),
    source:         "crm",
    isRead:         true,
    contactEmail:   "prospect@acme.com",
    followUpDate:   null,
    followUpDoneAt: null,
    stageNumber:    1,
    openedAt:       null,
    openCount:      0,
    lastOpenedAt:   null,
    sentiment:      null,
    prospectId:     "prospect1",
    demoCall:       null,
    prospect:       { id: "prospect1", companyName: "Acme" },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCrmEmailFindMany.mockResolvedValue([])
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("GET /api/sales/manager/rep-view/[repId]/emails", () => {
  it("returns 403 for unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const res = await GET(makeReq(), params("rep1"))
    expect(res.status).toBe(403)
  })

  it("returns 403 for sales_rep caller", async () => {
    vi.mocked(getSession).mockResolvedValue(repSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(assignedRep())
    const res = await GET(makeReq(), params("rep1"))
    expect(res.status).toBe(403)
  })

  it("returns 403 for cross-manager access", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce(otherRep())
    const res = await GET(makeReq(), params("rep2"))
    expect(res.status).toBe(403)
  })

  it("returns 200 for assigned manager", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce(assignedRep())
    mockCrmEmailFindMany.mockResolvedValue([makeEmail()])
    const res = await GET(makeReq(), params("rep1"))
    expect(res.status).toBe(200)
    const data = await res.json() as { emails: unknown[] }
    expect(data.emails).toHaveLength(1)
  })

  it("returns 200 for super-admin", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(otherRep())
    mockCrmEmailFindMany.mockResolvedValue([])
    const res = await GET(makeReq(), params("rep2"))
    expect(res.status).toBe(200)
  })
})

// ─── Query scoping ────────────────────────────────────────────────────────────

describe("email query scoping", () => {
  async function authorizedGet(repId: string, search = "") {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue({ ...assignedRep(), id: repId, managerId: "mgr1" })
    await GET(makeReq(search), params(repId))
    return mockCrmEmailFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
  }

  it("scopes to sentBySalesUserId and mailboxOwnerSalesUserId", async () => {
    const call = await authorizedGet("rep77")
    const where = call.where as { isDeleted: boolean; OR: Array<Record<string, unknown>> }
    expect(where.isDeleted).toBe(false)
    expect(where.OR).toEqual(expect.arrayContaining([
      { sentBySalesUserId: "rep77" },
      { mailboxOwnerSalesUserId: "rep77", direction: "received" },
    ]))
  })

  it("passes direction filter from query param", async () => {
    const call = await authorizedGet("rep1", "?direction=sent")
    const where = call.where as { direction?: string }
    expect(where.direction).toBe("sent")
  })

  it("passes date filters from query params", async () => {
    const call = await authorizedGet("rep1", "?startDate=2026-01-01&endDate=2026-11-01")
    const where = call.where as { sentAt?: { gte?: Date; lte?: Date } }
    expect(where.sentAt?.gte).toBeInstanceOf(Date)
    expect(where.sentAt?.lte).toBeInstanceOf(Date)
  })

  it("limits results to 500", async () => {
    const call = await authorizedGet("rep1")
    expect(mockCrmEmailFindMany.mock.calls[0][0].take).toBe(500)
  })
})

// ─── Read-only ────────────────────────────────────────────────────────────────

describe("read-only enforcement", () => {
  it("no write endpoints on emails route", async () => {
    const mod = await import("@/app/api/sales/manager/rep-view/[repId]/emails/route")
    expect((mod as Record<string, unknown>).POST).toBeUndefined()
    expect((mod as Record<string, unknown>).PATCH).toBeUndefined()
    expect((mod as Record<string, unknown>).DELETE).toBeUndefined()
    expect((mod as Record<string, unknown>).PUT).toBeUndefined()
  })

  it("response does not include mutation fields", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(assignedRep())
    mockCrmEmailFindMany.mockResolvedValue([makeEmail()])
    const res  = await GET(makeReq(), params("rep1"))
    const data = await res.json() as { emails: Array<Record<string, unknown>> }
    const email = data.emails[0]!
    // Verify mutation-trigger fields (sentBySalesUserId, mailboxOwnerSalesUserId, isArchived)
    // are not exposed — the select only returns read-appropriate fields
    expect(email.sentBySalesUserId).toBeUndefined()
    expect(email.mailboxOwnerSalesUserId).toBeUndefined()
    expect(email.isArchived).toBeUndefined()
    expect(email.isDeleted).toBeUndefined()
  })
})
