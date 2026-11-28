/**
 * Phase 2 tests: employee credential management
 *
 * Covers:
 * GET  /api/team/[id]/credentials         — 401, 403, 404, returns credential state
 * PATCH /api/team/[id]/credentials        — 401, 403, sets employee ID, returns 409 on collision
 * POST /api/team/[id]/credentials/generate — 401, 403, generates ACCESS_CODE
 * GET  /api/team/[id]/badges              — 401, returns badges
 * POST /api/team/[id]/badges              — adds third-party badge, 409 on collision
 * DELETE /api/team/[id]/badges/[badgeId]  — 401, 404, revokes badge
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

process.env.SESSION_SECRET         = "test-session-secret-32-chars-xx"
process.env.CREDENTIAL_HMAC_SECRET = "test-hmac-secret-32-chars-xxxxxx"

vi.mock("server-only", () => ({}))

vi.mock("bcryptjs", () => ({
  hash:    vi.fn().mockResolvedValue("hashed-code"),
  compare: vi.fn().mockResolvedValue(true),
}))

const mockSessionFn = vi.fn()
vi.mock("@/lib/session", () => ({ getSession: (...a: unknown[]) => mockSessionFn(...a) }))

const mockUserFindFirst = vi.fn()
const mockEmpCredUpsert = vi.fn()
const mockEmpCredFindUnique = vi.fn()
const mockBadgeFindFirst = vi.fn()
const mockBadgeFindMany  = vi.fn()
const mockBadgeCreate    = vi.fn()
const mockBadgeUpdate    = vi.fn()
const mockSingleLookupCreate = vi.fn()
const mockSingleLookupDeleteMany = vi.fn()
const mockTxFn = vi.fn()
const mockUserUpdate = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst:  (...a: unknown[]) => mockUserFindFirst(...a),
      update:     (...a: unknown[]) => mockUserUpdate(...a),
    },
    employeeCredential: {
      upsert:     (...a: unknown[]) => mockEmpCredUpsert(...a),
      findUnique: (...a: unknown[]) => mockEmpCredFindUnique(...a),
    },
    employeeBadge: {
      findFirst: (...a: unknown[]) => mockBadgeFindFirst(...a),
      findMany:  (...a: unknown[]) => mockBadgeFindMany(...a),
      create:    (...a: unknown[]) => mockBadgeCreate(...a),
      update:    (...a: unknown[]) => mockBadgeUpdate(...a),
    },
    singleCodeLookup: {
      create:     (...a: unknown[]) => mockSingleLookupCreate(...a),
      deleteMany: (...a: unknown[]) => mockSingleLookupDeleteMany(...a),
    },
    $transaction: (...a: unknown[]) => mockTxFn(...a),
  },
}))

const ADMIN_SESSION = {
  userId: "u-admin", email: "admin@acme.com", name: "Admin", role: "ADMIN",
  organizationId: "org-1",
}

const TARGET_USER = {
  id: "u-emp", role: "EMPLOYEE", employeeId: null,
  employeeCredential: null,
  employeeBadges: [],
}

function makeReq(url: string, method = "GET", body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  })
}

function makeParams(params: Record<string, string>) {
  return { params: Promise.resolve(params) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSessionFn.mockResolvedValue(ADMIN_SESSION)
  mockUserFindFirst.mockResolvedValue(TARGET_USER)
  mockBadgeFindFirst.mockResolvedValue(null)
  mockBadgeFindMany.mockResolvedValue([])
  mockBadgeCreate.mockResolvedValue({ id: "badge-1", badgeType: "THIRD_PARTY", maskedDisplay: "***", isActive: true, createdAt: new Date() })
  mockBadgeUpdate.mockResolvedValue({})
  mockSingleLookupCreate.mockResolvedValue({})
  mockSingleLookupDeleteMany.mockResolvedValue({ count: 0 })
  mockEmpCredUpsert.mockResolvedValue({})
  // $transaction runs the callback
  mockTxFn.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const fakeTx = {
      user: { update: (...a: unknown[]) => mockUserUpdate(...a) },
      employeeCredential: { upsert: (...a: unknown[]) => mockEmpCredUpsert(...a) },
      singleCodeLookup: {
        create:     (...a: unknown[]) => mockSingleLookupCreate(...a),
        deleteMany: (...a: unknown[]) => mockSingleLookupDeleteMany(...a),
      },
    }
    return fn(fakeTx)
  })
})

// ── GET /api/team/[id]/credentials ────────────────────────────────────────────

describe("GET /api/team/[id]/credentials", () => {
  it("returns 401 without session", async () => {
    const { GET } = await import("@/app/api/team/[id]/credentials/route")
    mockSessionFn.mockResolvedValue(null)
    const res = await GET(makeReq("http://localhost/api/team/u-emp/credentials"), makeParams({ id: "u-emp" }))
    expect(res.status).toBe(401)
  })

  it("returns 404 when user not in org", async () => {
    const { GET } = await import("@/app/api/team/[id]/credentials/route")
    mockUserFindFirst.mockResolvedValue(null)
    const res = await GET(makeReq("http://localhost/api/team/u-emp/credentials"), makeParams({ id: "u-emp" }))
    expect(res.status).toBe(404)
  })

  it("returns credential state for user with no credentials", async () => {
    const { GET } = await import("@/app/api/team/[id]/credentials/route")
    const res = await GET(makeReq("http://localhost/api/team/u-emp/credentials"), makeParams({ id: "u-emp" }))
    expect(res.status).toBe(200)
    const body = await res.json() as { employeeId: null; credential: { employeeIdEnabled: boolean } }
    expect(body.employeeId).toBeNull()
    expect(body.credential.employeeIdEnabled).toBe(false)
  })
})

// ── PATCH /api/team/[id]/credentials ─────────────────────────────────────────

describe("PATCH /api/team/[id]/credentials", () => {
  it("returns 401 without session", async () => {
    const { PATCH } = await import("@/app/api/team/[id]/credentials/route")
    mockSessionFn.mockResolvedValue(null)
    const res = await PATCH(
      makeReq("http://localhost/api/team/u-emp/credentials", "PATCH", { employeeId: "EMP-001" }),
      makeParams({ id: "u-emp" }),
    )
    expect(res.status).toBe(401)
  })

  it("HR cannot manage ADMIN", async () => {
    const { PATCH } = await import("@/app/api/team/[id]/credentials/route")
    mockSessionFn.mockResolvedValue({ ...ADMIN_SESSION, role: "HR" })
    mockUserFindFirst.mockResolvedValue({ ...TARGET_USER, role: "ADMIN" })
    const res = await PATCH(
      makeReq("http://localhost/api/team/u-emp/credentials", "PATCH", { employeeId: "EMP-001" }),
      makeParams({ id: "u-emp" }),
    )
    expect(res.status).toBe(403)
  })

  it("ADMIN can set employee ID", async () => {
    const { PATCH } = await import("@/app/api/team/[id]/credentials/route")
    const res = await PATCH(
      makeReq("http://localhost/api/team/u-emp/credentials", "PATCH", { employeeId: "EMP-001" }),
      makeParams({ id: "u-emp" }),
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
    expect(mockTxFn).toHaveBeenCalled()
  })

  it("returns 409 on SingleCodeLookup collision", async () => {
    const { PATCH } = await import("@/app/api/team/[id]/credentials/route")
    mockTxFn.mockRejectedValueOnce(new Error("Unique constraint failed on the fields: (`organizationId`,`credentialIndex`)"))
    const res = await PATCH(
      makeReq("http://localhost/api/team/u-emp/credentials", "PATCH", { employeeId: "EMP-001" }),
      makeParams({ id: "u-emp" }),
    )
    expect(res.status).toBe(409)
  })
})

// ── POST /api/team/[id]/credentials/generate ─────────────────────────────────

describe("POST /api/team/[id]/credentials/generate (ACCESS_CODE)", () => {
  it("returns 401 without session", async () => {
    const { POST } = await import("@/app/api/team/[id]/credentials/generate/route")
    mockSessionFn.mockResolvedValue(null)
    const res = await POST(
      makeReq("http://localhost/api/team/u-emp/credentials/generate", "POST", { type: "ACCESS_CODE" }),
      makeParams({ id: "u-emp" }),
    )
    expect(res.status).toBe(401)
  })

  it("generates an access code and returns rawValue", async () => {
    const { POST } = await import("@/app/api/team/[id]/credentials/generate/route")
    mockUserFindFirst.mockResolvedValue({ ...TARGET_USER, employeeCredential: null })
    const res = await POST(
      makeReq("http://localhost/api/team/u-emp/credentials/generate", "POST", { type: "ACCESS_CODE" }),
      makeParams({ id: "u-emp" }),
    )
    expect(res.status).toBe(200)
    const body = await res.json() as { rawValue: string; masked: string }
    expect(body.rawValue).toHaveLength(6)
    expect(body.masked).toBeTruthy()
    expect(mockTxFn).toHaveBeenCalled()
  })

  it("returns 400 for unknown type", async () => {
    const { POST } = await import("@/app/api/team/[id]/credentials/generate/route")
    const res = await POST(
      makeReq("http://localhost/api/team/u-emp/credentials/generate", "POST", { type: "UNKNOWN" }),
      makeParams({ id: "u-emp" }),
    )
    expect(res.status).toBe(400)
  })
})

// ── GET /api/team/[id]/badges ─────────────────────────────────────────────────

describe("GET /api/team/[id]/badges", () => {
  it("returns 401 without session", async () => {
    const { GET } = await import("@/app/api/team/[id]/badges/route")
    mockSessionFn.mockResolvedValue(null)
    const res = await GET(makeReq("http://localhost/api/team/u-emp/badges"), makeParams({ id: "u-emp" }))
    expect(res.status).toBe(401)
  })

  it("returns badge list", async () => {
    const { GET } = await import("@/app/api/team/[id]/badges/route")
    mockBadgeFindMany.mockResolvedValue([{ id: "b-1", badgeType: "RELAY_QR", maskedDisplay: "***", isActive: true, createdAt: new Date() }])
    const res = await GET(makeReq("http://localhost/api/team/u-emp/badges"), makeParams({ id: "u-emp" }))
    expect(res.status).toBe(200)
    const body = await res.json() as { badges: { id: string }[] }
    expect(body.badges).toHaveLength(1)
  })
})

// ── POST /api/team/[id]/badges ────────────────────────────────────────────────

describe("POST /api/team/[id]/badges", () => {
  it("adds a third-party badge", async () => {
    const { POST } = await import("@/app/api/team/[id]/badges/route")
    const res = await POST(
      makeReq("http://localhost/api/team/u-emp/badges", "POST", { badgeType: "THIRD_PARTY", credentialValue: "BADGE12345" }),
      makeParams({ id: "u-emp" }),
    )
    expect(res.status).toBe(201)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it("returns 409 when badge credential already in use", async () => {
    const { POST } = await import("@/app/api/team/[id]/badges/route")
    mockBadgeFindFirst.mockResolvedValue({ id: "b-existing" })
    const res = await POST(
      makeReq("http://localhost/api/team/u-emp/badges", "POST", { badgeType: "THIRD_PARTY", credentialValue: "BADGE12345" }),
      makeParams({ id: "u-emp" }),
    )
    expect(res.status).toBe(409)
  })

  it("returns 400 for non-THIRD_PARTY type", async () => {
    const { POST } = await import("@/app/api/team/[id]/badges/route")
    const res = await POST(
      makeReq("http://localhost/api/team/u-emp/badges", "POST", { badgeType: "RELAY_QR", credentialValue: "ABC" }),
      makeParams({ id: "u-emp" }),
    )
    expect(res.status).toBe(400)
  })
})

// ── DELETE /api/team/[id]/badges/[badgeId] ────────────────────────────────────

describe("DELETE /api/team/[id]/badges/[badgeId]", () => {
  it("returns 401 without session", async () => {
    const { DELETE } = await import("@/app/api/team/[id]/badges/[badgeId]/route")
    mockSessionFn.mockResolvedValue(null)
    const res = await DELETE(
      makeReq("http://localhost/api/team/u-emp/badges/b-1", "DELETE"),
      makeParams({ id: "u-emp", badgeId: "b-1" }),
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when badge not found", async () => {
    const { DELETE } = await import("@/app/api/team/[id]/badges/[badgeId]/route")
    mockBadgeFindFirst.mockResolvedValue(null)
    const res = await DELETE(
      makeReq("http://localhost/api/team/u-emp/badges/b-1", "DELETE"),
      makeParams({ id: "u-emp", badgeId: "b-1" }),
    )
    expect(res.status).toBe(404)
  })

  it("revokes the badge", async () => {
    const { DELETE } = await import("@/app/api/team/[id]/badges/[badgeId]/route")
    mockBadgeFindFirst.mockResolvedValue({ id: "b-1", userId: "u-emp", organizationId: "org-1" })
    const res = await DELETE(
      makeReq("http://localhost/api/team/u-emp/badges/b-1", "DELETE"),
      makeParams({ id: "u-emp", badgeId: "b-1" }),
    )
    expect(res.status).toBe(200)
    expect(mockBadgeUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "b-1" },
      data:  expect.objectContaining({ isActive: false }),
    }))
  })
})
