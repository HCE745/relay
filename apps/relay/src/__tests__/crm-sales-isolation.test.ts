/**
 * CRM sales-rep data isolation tests.
 *
 * Verifies that:
 * - sales_rep can only access their own assigned prospects
 * - stale JWT salesUserRole is ignored (getSalesSession re-validates from DB)
 * - admin_sales and super-admin see all non-demo prospects
 * - GET/PATCH /api/sales/companies/[id] enforces ownership
 * - GET /api/sales/activities enforces ownership
 * - GET /api/sales/workspace and /api/sales/emails scope to the rep's mailbox
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("server-only", () => ({}))

// Mock getSession so we can inject any session payload
vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}))

// Mock prisma — we control every return value in each test
vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesUser: { findUnique: vi.fn() },
    prospect:  { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    crmEmail:  { findMany: vi.fn() },
    crmTask:   { findMany: vi.fn() },
    crmOpportunity: { findMany: vi.fn() },
    demoCall:  { findMany: vi.fn() },
    salesCrmActivity: { findMany: vi.fn() },
    imapConfig: { findUnique: vi.fn() },
  },
}))

import { getSession } from "@/lib/session"
import { prisma }     from "@/lib/prisma"

const mockGetSession    = vi.mocked(getSession)
const mockSalesUser     = vi.mocked(prisma.salesUser.findUnique)
const mockProspectMany  = vi.mocked(prisma.prospect.findMany)
const mockProspectCount = vi.mocked(prisma.prospect.count)
const mockProspectOne   = vi.mocked(prisma.prospect.findUnique)
const mockEmailMany     = vi.mocked(prisma.crmEmail.findMany)
const mockTaskMany      = vi.mocked(prisma.crmTask.findMany)
const mockOppsMany      = vi.mocked(prisma.crmOpportunity.findMany)
const mockDemoMany      = vi.mocked(prisma.demoCall.findMany)
const mockActivities    = vi.mocked(prisma.salesCrmActivity.findMany)

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RACHEL_ID   = "rachel-sales-user-id"
const OTHER_ID    = "other-sales-user-id"
const SA_ID       = "super-admin-id"
const PROSPECT_A  = "prospect-rachel-id"
const PROSPECT_B  = "prospect-other-id"

function rachelSession() {
  return {
    userId: RACHEL_ID,
    email: "rachel@getrelay.software",
    name: "Rachel",
    role: "sales_rep",
    organizationId: "",
    salesUserId:   RACHEL_ID,
    salesUserRole: "sales_rep",   // correct current role
  }
}

function rachelSessionStaleJwt() {
  // JWT has stale admin_sales role, but DB says sales_rep
  return { ...rachelSession(), salesUserRole: "admin_sales" }
}

function adminSalesSession() {
  return {
    userId: OTHER_ID,
    email: "manager@getrelay.software",
    name: "Manager",
    role: "admin_sales",
    organizationId: "",
    salesUserId:   OTHER_ID,
    salesUserRole: "admin_sales",
  }
}

function superAdminSession() {
  return {
    userId: SA_ID,
    email: "will@getrelay.software",
    name: "Will",
    role: "SUPER_ADMIN",
    organizationId: "",
    superAdmin: true,
    superAdminId: SA_ID,
  }
}

function rachelDbUser() {
  return { isActive: true, role: "sales_rep", name: "Rachel", isDemo: false }
}

function adminSalesDbUser() {
  return { isActive: true, role: "admin_sales", name: "Manager", isDemo: false }
}

function makeReq(url = "http://localhost/api/test") {
  return new NextRequest(url)
}

// ─── /api/sales/companies ─────────────────────────────────────────────────────

describe("GET /api/sales/companies — prospect list ownership", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sales_rep sees only their own assigned prospects", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDbUser() as never)
    mockProspectMany.mockResolvedValue([])
    mockProspectCount.mockResolvedValue(0)

    const { GET } = await import("@/app/api/sales/companies/route")
    const res = await GET(makeReq("http://localhost/api/sales/companies"))
    expect(res.status).toBe(200)

    // Filter must scope to Rachel's id, never return all prospects
    const whereArg = mockProspectMany.mock.calls[0][0].where as Record<string, unknown>
    expect(whereArg).toMatchObject({ assignedToId: RACHEL_ID })
    expect(whereArg).not.toHaveProperty("NOT")
  })

  it("stale JWT with admin_sales is overridden by DB role sales_rep", async () => {
    // JWT claims admin_sales but DB says sales_rep — getSalesSession re-validates
    mockGetSession.mockResolvedValue(rachelSessionStaleJwt() as never)
    mockSalesUser.mockResolvedValue(rachelDbUser() as never)   // DB overrides
    mockProspectMany.mockResolvedValue([])
    mockProspectCount.mockResolvedValue(0)

    const { GET } = await import("@/app/api/sales/companies/route")
    const res = await GET(makeReq("http://localhost/api/sales/companies"))
    expect(res.status).toBe(200)

    // Must still use rep-level filter, not manager filter
    const whereArg = mockProspectMany.mock.calls[0][0].where as Record<string, unknown>
    expect(whereArg).toMatchObject({ assignedToId: RACHEL_ID })
    expect(whereArg).not.toHaveProperty("NOT")
  })

  it("admin_sales sees all non-demo prospects", async () => {
    mockGetSession.mockResolvedValue(adminSalesSession() as never)
    mockSalesUser.mockResolvedValue(adminSalesDbUser() as never)
    mockProspectMany.mockResolvedValue([])
    mockProspectCount.mockResolvedValue(0)

    const { GET } = await import("@/app/api/sales/companies/route")
    const res = await GET(makeReq("http://localhost/api/sales/companies"))
    expect(res.status).toBe(200)

    const whereArg = mockProspectMany.mock.calls[0][0].where as Record<string, unknown>
    expect(whereArg).toHaveProperty("NOT")
    expect(whereArg).not.toHaveProperty("assignedToId")
  })

  it("super-admin sees all non-demo prospects", async () => {
    mockGetSession.mockResolvedValue(superAdminSession() as never)
    mockProspectMany.mockResolvedValue([])
    mockProspectCount.mockResolvedValue(0)

    const { GET } = await import("@/app/api/sales/companies/route")
    const res = await GET(makeReq("http://localhost/api/sales/companies"))
    expect(res.status).toBe(200)

    const whereArg = mockProspectMany.mock.calls[0][0].where as Record<string, unknown>
    expect(whereArg).toHaveProperty("NOT")
    expect(whereArg).not.toHaveProperty("assignedToId")
  })

  it("unauthenticated request is rejected", async () => {
    mockGetSession.mockResolvedValue(null)
    const { GET } = await import("@/app/api/sales/companies/route")
    const res = await GET(makeReq("http://localhost/api/sales/companies"))
    expect(res.status).toBe(401)
  })
})

// ─── /api/sales/companies/[id] ────────────────────────────────────────────────

describe("GET /api/sales/companies/[id] — per-company ownership", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sales_rep can access their own assigned prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDbUser() as never)
    mockProspectOne.mockResolvedValue({
      id: PROSPECT_A, assignedToId: RACHEL_ID,
      contacts: [], notes: [], opportunities: [], demoCalls: [],
      salesActivities: [], tasks: [], emails: [],
    } as never)

    const { GET } = await import("@/app/api/sales/companies/[id]/route")
    const params = Promise.resolve({ id: PROSPECT_A })
    const res = await GET(makeReq(), { params })
    expect(res.status).toBe(200)
  })

  it("sales_rep cannot access a prospect assigned to someone else", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDbUser() as never)
    mockProspectOne.mockResolvedValue({
      id: PROSPECT_B, assignedToId: OTHER_ID,   // assigned to OTHER, not Rachel
      contacts: [], notes: [], opportunities: [], demoCalls: [],
      salesActivities: [], tasks: [], emails: [],
    } as never)

    const { GET } = await import("@/app/api/sales/companies/[id]/route")
    const params = Promise.resolve({ id: PROSPECT_B })
    const res = await GET(makeReq(), { params })
    expect(res.status).toBe(404)
  })

  it("sales_rep cannot access an unassigned (null) prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDbUser() as never)
    mockProspectOne.mockResolvedValue({
      id: "unassigned-prospect", assignedToId: null,
      contacts: [], notes: [], opportunities: [], demoCalls: [],
      salesActivities: [], tasks: [], emails: [],
    } as never)

    const { GET } = await import("@/app/api/sales/companies/[id]/route")
    const params = Promise.resolve({ id: "unassigned-prospect" })
    const res = await GET(makeReq(), { params })
    expect(res.status).toBe(404)
  })

  it("admin_sales can access any prospect", async () => {
    mockGetSession.mockResolvedValue(adminSalesSession() as never)
    mockSalesUser.mockResolvedValue(adminSalesDbUser() as never)
    mockProspectOne.mockResolvedValue({
      id: PROSPECT_A, assignedToId: RACHEL_ID,
      contacts: [], notes: [], opportunities: [], demoCalls: [],
      salesActivities: [], tasks: [], emails: [],
    } as never)

    const { GET } = await import("@/app/api/sales/companies/[id]/route")
    const params = Promise.resolve({ id: PROSPECT_A })
    const res = await GET(makeReq(), { params })
    expect(res.status).toBe(200)
  })

  it("super-admin can access any prospect including unassigned", async () => {
    mockGetSession.mockResolvedValue(superAdminSession() as never)
    mockProspectOne.mockResolvedValue({
      id: "unassigned-prospect", assignedToId: null,
      contacts: [], notes: [], opportunities: [], demoCalls: [],
      salesActivities: [], tasks: [], emails: [],
    } as never)

    const { GET } = await import("@/app/api/sales/companies/[id]/route")
    const params = Promise.resolve({ id: "unassigned-prospect" })
    const res = await GET(makeReq(), { params })
    expect(res.status).toBe(200)
  })
})

// ─── /api/sales/activities ────────────────────────────────────────────────────

describe("GET /api/sales/activities — activities ownership", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sales_rep can fetch activities for their own prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDbUser() as never)
    mockProspectOne.mockResolvedValue({ assignedToId: RACHEL_ID } as never)
    mockActivities.mockResolvedValue([])

    const { GET } = await import("@/app/api/sales/activities/route")
    const res = await GET(makeReq(`http://localhost/api/sales/activities?prospectId=${PROSPECT_A}`))
    expect(res.status).toBe(200)
  })

  it("sales_rep cannot fetch activities for another rep's prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDbUser() as never)
    mockProspectOne.mockResolvedValue({ assignedToId: OTHER_ID } as never)

    const { GET } = await import("@/app/api/sales/activities/route")
    const res = await GET(makeReq(`http://localhost/api/sales/activities?prospectId=${PROSPECT_B}`))
    expect(res.status).toBe(404)
  })

  it("admin_sales can fetch activities for any prospect", async () => {
    mockGetSession.mockResolvedValue(adminSalesSession() as never)
    mockSalesUser.mockResolvedValue(adminSalesDbUser() as never)
    mockActivities.mockResolvedValue([])

    const { GET } = await import("@/app/api/sales/activities/route")
    const res = await GET(makeReq(`http://localhost/api/sales/activities?prospectId=${PROSPECT_A}`))
    expect(res.status).toBe(200)
    // Should NOT query for prospect ownership when manager
    expect(mockProspectOne).not.toHaveBeenCalled()
  })
})

// ─── /api/sales/emails ────────────────────────────────────────────────────────

describe("GET /api/sales/emails — email scoping", () => {
  beforeEach(() => vi.clearAllMocks())

  it("sales_rep only sees emails attributed to their salesUserId", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDbUser() as never)
    mockEmailMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/sales/emails/route")
    const res = await GET(makeReq("http://localhost/api/sales/emails?all=true"))
    expect(res.status).toBe(200)

    const whereArg = mockEmailMany.mock.calls[0][0].where as Record<string, unknown>
    // Must have OR filter scoping to Rachel's id
    expect(whereArg).toHaveProperty("OR")
    const orFilter = whereArg.OR as Array<Record<string, unknown>>
    expect(orFilter.some(c => c.sentBySalesUserId === RACHEL_ID)).toBe(true)
    expect(orFilter.some(c => c.mailboxOwnerSalesUserId === RACHEL_ID)).toBe(true)
    // Must NOT have OR filter with null values (which would match Will's 925 emails)
    expect(orFilter.every(c => c.sentBySalesUserId !== null || c.mailboxOwnerSalesUserId !== null)).toBe(true)
  })

  it("emails with null ownership (Will's 925 historical emails) are excluded from rep view", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDbUser() as never)
    // Simulate DB returning nothing because all 925 emails have null owner IDs
    mockEmailMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/sales/emails/route")
    const res = await GET(makeReq("http://localhost/api/sales/emails?all=true"))
    expect(res.status).toBe(200)
    const body = await res.json() as { emails: unknown[] }
    expect(body.emails).toHaveLength(0)
  })

  it("stale admin_sales JWT does not give rep access to all emails", async () => {
    // JWT has stale admin_sales but DB re-validates to sales_rep
    mockGetSession.mockResolvedValue(rachelSessionStaleJwt() as never)
    mockSalesUser.mockResolvedValue(rachelDbUser() as never)
    mockEmailMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/sales/emails/route")
    const res = await GET(makeReq("http://localhost/api/sales/emails?all=true"))
    expect(res.status).toBe(200)

    // Must have ownership filter, not an empty where
    const whereArg = mockEmailMany.mock.calls[0][0].where as Record<string, unknown>
    expect(whereArg).toHaveProperty("OR")
  })

  it("super-admin gets all emails (no ownership filter)", async () => {
    mockGetSession.mockResolvedValue(superAdminSession() as never)
    mockEmailMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/sales/emails/route")
    const res = await GET(makeReq("http://localhost/api/sales/emails?all=true"))
    expect(res.status).toBe(200)

    // Super-admin path: where clause must NOT have OR with salesUserId scoping
    const whereArg = mockEmailMany.mock.calls[0][0].where as Record<string, unknown>
    expect(whereArg).not.toHaveProperty("OR")
  })
})

// ─── /api/sales/workspace — email section ─────────────────────────────────────

describe("GET /api/sales/workspace — unread email scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mocks for all the parallel queries
    mockTaskMany.mockResolvedValue([])
    mockEmailMany.mockResolvedValue([])
    mockOppsMany.mockResolvedValue([])
    mockDemoMany.mockResolvedValue([])
  })

  it("workspace unread emails are scoped to rep mailboxOwnerSalesUserId", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDbUser() as never)

    const { GET } = await import("@/app/api/sales/workspace/route")
    await GET()

    // Find the crmEmail.findMany call for unread emails (direction: "received", isRead: false)
    const unreadCall = mockEmailMany.mock.calls.find(
      call => (call[0].where as Record<string, unknown>).direction === "received"
    )
    expect(unreadCall).toBeDefined()
    const where = unreadCall![0].where as Record<string, unknown>
    expect(where).toHaveProperty("mailboxOwnerSalesUserId", RACHEL_ID)
  })

  it("stale admin_sales JWT: workspace email scoped to rep, not all emails", async () => {
    mockGetSession.mockResolvedValue(rachelSessionStaleJwt() as never)
    mockSalesUser.mockResolvedValue(rachelDbUser() as never)

    const { GET } = await import("@/app/api/sales/workspace/route")
    await GET()

    const unreadCall = mockEmailMany.mock.calls.find(
      call => (call[0].where as Record<string, unknown>).direction === "received"
    )
    expect(unreadCall).toBeDefined()
    const where = unreadCall![0].where as Record<string, unknown>
    // Must have mailboxOwnerSalesUserId filter, not be an empty object
    expect(where).toHaveProperty("mailboxOwnerSalesUserId", RACHEL_ID)
  })
})
