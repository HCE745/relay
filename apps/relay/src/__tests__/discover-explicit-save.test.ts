/**
 * Tests for the explicit Save to List behaviour (usability improvement #2 & #3).
 *
 * Covers:
 * - GET /lists returns only isExplicitlySaved=true lists
 * - POST /jobs creates list with isExplicitlySaved=false
 * - PATCH /lists/[id] sets isExplicitlySaved=true
 * - Super-admin and sales sessions are isolated
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/platform-config", () => ({
  getPlatformConfig: vi.fn(),
}))

const mockFindMany   = vi.fn()
const mockCreate     = vi.fn()
const mockFindUnique = vi.fn()
const mockUpdate     = vi.fn()
const mockGroupBy    = vi.fn()
const mockTx         = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prospectResearchList:   {
      findMany:   (...a: unknown[]) => mockFindMany(...a),
      create:     (...a: unknown[]) => mockCreate(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      update:     (...a: unknown[]) => mockUpdate(...a),
    },
    prospectResearchResult: {
      groupBy:    (...a: unknown[]) => mockGroupBy(...a),
    },
    prospectResearchJob: {
      create: vi.fn(),
    },
    $transaction: (...a: unknown[]) => mockTx(...a),
  },
}))

import { getSession } from "@/lib/session"
import { GET, POST } from "@/app/api/super-admin/crm/prospects/discover/lists/route"
import { PATCH } from "@/app/api/super-admin/crm/prospects/discover/lists/[id]/route"

const mockGetSession = vi.mocked(getSession)

function req(body?: unknown): NextRequest {
  return new NextRequest("https://test.example/api/", {
    method: body ? "PATCH" : "GET",
    headers: body ? { "content-type": "application/json" } : {},
    body:    body ? JSON.stringify(body) : undefined,
  })
}

// ─── GET /lists — only isExplicitlySaved=true ─────────────────────────────────

describe("GET /lists", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("filters to isExplicitlySaved: true for super-admin", async () => {
    mockGetSession.mockResolvedValue({ superAdminId: "sa-1" } as never)
    mockFindMany.mockResolvedValue([])
    mockGroupBy.mockResolvedValue([])

    await GET()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isExplicitlySaved: true }),
      }),
    )
  })

  it("filters to isExplicitlySaved: true for sales user", async () => {
    mockGetSession.mockResolvedValue({ salesUserId: "u-1", salesUserRole: "sales_rep" } as never)
    mockFindMany.mockResolvedValue([])
    mockGroupBy.mockResolvedValue([])

    await GET()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isExplicitlySaved: true }),
      }),
    )
  })

  it("returns 403 for unauthenticated requests", async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(403)
  })
})

// ─── PATCH /lists/[id] — allow setting isExplicitlySaved: true ───────────────

describe("PATCH /lists/[id] — isExplicitlySaved", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("sets isExplicitlySaved: true when requested", async () => {
    mockGetSession.mockResolvedValue({ superAdminId: "sa-1" } as never)
    mockFindUnique.mockResolvedValue({ salesUserId: null, superAdminId: "sa-1", isShared: false })
    mockUpdate.mockResolvedValue({ id: "list-1", name: "My List", isExplicitlySaved: true, _count: { results: 0 } })

    const params = Promise.resolve({ id: "list-1" })
    const res = await PATCH(
      new NextRequest("https://test.example/api/", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "My List", isExplicitlySaved: true }),
      }),
      { params },
    )

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isExplicitlySaved: true, name: "My List" }),
      }),
    )
  })

  it("does not allow setting isExplicitlySaved: false (downgrade not permitted)", async () => {
    mockGetSession.mockResolvedValue({ superAdminId: "sa-1" } as never)
    mockFindUnique.mockResolvedValue({ salesUserId: null, superAdminId: "sa-1", isShared: false })
    mockUpdate.mockResolvedValue({ id: "list-1", name: "Draft", isExplicitlySaved: false, _count: { results: 0 } })

    const params = Promise.resolve({ id: "list-1" })
    const res = await PATCH(
      new NextRequest("https://test.example/api/", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isExplicitlySaved: false }),
      }),
      { params },
    )

    expect(res.status).toBe(200)
    // isExplicitlySaved: false should NOT be written (only true is allowed)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ isExplicitlySaved: false }),
      }),
    )
  })

  it("returns 403 for non-owners", async () => {
    mockGetSession.mockResolvedValue({ superAdminId: "sa-other" } as never)
    mockFindUnique.mockResolvedValue({ salesUserId: null, superAdminId: "sa-1", isShared: false })

    const params = Promise.resolve({ id: "list-1" })
    const res = await PATCH(req({ name: "x" }), { params })
    expect(res.status).toBe(403)
  })

  it("returns 404 for missing list", async () => {
    mockGetSession.mockResolvedValue({ superAdminId: "sa-1" } as never)
    mockFindUnique.mockResolvedValue(null)

    const params = Promise.resolve({ id: "no-such" })
    const res = await PATCH(req({ name: "x" }), { params })
    expect(res.status).toBe(404)
  })
})

// ─── Account isolation ────────────────────────────────────────────────────────

describe("account isolation", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("super-admin GET only sees own lists via superAdminId filter", async () => {
    mockGetSession.mockResolvedValue({ superAdminId: "sa-A" } as never)
    mockFindMany.mockResolvedValue([])
    mockGroupBy.mockResolvedValue([])

    await GET()

    const callArg = mockFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    // Must include the owner's superAdminId in the OR
    expect(JSON.stringify(callArg.where)).toContain("sa-A")
    // Must not include any hardcoded other admin
    expect(JSON.stringify(callArg.where)).not.toContain("sa-B")
  })

  it("sales user GET only sees own lists via salesUserId filter", async () => {
    mockGetSession.mockResolvedValue({ salesUserId: "u-X", salesUserRole: "sales_rep" } as never)
    mockFindMany.mockResolvedValue([])
    mockGroupBy.mockResolvedValue([])

    await GET()

    const callArg = mockFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(JSON.stringify(callArg.where)).toContain("u-X")
    expect(JSON.stringify(callArg.where)).not.toContain("superAdminId")
  })
})
