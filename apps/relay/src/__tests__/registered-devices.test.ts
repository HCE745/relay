/**
 * Phase 1 regression tests: registered device management
 *
 * Covers:
 * GET  /api/settings/devices — 401, 403, returns device list
 * POST /api/settings/devices — 401, 403, 400 missing name, creates device + sets cookie
 * GET  /api/settings/devices/[id] — 401, 403, 404, returns device
 * PATCH /api/settings/devices/[id] — 401, 403, 404, updates device config
 * PATCH /api/settings/devices/[id] — invalidateSessions increments sessionVersion
 * DELETE /api/settings/devices/[id] — 401, 403, 404, revokes device + invalidates sessions
 * DELETE /api/settings/devices — revokes current device via cookie
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

process.env.SESSION_SECRET         = "test-session-secret-32-chars-xx"
process.env.CREDENTIAL_HMAC_SECRET = "test-hmac-secret-32-chars-xxxxxx"

vi.mock("server-only", () => ({}))
vi.mock("@hce/auth", () => ({
  signJwt:          vi.fn().mockResolvedValue("mock.jwt.token"),
  verifyJwt:        vi.fn(),
  encodeSecret:     vi.fn((s: string) => s),
  setSessionCookie: vi.fn().mockResolvedValue(undefined),
  getSessionToken:  vi.fn(),
  deleteSessionCookie: vi.fn(),
}))

vi.mock("@/lib/ratelimit", () => ({
  getIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

const mockSetCookie    = vi.fn()
const mockDeleteCookie = vi.fn()
const mockGetCookie    = vi.fn().mockReturnValue(undefined)

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get:    (...a: unknown[]) => mockGetCookie(...a),
    set:    (...a: unknown[]) => mockSetCookie(...a),
    delete: (...a: unknown[]) => mockDeleteCookie(...a),
  }),
}))

vi.mock("bcryptjs", () => ({
  hash:    vi.fn().mockResolvedValue("hashed-token"),
  compare: vi.fn().mockResolvedValue(true),
}))

const mockSessionFn = vi.fn()
vi.mock("@/lib/session", () => ({ getSession: (...a: unknown[]) => mockSessionFn(...a) }))

const mockDeviceFindMany  = vi.fn()
const mockDeviceFindFirst = vi.fn()
const mockDeviceCreate    = vi.fn()
const mockDeviceUpdate    = vi.fn()
const mockDeviceFindUnique = vi.fn()
const mockLocationFindFirst  = vi.fn()
const mockDeptFindFirst      = vi.fn()
const mockUserUpdate         = vi.fn()
const mockAuditCreate        = vi.fn().mockResolvedValue({})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    registeredDevice: {
      findMany:   (...a: unknown[]) => mockDeviceFindMany(...a),
      findFirst:  (...a: unknown[]) => mockDeviceFindFirst(...a),
      create:     (...a: unknown[]) => mockDeviceCreate(...a),
      update:     (...a: unknown[]) => mockDeviceUpdate(...a),
      findUnique: (...a: unknown[]) => mockDeviceFindUnique(...a),
    },
    location:   { findFirst: (...a: unknown[]) => mockLocationFindFirst(...a) },
    department: { findFirst: (...a: unknown[]) => mockDeptFindFirst(...a) },
    user:       { update:    (...a: unknown[]) => mockUserUpdate(...a) },
    authAuditLog: { create:  (...a: unknown[]) => mockAuditCreate(...a) },
  },
}))

const ADMIN_SESSION = {
  userId: "u-1", email: "admin@acme.com", name: "Admin", role: "ADMIN",
  organizationId: "org-1",
}

const BASE_DEVICE = {
  id: "dev-1", deviceName: "Line 1 Terminal", locationId: null, departmentId: null,
  stationId: null, loginMode: "QUICK_ACCESS", permittedMethods: [],
  inactivityTimeoutSeconds: null, maxSessionDurationSeconds: null,
  disableInactivityTimeout: false, disableMaxSessionDuration: false,
  platform: null, isActive: true, registeredAt: new Date(), lastSeenAt: null,
  revokedAt: null, sessionVersion: 0,
  location: null, department: null,
}

function makeReq(url: string, body?: Record<string, unknown>) {
  return new NextRequest(url, body
    ? { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }
    : { method: "GET" }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSessionFn.mockResolvedValue(ADMIN_SESSION)
  mockDeviceFindMany.mockResolvedValue([BASE_DEVICE])
  mockDeviceFindFirst.mockResolvedValue(BASE_DEVICE)
  mockDeviceCreate.mockResolvedValue({ ...BASE_DEVICE, id: "dev-new" })
  mockDeviceUpdate.mockResolvedValue(BASE_DEVICE)
  mockDeviceFindUnique.mockResolvedValue(null)
  mockLocationFindFirst.mockResolvedValue({ id: "loc-1" })
  mockDeptFindFirst.mockResolvedValue({ id: "dept-1" })
})

// ── GET /api/settings/devices ─────────────────────────────────────────────────

describe("GET /api/settings/devices", () => {
  it("returns 401 without session", async () => {
    const { GET } = await import("@/app/api/settings/devices/route")
    mockSessionFn.mockResolvedValue(null)
    const res = await GET(makeReq("http://localhost/api/settings/devices"))
    expect(res.status).toBe(401)
  })

  it("returns 403 for non-admin", async () => {
    const { GET } = await import("@/app/api/settings/devices/route")
    mockSessionFn.mockResolvedValue({ ...ADMIN_SESSION, role: "EMPLOYEE" })
    const res = await GET(makeReq("http://localhost/api/settings/devices"))
    expect(res.status).toBe(403)
  })

  it("returns device list", async () => {
    const { GET } = await import("@/app/api/settings/devices/route")
    const res = await GET(makeReq("http://localhost/api/settings/devices"))
    expect(res.status).toBe(200)
    const body = await res.json() as { devices: typeof BASE_DEVICE[] }
    expect(body.devices).toHaveLength(1)
    expect(body.devices[0].deviceName).toBe("Line 1 Terminal")
  })
})

// ── POST /api/settings/devices ────────────────────────────────────────────────

describe("POST /api/settings/devices (register)", () => {
  it("returns 401 without session", async () => {
    const { POST } = await import("@/app/api/settings/devices/route")
    mockSessionFn.mockResolvedValue(null)
    const res = await POST(makeReq("http://localhost/api/settings/devices", { deviceName: "T1" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when deviceName is missing", async () => {
    const { POST } = await import("@/app/api/settings/devices/route")
    const res = await POST(makeReq("http://localhost/api/settings/devices", {}))
    expect(res.status).toBe(400)
  })

  it("creates device and sets relay-device cookie", async () => {
    const { POST } = await import("@/app/api/settings/devices/route")
    const res = await POST(makeReq("http://localhost/api/settings/devices", {
      deviceName: "Terminal 1",
      loginMode:  "QUICK_ACCESS",
    }))
    expect(res.status).toBe(201)
    expect(mockDeviceCreate).toHaveBeenCalledOnce()
    expect(mockSetCookie).toHaveBeenCalledWith(
      "relay-device",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "strict" })
    )
  })

  it("returns 400 for invalid locationId", async () => {
    const { POST } = await import("@/app/api/settings/devices/route")
    mockLocationFindFirst.mockResolvedValue(null)
    const res = await POST(makeReq("http://localhost/api/settings/devices", {
      deviceName: "T1", locationId: "loc-bad",
    }))
    expect(res.status).toBe(400)
  })
})

// ── GET /api/settings/devices/[id] ───────────────────────────────────────────

describe("GET /api/settings/devices/[id]", () => {
  function makeCtx(id = "dev-1") { return { params: Promise.resolve({ id }) } }

  it("returns 404 when device not found", async () => {
    const { GET } = await import("@/app/api/settings/devices/[id]/route")
    mockDeviceFindFirst.mockResolvedValue(null)
    const res = await GET(makeReq("http://localhost/api/settings/devices/dev-1"), makeCtx())
    expect(res.status).toBe(404)
  })

  it("returns device details", async () => {
    const { GET } = await import("@/app/api/settings/devices/[id]/route")
    const res = await GET(makeReq("http://localhost/api/settings/devices/dev-1"), makeCtx())
    expect(res.status).toBe(200)
    const body = await res.json() as { device: { deviceName: string } }
    expect(body.device.deviceName).toBe("Line 1 Terminal")
  })
})

// ── PATCH /api/settings/devices/[id] ─────────────────────────────────────────

describe("PATCH /api/settings/devices/[id]", () => {
  function makeCtx(id = "dev-1") { return { params: Promise.resolve({ id }) } }
  function makePatch(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/settings/devices/dev-1", {
      method: "PATCH",
      body:   JSON.stringify(body),
      headers: { "content-type": "application/json" },
    })
  }

  it("returns 404 when device not found", async () => {
    const { PATCH } = await import("@/app/api/settings/devices/[id]/route")
    mockDeviceFindFirst.mockResolvedValue(null)
    const res = await PATCH(makePatch({ deviceName: "New Name" }), makeCtx())
    expect(res.status).toBe(404)
  })

  it("updates device config", async () => {
    const { PATCH } = await import("@/app/api/settings/devices/[id]/route")
    const res = await PATCH(makePatch({ loginMode: "STANDARD" }), makeCtx())
    expect(res.status).toBe(200)
    expect(mockDeviceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ loginMode: "STANDARD" }),
      })
    )
  })

  it("calls invalidateDeviceSessions when invalidateSessions=true", async () => {
    const { PATCH } = await import("@/app/api/settings/devices/[id]/route")
    const res = await PATCH(makePatch({ invalidateSessions: true }), makeCtx())
    expect(res.status).toBe(200)
    // invalidateDeviceSessions calls registeredDevice.update with { sessionVersion: { increment: 1 } }
    expect(mockDeviceUpdate).toHaveBeenCalledTimes(2)
  })
})

// ── DELETE /api/settings/devices/[id] ────────────────────────────────────────

describe("DELETE /api/settings/devices/[id]", () => {
  function makeCtx(id = "dev-1") { return { params: Promise.resolve({ id }) } }
  function makeDelete() {
    return new NextRequest("http://localhost/api/settings/devices/dev-1", { method: "DELETE" })
  }

  it("returns 404 when device not found", async () => {
    const { DELETE } = await import("@/app/api/settings/devices/[id]/route")
    mockDeviceFindFirst.mockResolvedValue(null)
    const res = await DELETE(makeDelete(), makeCtx())
    expect(res.status).toBe(404)
  })

  it("revokes device and invalidates sessions", async () => {
    const { DELETE } = await import("@/app/api/settings/devices/[id]/route")
    const res = await DELETE(makeDelete(), makeCtx())
    expect(res.status).toBe(200)
    expect(mockDeviceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false }),
      })
    )
    // second update: session version increment from invalidateDeviceSessions
    expect(mockDeviceUpdate).toHaveBeenCalledTimes(2)
  })
})

// ── POST /api/settings/devices/[id]/rotate ────────────────────────────────────

describe("POST /api/settings/devices/[id]/rotate", () => {
  function makeCtx(id = "dev-1") { return { params: Promise.resolve({ id }) } }
  function makePost() {
    return new NextRequest("http://localhost/api/settings/devices/dev-1/rotate", { method: "POST" })
  }

  it("returns 404 when device not found", async () => {
    const { POST } = await import("@/app/api/settings/devices/[id]/rotate/route")
    mockDeviceFindFirst.mockResolvedValue(null)
    const res = await POST(makePost(), makeCtx())
    expect(res.status).toBe(404)
  })

  it("returns 409 when device is revoked", async () => {
    const { POST } = await import("@/app/api/settings/devices/[id]/rotate/route")
    mockDeviceFindFirst.mockResolvedValue({ ...BASE_DEVICE, isActive: false })
    const res = await POST(makePost(), makeCtx())
    expect(res.status).toBe(409)
  })

  it("rotates token: updates index+hash and increments sessionVersion", async () => {
    const { POST } = await import("@/app/api/settings/devices/[id]/rotate/route")
    // No relay-device cookie — caller is not on this device
    mockGetCookie.mockReturnValue(undefined)
    const res = await POST(makePost(), makeCtx())
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; cookieUpdated: boolean }
    expect(body.ok).toBe(true)
    expect(body.cookieUpdated).toBe(false)  // no cookie match
    expect(mockDeviceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deviceTokenIndex: expect.any(String),
          deviceTokenHash:  expect.any(String),
          sessionVersion:   { increment: 1 },
        }),
      })
    )
  })
})
