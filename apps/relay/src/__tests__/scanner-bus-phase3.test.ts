/**
 * Phase 3 regression tests: ScannerBus, session management, org resolution
 *
 * Note: ScannerBus itself is a browser-only singleton; here we test:
 *   1. The employee heartbeat endpoint (session renewal logic)
 *   2. The employee auth route (org resolution — registered device cookie vs slug param)
 *   3. The session policy resolution (resolveSessionPolicy)
 *   4. extendEmployeeSession (inactivity renewal, hard-cap enforcement)
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
  getIP:      vi.fn().mockReturnValue("127.0.0.1"),
  checkLimit: vi.fn().mockResolvedValue(false),
  limiters:   { employeeLogin: null, employeeLoginDevice: null, employeeLoginOrg: null },
}))

const mockGetCookie = vi.fn().mockReturnValue(undefined)
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (...a: unknown[]) => mockGetCookie(...a),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))

const mockUserFindUnique       = vi.fn()
const mockDeviceFindUnique     = vi.fn()
const mockCredFindUnique       = vi.fn()
const mockBadgeFindFirst       = vi.fn()
const mockOrgFindFirst         = vi.fn()
const mockAuthPolicyFindFirst  = vi.fn()
const mockAuditCreate          = vi.fn().mockResolvedValue({})
const mockUserUpdate           = vi.fn()
const mockGetSession           = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user:                 { findUnique: (...a: unknown[]) => mockUserFindUnique(...a), update: (...a: unknown[]) => mockUserUpdate(...a) },
    registeredDevice:     { findUnique: (...a: unknown[]) => mockDeviceFindUnique(...a), update: vi.fn().mockResolvedValue({}) },
    employeeCredential:   { findUnique: (...a: unknown[]) => mockCredFindUnique(...a), findFirst: vi.fn().mockResolvedValue(null) },
    employeeBadge:        { findFirst:  (...a: unknown[]) => mockBadgeFindFirst(...a) },
    organization:         { findFirst:  (...a: unknown[]) => mockOrgFindFirst(...a) },
    organizationAuthPolicy: { findFirst: (...a: unknown[]) => mockAuthPolicyFindFirst(...a) },
    authAuditLog:         { create: (...a: unknown[]) => mockAuditCreate(...a) },
  },
}))

vi.mock("@/lib/session", () => ({
  getSession: (...a: unknown[]) => mockGetSession(...a),
  deleteSession: vi.fn(),
}))

vi.mock("@/lib/employee-session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/employee-session")>("@/lib/employee-session")
  return {
    ...actual,
    createEmployeeSession: vi.fn().mockResolvedValue(undefined),
    validateEmployeeSession: vi.fn().mockResolvedValue({ valid: true }),
  }
})

// ── 1. resolveSessionPolicy ───────────────────────────────────────────────────

describe("resolveSessionPolicy", () => {
  it("returns org defaults when no device override", async () => {
    const { resolveSessionPolicy } = await import("@/lib/employee-session")
    const result = resolveSessionPolicy(
      { permittedMethods: ["EMPLOYEE_ID"], inactivityTimeoutSeconds: 1800, maxSessionDurationSeconds: null, disableInactivityTimeout: false, disableMaxSessionDuration: false },
      null
    )
    expect(result.inactivityTimeoutSeconds).toBe(1800)
    expect(result.maxSessionDurationSeconds).toBeNull()
  })

  it("device override replaces org inactivity", async () => {
    const { resolveSessionPolicy } = await import("@/lib/employee-session")
    const result = resolveSessionPolicy(
      { permittedMethods: ["EMPLOYEE_ID"], inactivityTimeoutSeconds: 1800, maxSessionDurationSeconds: null, disableInactivityTimeout: false, disableMaxSessionDuration: false },
      { inactivityTimeoutSeconds: 900, maxSessionDurationSeconds: null, disableInactivityTimeout: false, disableMaxSessionDuration: false }
    )
    expect(result.inactivityTimeoutSeconds).toBe(900)
  })

  it("device disableInactivityTimeout overrides org value", async () => {
    const { resolveSessionPolicy } = await import("@/lib/employee-session")
    const result = resolveSessionPolicy(
      { permittedMethods: ["EMPLOYEE_ID"], inactivityTimeoutSeconds: 1800, maxSessionDurationSeconds: null, disableInactivityTimeout: false, disableMaxSessionDuration: false },
      { inactivityTimeoutSeconds: null, maxSessionDurationSeconds: null, disableInactivityTimeout: true, disableMaxSessionDuration: false }
    )
    expect(result.inactivityTimeoutSeconds).toBeNull()
  })

  it("org disableInactivityTimeout yields null regardless of device value", async () => {
    const { resolveSessionPolicy } = await import("@/lib/employee-session")
    const result = resolveSessionPolicy(
      { permittedMethods: ["EMPLOYEE_ID"], inactivityTimeoutSeconds: 1800, maxSessionDurationSeconds: null, disableInactivityTimeout: true, disableMaxSessionDuration: false },
      { inactivityTimeoutSeconds: 600, maxSessionDurationSeconds: null, disableInactivityTimeout: false, disableMaxSessionDuration: false }
    )
    expect(result.inactivityTimeoutSeconds).toBeNull()
  })

  it("no arbitrary 8h cap — large values are accepted unchanged", async () => {
    const { resolveSessionPolicy } = await import("@/lib/employee-session")
    const TEN_HOURS = 36000
    const result = resolveSessionPolicy(
      { permittedMethods: ["EMPLOYEE_ID"], inactivityTimeoutSeconds: TEN_HOURS, maxSessionDurationSeconds: TEN_HOURS * 2, disableInactivityTimeout: false, disableMaxSessionDuration: false },
      null
    )
    expect(result.inactivityTimeoutSeconds).toBe(TEN_HOURS)
    expect(result.maxSessionDurationSeconds).toBe(TEN_HOURS * 2)
  })
})

// ── 2. extendEmployeeSession hard-cap enforcement ────────────────────────────

describe("extendEmployeeSession", () => {
  it("returns false when session has no inactivityTimeoutSeconds", async () => {
    const { extendEmployeeSession } = await import("@/lib/employee-session")
    const session = { userId: "u1", email: "e@e.com", name: "E", role: "EMPLOYEE", organizationId: "o1" }
    const result = await extendEmployeeSession(session as never)
    expect(result).toBe(false)
  })

  it("returns false when past hard cap", async () => {
    const { extendEmployeeSession } = await import("@/lib/employee-session")
    const nowSecs = Math.floor(Date.now() / 1000)
    const session = {
      userId: "u1", email: "e@e.com", name: "E", role: "EMPLOYEE", organizationId: "o1",
      sessionType: "employee",
      inactivityTimeoutSeconds: 300,
      sessionIssuedAt: nowSecs - 7200,     // issued 2h ago
      maxSessionDurationSeconds: 3600,     // 1h cap → already expired
    }
    const result = await extendEmployeeSession(session as never)
    expect(result).toBe(false)
  })

  it("caps renewal at hard max session duration", async () => {
    const { setSessionCookie } = await import("@hce/auth")
    const mockSetCookie = vi.mocked(setSessionCookie)
    mockSetCookie.mockClear()

    const { extendEmployeeSession } = await import("@/lib/employee-session")
    const nowSecs = Math.floor(Date.now() / 1000)
    const session = {
      userId: "u1", email: "e@e.com", name: "E", role: "EMPLOYEE", organizationId: "o1",
      sessionType: "employee",
      inactivityTimeoutSeconds: 1800,      // 30-min inactivity window
      sessionIssuedAt: nowSecs - 1700,     // issued ~28 min ago
      maxSessionDurationSeconds: 1800,     // 30-min hard cap → ~100s left
    }
    const result = await extendEmployeeSession(session as never)
    expect(result).toBe(true)
    // setSessionCookie("session", token, { maxAge }) — check third arg
    const [, , opts] = mockSetCookie.mock.calls[0] as [string, string, { maxAge: number }]
    // maxAge should be <= remaining hard-cap time (~100s), not 1800s
    expect(opts.maxAge).toBeLessThan(200)   // well under 1800s
  })
})

// ── 3. Heartbeat endpoint ─────────────────────────────────────────────────────

describe("POST /api/auth/employee/heartbeat", () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    vi.resetModules()
  })

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    const { POST } = await import("@/app/api/auth/employee/heartbeat/route")
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it("returns 401 when session has no inactivity timeout", async () => {
    mockGetSession.mockResolvedValue({
      userId: "u1", email: "e@e.com", name: "E", role: "EMPLOYEE",
      organizationId: "o1", sessionType: "employee",
      // no inactivityTimeoutSeconds
    })
    const { POST } = await import("@/app/api/auth/employee/heartbeat/route")
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it("returns 200 when session has inactivity timeout", async () => {
    mockGetSession.mockResolvedValue({
      userId: "u1", email: "e@e.com", name: "E", role: "EMPLOYEE",
      organizationId: "o1", sessionType: "employee",
      inactivityTimeoutSeconds: 1800,
      employeeSessionVersion: 1,
    })
    mockUserFindUnique.mockResolvedValue({ employeeSessionVersion: 1, isActive: true })
    const { POST } = await import("@/app/api/auth/employee/heartbeat/route")
    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})

// ── 4. Org resolution — no global lookup for third-party badges ───────────────

describe("Employee auth org resolution", () => {
  beforeEach(() => {
    mockGetCookie.mockReturnValue(undefined)
    mockDeviceFindUnique.mockReset()
    mockOrgFindFirst.mockReset()
    mockCredFindUnique.mockReset()
    mockBadgeFindFirst.mockReset()
    vi.resetModules()
  })

  it("returns 400 when no org context is provided for quick access", async () => {
    const { POST } = await import("@/app/api/auth/employee/route")
    const req = new NextRequest("http://localhost/api/auth/employee", {
      method: "POST",
      body: JSON.stringify({ credential: "SOME_BADGE_VALUE" }),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req)
    // Without a device cookie or organizationSlug, cannot resolve org
    expect([400, 401, 422]).toContain(res.status)
  })

  it("resolves org from relay-device cookie without slug param", async () => {
    // The device cookie maps to an org; no slug needed
    mockGetCookie.mockImplementation((name: string) => {
      if (name === "relay-device") return { value: "device-token-123" }
      return undefined
    })
    mockDeviceFindUnique.mockResolvedValue({
      id: "dev-1",
      organizationId: "org-1",
      isActive: true,
      loginMode: "QUICK_ACCESS",
      permittedMethods: ["EMPLOYEE_ID"],
      inactivityTimeoutSeconds: null,
      maxSessionDurationSeconds: null,
      disableInactivityTimeout: false,
      disableMaxSessionDuration: false,
      sessionVersion: 0,
      organization: { id: "org-1", slug: "acme", name: "Acme", isActive: true },
    })
    mockOrgFindFirst.mockResolvedValue(null)   // should NOT be called for org lookup by slug
    mockCredFindUnique.mockResolvedValue(null)
    mockBadgeFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/auth/employee/route")
    const req = new NextRequest("http://localhost/api/auth/employee", {
      method: "POST",
      body: JSON.stringify({ credential: "EMP-001" }),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req)
    // Credential not found → 401, but org was resolved from device cookie (not global lookup)
    expect(res.status).toBe(401)
    // Verify that findFirst (global org lookup by slug) was NOT called
    expect(mockOrgFindFirst).not.toHaveBeenCalled()
  })
})
