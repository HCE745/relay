/**
 * CRM secondary-route ownership tests.
 *
 * Covers the remaining routes fixed in the second security pass:
 * - GET /api/sales/follow-ups/due-count — stale JWT scoping
 * - POST /api/sales/companies/[id]/contacts — ownership on write
 * - PATCH/DELETE /api/sales/companies/[id]/contacts/[contactId] — ownership
 * - POST/DELETE /api/sales/companies/[id]/notes — ownership on write/delete
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesUser:       { findUnique: vi.fn() },
    prospect:        { findUnique: vi.fn() },
    prospectContact: { updateMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    prospectNote:    { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    crmEmail:        { count: vi.fn() },
    followUpStage:   { count: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  },
}))

import { getSession }  from "@/lib/session"
import { prisma }      from "@/lib/prisma"

const mockGetSession    = vi.mocked(getSession)
const mockSalesUser     = vi.mocked(prisma.salesUser.findUnique)
const mockProspectOne   = vi.mocked(prisma.prospect.findUnique)
const mockContactCreate = vi.mocked(prisma.prospectContact.create)
const mockContactUpdate = vi.mocked(prisma.prospectContact.update)
const mockContactDelete = vi.mocked(prisma.prospectContact.delete)
const mockNoteCreate    = vi.mocked(prisma.prospectNote.create)
const mockNoteFindOne   = vi.mocked(prisma.prospectNote.findUnique)
const mockNoteDelete    = vi.mocked(prisma.prospectNote.delete)
const mockEmailCount    = vi.mocked(prisma.crmEmail.count)

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const RACHEL_ID   = "rachel-sales-user-id"
const OTHER_ID    = "other-sales-user-id"
const PROSPECT_A  = "prospect-rachel-id"   // assigned to Rachel
const PROSPECT_B  = "prospect-other-id"    // assigned to OTHER
const CONTACT_ID  = "contact-123"
const NOTE_ID     = "note-456"

function rachelSession() {
  return {
    userId: RACHEL_ID, email: "rachel@test.com", name: "Rachel",
    role: "sales_rep", organizationId: "",
    salesUserId: RACHEL_ID, salesUserRole: "sales_rep",
  }
}

function rachelSessionStaleJwt() {
  return { ...rachelSession(), salesUserRole: "admin_sales" }
}

function adminSession() {
  return {
    userId: OTHER_ID, email: "mgr@test.com", name: "Manager",
    role: "admin_sales", organizationId: "",
    salesUserId: OTHER_ID, salesUserRole: "admin_sales",
  }
}

function superAdminSession() {
  return {
    userId: "sa-id", email: "will@test.com", name: "Will",
    role: "SUPER_ADMIN", organizationId: "",
    superAdmin: true, superAdminId: "sa-id",
  }
}

function rachelDb()  { return { isActive: true, role: "sales_rep",  name: "Rachel",  isDemo: false } }
function adminDb()   { return { isActive: true, role: "admin_sales", name: "Manager", isDemo: false } }
function rachelProspect() { return { id: PROSPECT_A, assignedToId: RACHEL_ID } }
function otherProspect()  { return { id: PROSPECT_B, assignedToId: OTHER_ID } }

function makeReq(url: string, body?: unknown) {
  return new NextRequest(url, body
    ? { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }
    : undefined
  )
}

function makeJsonReq(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

// ─── GET /api/sales/follow-ups/due-count ──────────────────────────────────────

describe("GET /api/sales/follow-ups/due-count — stale JWT scoping", () => {
  beforeEach(() => { vi.clearAllMocks(); mockEmailCount.mockResolvedValue(3) })

  it("sales_rep only counts their own follow-ups", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)

    const { GET } = await import("@/app/api/sales/follow-ups/due-count/route")
    const res = await GET()
    expect(res.status).toBe(200)

    const whereArg = mockEmailCount.mock.calls[0][0].where as Record<string, unknown>
    expect(whereArg).toMatchObject({ sentBySalesUserId: RACHEL_ID })
  })

  it("stale admin_sales JWT does not remove ownership filter", async () => {
    mockGetSession.mockResolvedValue(rachelSessionStaleJwt() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)   // DB overrides to sales_rep

    const { GET } = await import("@/app/api/sales/follow-ups/due-count/route")
    await GET()

    const whereArg = mockEmailCount.mock.calls[0][0].where as Record<string, unknown>
    expect(whereArg).toMatchObject({ sentBySalesUserId: RACHEL_ID })
    expect(whereArg).not.toMatchObject({ sentBySalesUserId: undefined })
  })

  it("admin_sales sees all follow-ups (no sentBySalesUserId filter)", async () => {
    mockGetSession.mockResolvedValue(adminSession() as never)
    mockSalesUser.mockResolvedValue(adminDb() as never)

    const { GET } = await import("@/app/api/sales/follow-ups/due-count/route")
    await GET()

    const whereArg = mockEmailCount.mock.calls[0][0].where as Record<string, unknown>
    expect(whereArg).not.toHaveProperty("sentBySalesUserId")
  })

  it("unauthenticated request is rejected", async () => {
    mockGetSession.mockResolvedValue(null)
    const { GET } = await import("@/app/api/sales/follow-ups/due-count/route")
    const res = await GET()
    expect(res.status).toBe(401)
  })
})

// ─── POST /api/sales/companies/[id]/contacts ──────────────────────────────────

describe("POST /api/sales/companies/[id]/contacts — ownership on create", () => {
  beforeEach(() => { vi.clearAllMocks(); mockContactCreate.mockResolvedValue({ id: "new-contact" } as never) })

  it("rep can add a contact to their own prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)
    mockProspectOne.mockResolvedValue(rachelProspect() as never)

    const { POST } = await import("@/app/api/sales/companies/[id]/contacts/route")
    const req = makeJsonReq("http://localhost/", "POST", { name: "Jane Smith" })
    const res = await POST(req, { params: Promise.resolve({ id: PROSPECT_A }) })
    expect(res.status).toBe(201)
    expect(mockContactCreate).toHaveBeenCalledOnce()
  })

  it("rep cannot add a contact to another rep's prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)
    mockProspectOne.mockResolvedValue(otherProspect() as never)  // assigned to OTHER

    const { POST } = await import("@/app/api/sales/companies/[id]/contacts/route")
    const req = makeJsonReq("http://localhost/", "POST", { name: "Jane Smith" })
    const res = await POST(req, { params: Promise.resolve({ id: PROSPECT_B }) })
    expect(res.status).toBe(404)
    expect(mockContactCreate).not.toHaveBeenCalled()
  })

  it("rep cannot add a contact to an unassigned (null) prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)
    mockProspectOne.mockResolvedValue({ id: "unassigned", assignedToId: null } as never)

    const { POST } = await import("@/app/api/sales/companies/[id]/contacts/route")
    const req = makeJsonReq("http://localhost/", "POST", { name: "Jane Smith" })
    const res = await POST(req, { params: Promise.resolve({ id: "unassigned" }) })
    expect(res.status).toBe(404)
    expect(mockContactCreate).not.toHaveBeenCalled()
  })

  it("admin_sales can add a contact to any prospect without ownership check", async () => {
    mockGetSession.mockResolvedValue(adminSession() as never)
    mockSalesUser.mockResolvedValue(adminDb() as never)

    const { POST } = await import("@/app/api/sales/companies/[id]/contacts/route")
    const req = makeJsonReq("http://localhost/", "POST", { name: "Jane Smith" })
    const res = await POST(req, { params: Promise.resolve({ id: PROSPECT_A }) })
    expect(res.status).toBe(201)
    // Admin path must NOT query for prospect ownership
    expect(mockProspectOne).not.toHaveBeenCalled()
  })
})

// ─── PATCH/DELETE /api/sales/companies/[id]/contacts/[contactId] ──────────────

describe("PATCH /api/sales/companies/[id]/contacts/[contactId] — ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockContactUpdate.mockResolvedValue({ id: CONTACT_ID } as never)
    vi.mocked(prisma.prospectContact.updateMany).mockResolvedValue({ count: 0 } as never)
  })

  it("rep can edit a contact on their own prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)
    mockProspectOne.mockResolvedValue(rachelProspect() as never)

    const { PATCH } = await import("@/app/api/sales/companies/[id]/contacts/[contactId]/route")
    const req = makeJsonReq("http://localhost/", "PATCH", { title: "VP Sales" })
    const res = await PATCH(req, { params: Promise.resolve({ id: PROSPECT_A, contactId: CONTACT_ID }) })
    expect(res.status).toBe(200)
  })

  it("rep cannot edit a contact on another rep's prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)
    mockProspectOne.mockResolvedValue(otherProspect() as never)

    const { PATCH } = await import("@/app/api/sales/companies/[id]/contacts/[contactId]/route")
    const req = makeJsonReq("http://localhost/", "PATCH", { title: "VP Sales" })
    const res = await PATCH(req, { params: Promise.resolve({ id: PROSPECT_B, contactId: CONTACT_ID }) })
    expect(res.status).toBe(404)
    expect(mockContactUpdate).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/sales/companies/[id]/contacts/[contactId] — ownership", () => {
  beforeEach(() => { vi.clearAllMocks(); mockContactDelete.mockResolvedValue({} as never) })

  it("rep can delete a contact on their own prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)
    mockProspectOne.mockResolvedValue(rachelProspect() as never)

    const { DELETE } = await import("@/app/api/sales/companies/[id]/contacts/[contactId]/route")
    const req = new NextRequest("http://localhost/", { method: "DELETE" })
    const res = await DELETE(req, { params: Promise.resolve({ id: PROSPECT_A, contactId: CONTACT_ID }) })
    expect(res.status).toBe(200)
    expect(mockContactDelete).toHaveBeenCalledWith({ where: { id: CONTACT_ID } })
  })

  it("rep cannot delete a contact on another rep's prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)
    mockProspectOne.mockResolvedValue(otherProspect() as never)

    const { DELETE } = await import("@/app/api/sales/companies/[id]/contacts/[contactId]/route")
    const req = new NextRequest("http://localhost/", { method: "DELETE" })
    const res = await DELETE(req, { params: Promise.resolve({ id: PROSPECT_B, contactId: CONTACT_ID }) })
    expect(res.status).toBe(404)
    expect(mockContactDelete).not.toHaveBeenCalled()
  })

  it("super-admin can delete any contact", async () => {
    mockGetSession.mockResolvedValue(superAdminSession() as never)

    const { DELETE } = await import("@/app/api/sales/companies/[id]/contacts/[contactId]/route")
    const req = new NextRequest("http://localhost/", { method: "DELETE" })
    const res = await DELETE(req, { params: Promise.resolve({ id: PROSPECT_A, contactId: CONTACT_ID }) })
    expect(res.status).toBe(200)
    expect(mockProspectOne).not.toHaveBeenCalled()
  })
})

// ─── POST /api/sales/companies/[id]/notes ─────────────────────────────────────

describe("POST /api/sales/companies/[id]/notes — ownership on create", () => {
  beforeEach(() => { vi.clearAllMocks(); mockNoteCreate.mockResolvedValue({ id: NOTE_ID } as never) })

  it("rep can add a note to their own prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)
    mockProspectOne.mockResolvedValue(rachelProspect() as never)

    const { POST } = await import("@/app/api/sales/companies/[id]/notes/route")
    const req = makeJsonReq("http://localhost/", "POST", { noteText: "Called and left voicemail" })
    const res = await POST(req, { params: Promise.resolve({ id: PROSPECT_A }) })
    expect(res.status).toBe(201)
    expect(mockNoteCreate).toHaveBeenCalledOnce()
  })

  it("rep cannot add a note to another rep's prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)
    mockProspectOne.mockResolvedValue(otherProspect() as never)

    const { POST } = await import("@/app/api/sales/companies/[id]/notes/route")
    const req = makeJsonReq("http://localhost/", "POST", { noteText: "Hacked note" })
    const res = await POST(req, { params: Promise.resolve({ id: PROSPECT_B }) })
    expect(res.status).toBe(404)
    expect(mockNoteCreate).not.toHaveBeenCalled()
  })

  it("rep cannot add a note to a prospect that doesn't exist", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)
    mockProspectOne.mockResolvedValue(null)  // not found

    const { POST } = await import("@/app/api/sales/companies/[id]/notes/route")
    const req = makeJsonReq("http://localhost/", "POST", { noteText: "Some note" })
    const res = await POST(req, { params: Promise.resolve({ id: "nonexistent" }) })
    expect(res.status).toBe(404)
  })

  it("admin_sales can add a note to any prospect", async () => {
    mockGetSession.mockResolvedValue(adminSession() as never)
    mockSalesUser.mockResolvedValue(adminDb() as never)
    mockProspectOne.mockResolvedValue(rachelProspect() as never)

    const { POST } = await import("@/app/api/sales/companies/[id]/notes/route")
    const req = makeJsonReq("http://localhost/", "POST", { noteText: "Manager note" })
    const res = await POST(req, { params: Promise.resolve({ id: PROSPECT_A }) })
    expect(res.status).toBe(201)
  })
})

// ─── DELETE /api/sales/companies/[id]/notes ───────────────────────────────────

describe("DELETE /api/sales/companies/[id]/notes — ownership on delete", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNoteDelete.mockResolvedValue({} as never)
    mockNoteFindOne.mockResolvedValue({ prospectId: PROSPECT_A } as never)
  })

  it("rep can delete a note on their own prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)
    mockProspectOne.mockResolvedValue(rachelProspect() as never)

    const { DELETE } = await import("@/app/api/sales/companies/[id]/notes/route")
    const req = makeJsonReq("http://localhost/", "DELETE", { noteId: NOTE_ID })
    const res = await DELETE(req, { params: Promise.resolve({ id: PROSPECT_A }) })
    expect(res.status).toBe(200)
    expect(mockNoteDelete).toHaveBeenCalledWith({ where: { id: NOTE_ID } })
  })

  it("rep cannot delete a note on another rep's prospect", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)
    // Note exists on PROSPECT_B; prospect is owned by OTHER
    mockNoteFindOne.mockResolvedValue({ prospectId: PROSPECT_B } as never)
    mockProspectOne.mockResolvedValue(otherProspect() as never)

    const { DELETE } = await import("@/app/api/sales/companies/[id]/notes/route")
    const req = makeJsonReq("http://localhost/", "DELETE", { noteId: NOTE_ID })
    const res = await DELETE(req, { params: Promise.resolve({ id: PROSPECT_B }) })
    expect(res.status).toBe(404)
    expect(mockNoteDelete).not.toHaveBeenCalled()
  })

  it("note with wrong prospectId is rejected (note integrity check)", async () => {
    mockGetSession.mockResolvedValue(rachelSession() as never)
    mockSalesUser.mockResolvedValue(rachelDb() as never)
    // Note exists but on a different prospect than the URL param
    mockNoteFindOne.mockResolvedValue({ prospectId: "some-other-prospect" } as never)

    const { DELETE } = await import("@/app/api/sales/companies/[id]/notes/route")
    const req = makeJsonReq("http://localhost/", "DELETE", { noteId: NOTE_ID })
    const res = await DELETE(req, { params: Promise.resolve({ id: PROSPECT_A }) })
    expect(res.status).toBe(404)
    expect(mockNoteDelete).not.toHaveBeenCalled()
  })

  it("admin_sales can delete any note", async () => {
    mockGetSession.mockResolvedValue(adminSession() as never)
    mockSalesUser.mockResolvedValue(adminDb() as never)
    mockNoteFindOne.mockResolvedValue({ prospectId: PROSPECT_A } as never)

    const { DELETE } = await import("@/app/api/sales/companies/[id]/notes/route")
    const req = makeJsonReq("http://localhost/", "DELETE", { noteId: NOTE_ID })
    const res = await DELETE(req, { params: Promise.resolve({ id: PROSPECT_A }) })
    expect(res.status).toBe(200)
    expect(mockNoteDelete).toHaveBeenCalledOnce()
    expect(mockProspectOne).not.toHaveBeenCalled()
  })
})
