/**
 * Tests for Sales Manager Rep View — Stage D (Read-Only Email Visibility).
 *
 * Covers:
 * - GET /api/sales/manager/rep-view/[repId]/emails: auth, rep scoping, CRM filtering, read-only
 * - 403 for unauthenticated, rep caller, cross-manager
 * - 200 for assigned manager, super-admin
 * - Two-step query: thread-id collection + CRM-restricted email fetch
 * - Outbound always included; inbound only if CRM-associated
 * - Unrelated mailbox-only inbound messages excluded
 * - Direction and date filters forwarded to email query
 * - No write endpoints (POST/PATCH/DELETE absent)
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }))

const mockSalesUserFindUnique = vi.fn()
const mockCrmEmailFindMany    = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesUser: { findUnique: (...a: unknown[]) => mockSalesUserFindUnique(...a) },
    crmEmail:  { findMany: (...a: unknown[]) => mockCrmEmailFindMany(...a) },
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

function makeEmail(overrides: Record<string, unknown> = {}) {
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
    threadId:       "thread1",
    sentAt:         new Date(),
    source:         "compose",
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
  // Default: first findMany (threadId collection) returns empty; second returns []
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

  it("returns 200 with emails for assigned manager", async () => {
    vi.mocked(getSession).mockResolvedValue(managerSession() as never)
    mockSalesUserFindUnique
      .mockResolvedValueOnce(managerRecord())
      .mockResolvedValueOnce(assignedRep())
    // first call: threadId collection; second call: email fetch
    mockCrmEmailFindMany
      .mockResolvedValueOnce([{ threadId: "thread1", id: "e-sent1" }])
      .mockResolvedValueOnce([makeEmail()])
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

// ─── Two-step query structure ─────────────────────────────────────────────────

describe("two-step CRM query", () => {
  async function authorizedGet(repId: string, search = "") {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue({ ...assignedRep(), id: repId })
    mockCrmEmailFindMany
      .mockResolvedValueOnce([{ threadId: "thread1", id: "sent1" }]) // step 1
      .mockResolvedValueOnce([])                                      // step 2
    await GET(makeReq(search), params(repId))
    return {
      threadCall: mockCrmEmailFindMany.mock.calls[0]![0] as { where: Record<string, unknown> },
      emailCall:  mockCrmEmailFindMany.mock.calls[1]![0] as { where: Record<string, unknown> },
    }
  }

  it("step 1 collects outbound threadIds for this rep", async () => {
    const { threadCall } = await authorizedGet("rep77")
    const where = threadCall.where as { sentBySalesUserId: string; isDeleted: boolean }
    expect(where.sentBySalesUserId).toBe("rep77")
    expect(where.isDeleted).toBe(false)
  })

  it("step 2 email query includes sentBySalesUserId outbound condition", async () => {
    const { emailCall } = await authorizedGet("rep77")
    const orClauses = (emailCall.where as { OR: Array<Record<string, unknown>> }).OR
    const outboundClause = orClauses.find(c => "sentBySalesUserId" in c)
    expect(outboundClause).toEqual({ sentBySalesUserId: "rep77" })
  })

  it("step 2 inbound condition restricts to CRM-associated messages", async () => {
    const { emailCall } = await authorizedGet("rep77")
    const orClauses = (emailCall.where as { OR: Array<Record<string, unknown>> }).OR
    const inboundClause = orClauses.find(c => "mailboxOwnerSalesUserId" in c) as {
      mailboxOwnerSalesUserId: string
      direction: string
      OR: Array<Record<string, unknown>>
    }
    expect(inboundClause).toBeDefined()
    expect(inboundClause.mailboxOwnerSalesUserId).toBe("rep77")
    expect(inboundClause.direction).toBe("received")
    // Verifies CRM-association clauses are present
    const inboundOr = inboundClause.OR
    expect(inboundOr).toEqual(expect.arrayContaining([
      { prospectId: { not: null } },
      { contactId:  { not: null } },
      { source:     "inbound_webhook" },
      { threadId:   { in: ["thread1"] } }, // from step 1
    ]))
  })

  it("includes take:500 limit on email fetch", async () => {
    const { emailCall } = await authorizedGet("rep77")
    expect((emailCall as unknown as { take: number }).take).toBe(500)
  })

  it("passes direction filter to email fetch only", async () => {
    const { emailCall } = await authorizedGet("rep77", "?direction=sent")
    expect((emailCall.where as { direction?: string }).direction).toBe("sent")
  })

  it("passes date filters to email fetch only", async () => {
    const { emailCall } = await authorizedGet("rep77", "?startDate=2026-01-01&endDate=2026-11-01")
    const sentAt = (emailCall.where as { sentAt?: { gte?: Date; lte?: Date } }).sentAt
    expect(sentAt?.gte).toBeInstanceOf(Date)
    expect(sentAt?.lte).toBeInstanceOf(Date)
  })

  it("omits threadId clause when rep has no outbound emails", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(assignedRep())
    mockCrmEmailFindMany
      .mockResolvedValueOnce([])  // step 1: no sent emails
      .mockResolvedValueOnce([])  // step 2
    await GET(makeReq(), params("rep1"))
    const emailCall = mockCrmEmailFindMany.mock.calls[1]![0] as { where: Record<string, unknown> }
    const orClauses = (emailCall.where as { OR: Array<Record<string, unknown>> }).OR
    const inboundClause = orClauses.find(c => "mailboxOwnerSalesUserId" in c) as {
      OR: Array<Record<string, unknown>>
    }
    const hasThreadIdClause = inboundClause.OR.some(c => "threadId" in c)
    expect(hasThreadIdClause).toBe(false)
  })
})

// ─── CRM association filtering ────────────────────────────────────────────────

describe("CRM-associated inbound filter", () => {
  it("outbound emails are always included via sentBySalesUserId", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(assignedRep())
    mockCrmEmailFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeEmail({ direction: "sent", sentBySalesUserId: "rep1" })])
    const res  = await GET(makeReq(), params("rep1"))
    const data = await res.json() as { emails: unknown[] }
    expect(data.emails).toHaveLength(1)
  })

  it("inbound email with prospectId is included", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(assignedRep())
    // The route queries the DB; we verify the filter shape, not live exclusion
    mockCrmEmailFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeEmail({ direction: "received", prospectId: "p1" })])
    const res  = await GET(makeReq(), params("rep1"))
    const data = await res.json() as { emails: unknown[] }
    expect(data.emails).toHaveLength(1)
  })

  it("inbound email query does NOT use bare demoCallId as CRM filter", async () => {
    // demoCallId IS NOT NULL on received emails is unreliable: IMAP sync auto-creates
    // a DemoCall for every inbound message. The filter must NOT rely on it.
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(assignedRep())
    mockCrmEmailFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    await GET(makeReq(), params("rep1"))
    const emailCall = mockCrmEmailFindMany.mock.calls[1]![0] as { where: Record<string, unknown> }
    const orClauses = (emailCall.where as { OR: Array<Record<string, unknown>> }).OR
    const inboundClause = orClauses.find(c => "mailboxOwnerSalesUserId" in c) as {
      OR?: Array<Record<string, unknown>>
    } | undefined
    // Verify no bare demoCallId filter appears in the inbound OR clauses
    const inboundOr = inboundClause?.OR ?? []
    const hasBadFilter = inboundOr.some(c => JSON.stringify(c).includes('"demoCallId"') && !JSON.stringify(c).includes('"threadId"'))
    expect(hasBadFilter).toBe(false)
  })

  it("isDeleted: false is enforced on both queries", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(assignedRep())
    mockCrmEmailFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    await GET(makeReq(), params("rep1"))
    // Step 1 (threadId collection)
    const threadWhere = mockCrmEmailFindMany.mock.calls[0]![0] as { where: { isDeleted: boolean } }
    expect(threadWhere.where.isDeleted).toBe(false)
    // Step 2 (email fetch)
    const emailWhere = mockCrmEmailFindMany.mock.calls[1]![0] as { where: { isDeleted: boolean } }
    expect(emailWhere.where.isDeleted).toBe(false)
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

  it("response does not expose mutation-only fields", async () => {
    vi.mocked(getSession).mockResolvedValue(saSession() as never)
    mockSalesUserFindUnique.mockResolvedValue(assignedRep())
    mockCrmEmailFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeEmail()])
    const res   = await GET(makeReq(), params("rep1"))
    const data  = await res.json() as { emails: Array<Record<string, unknown>> }
    const email = data.emails[0]!
    expect(email.sentBySalesUserId).toBeUndefined()
    expect(email.mailboxOwnerSalesUserId).toBeUndefined()
    expect(email.isArchived).toBeUndefined()
    expect(email.isDeleted).toBeUndefined()
  })
})
