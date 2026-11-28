/**
 * Phase 1 regression tests: auth policy + session policy
 *
 * Covers:
 * GET  /api/settings/auth-policy — 401, 403, returns policy
 * PATCH /api/settings/auth-policy — 401, 403, 400 invalid method, merges config
 * resolveSessionPolicy — org defaults, device overrides, disable flags
 * Session version validation — user inactive, version mismatch, device revoked
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

const mockSessionFn = vi.fn()
vi.mock("@/lib/session", () => ({ getSession: (...a: unknown[]) => mockSessionFn(...a) }))

const mockOrgFindUnique = vi.fn()
const mockOrgUpdate     = vi.fn()
const mockUserFindUnique = vi.fn()
const mockDeviceFindUnique = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization:     { findUnique: (...a: unknown[]) => mockOrgFindUnique(...a), update: (...a: unknown[]) => mockOrgUpdate(...a) },
    user:             { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    registeredDevice: { findUnique: (...a: unknown[]) => mockDeviceFindUnique(...a) },
  },
}))

const ADMIN_SESSION = {
  userId: "u-1", email: "admin@acme.com", name: "Admin", role: "ADMIN",
  organizationId: "org-1",
}

function makeReq(method: string, body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/settings/auth-policy", {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSessionFn.mockResolvedValue(ADMIN_SESSION)
  mockOrgFindUnique.mockResolvedValue({ authPolicyConfig: null })
  mockOrgUpdate.mockResolvedValue({})
})

// ── GET /api/settings/auth-policy ────────────────────────────────────────────

describe("GET /api/settings/auth-policy", () => {
  it("returns 401 without session", async () => {
    const { GET } = await import("@/app/api/settings/auth-policy/route")
    mockSessionFn.mockResolvedValue(null)
    const res = await GET(makeReq("GET"))
    expect(res.status).toBe(401)
  })

  it("returns 403 for non-admin", async () => {
    const { GET } = await import("@/app/api/settings/auth-policy/route")
    mockSessionFn.mockResolvedValue({ ...ADMIN_SESSION, role: "EMPLOYEE" })
    const res = await GET(makeReq("GET"))
    expect(res.status).toBe(403)
  })

  it("returns null policy when not configured", async () => {
    const { GET } = await import("@/app/api/settings/auth-policy/route")
    const res = await GET(makeReq("GET"))
    expect(res.status).toBe(200)
    const body = await res.json() as { policy: unknown }
    expect(body.policy).toBeNull()
  })

  it("returns existing policy", async () => {
    const { GET } = await import("@/app/api/settings/auth-policy/route")
    mockOrgFindUnique.mockResolvedValue({
      authPolicyConfig: { permittedMethods: ["BADGE"], inactivityTimeoutSeconds: 1800 },
    })
    const res = await GET(makeReq("GET"))
    const body = await res.json() as { policy: { permittedMethods: string[]; inactivityTimeoutSeconds: number } }
    expect(body.policy.permittedMethods).toEqual(["BADGE"])
    expect(body.policy.inactivityTimeoutSeconds).toBe(1800)
  })
})

// ── PATCH /api/settings/auth-policy ──────────────────────────────────────────

describe("PATCH /api/settings/auth-policy", () => {
  it("returns 400 for invalid method in permittedMethods", async () => {
    const { PATCH } = await import("@/app/api/settings/auth-policy/route")
    const res = await PATCH(makeReq("PATCH", { permittedMethods: ["INVALID_METHOD"] }))
    expect(res.status).toBe(400)
  })

  it("merges partial update with existing config", async () => {
    const { PATCH } = await import("@/app/api/settings/auth-policy/route")
    mockOrgFindUnique.mockResolvedValue({
      authPolicyConfig: {
        permittedMethods: ["EMPLOYEE_ID"],
        inactivityTimeoutSeconds: 900,
        maxSessionDurationSeconds: null,
        disableInactivityTimeout: false,
        disableMaxSessionDuration: false,
      },
    })
    const res = await PATCH(makeReq("PATCH", { inactivityTimeoutSeconds: 1800 }))
    expect(res.status).toBe(200)
    const body = await res.json() as { policy: { permittedMethods: string[]; inactivityTimeoutSeconds: number } }
    // Existing permittedMethods preserved
    expect(body.policy.permittedMethods).toEqual(["EMPLOYEE_ID"])
    // Updated inactivity timeout
    expect(body.policy.inactivityTimeoutSeconds).toBe(1800)
  })

  it("accepts null for inactivityTimeoutSeconds (disable timeout)", async () => {
    const { PATCH } = await import("@/app/api/settings/auth-policy/route")
    const res = await PATCH(makeReq("PATCH", { inactivityTimeoutSeconds: null }))
    expect(res.status).toBe(200)
    const body = await res.json() as { policy: { inactivityTimeoutSeconds: null } }
    expect(body.policy.inactivityTimeoutSeconds).toBeNull()
  })

  it("persists updated config to database", async () => {
    const { PATCH } = await import("@/app/api/settings/auth-policy/route")
    await PATCH(makeReq("PATCH", {
      permittedMethods:         ["ACCESS_CODE", "BADGE"],
      maxSessionDurationSeconds: 43200,
    }))
    expect(mockOrgUpdate).toHaveBeenCalledOnce()
    expect(mockOrgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "org-1" },
        data:  expect.objectContaining({ authPolicyConfig: expect.any(Object) }),
      })
    )
  })
})

// ── resolveSessionPolicy (unit) ───────────────────────────────────────────────

describe("resolveSessionPolicy", () => {
  it("returns null for both when org has no policy", async () => {
    const { resolveSessionPolicy } = await import("@/lib/employee-session")
    const result = resolveSessionPolicy(null, null)
    expect(result.inactivityTimeoutSeconds).toBeNull()
    expect(result.maxSessionDurationSeconds).toBeNull()
  })

  it("returns org defaults when no device override", async () => {
    const { resolveSessionPolicy } = await import("@/lib/employee-session")
    const result = resolveSessionPolicy(
      { permittedMethods: [], inactivityTimeoutSeconds: 900, maxSessionDurationSeconds: 28800, disableInactivityTimeout: false, disableMaxSessionDuration: false },
      null
    )
    expect(result.inactivityTimeoutSeconds).toBe(900)
    expect(result.maxSessionDurationSeconds).toBe(28800)
  })

  it("device override takes precedence", async () => {
    const { resolveSessionPolicy } = await import("@/lib/employee-session")
    const result = resolveSessionPolicy(
      { permittedMethods: [], inactivityTimeoutSeconds: 900, maxSessionDurationSeconds: 28800, disableInactivityTimeout: false, disableMaxSessionDuration: false },
      { inactivityTimeoutSeconds: 120, maxSessionDurationSeconds: 43200, disableInactivityTimeout: false, disableMaxSessionDuration: false }
    )
    expect(result.inactivityTimeoutSeconds).toBe(120)
    expect(result.maxSessionDurationSeconds).toBe(43200)
  })

  it("device disableInactivityTimeout overrides org timeout", async () => {
    const { resolveSessionPolicy } = await import("@/lib/employee-session")
    const result = resolveSessionPolicy(
      { permittedMethods: [], inactivityTimeoutSeconds: 900, maxSessionDurationSeconds: null, disableInactivityTimeout: false, disableMaxSessionDuration: false },
      { inactivityTimeoutSeconds: null, maxSessionDurationSeconds: null, disableInactivityTimeout: true, disableMaxSessionDuration: false }
    )
    expect(result.inactivityTimeoutSeconds).toBeNull()
  })

  it("device disableMaxSessionDuration overrides org max", async () => {
    const { resolveSessionPolicy } = await import("@/lib/employee-session")
    const result = resolveSessionPolicy(
      { permittedMethods: [], inactivityTimeoutSeconds: null, maxSessionDurationSeconds: 28800, disableInactivityTimeout: false, disableMaxSessionDuration: false },
      { inactivityTimeoutSeconds: null, maxSessionDurationSeconds: null, disableInactivityTimeout: false, disableMaxSessionDuration: true }
    )
    expect(result.maxSessionDurationSeconds).toBeNull()
  })

  it("org disableInactivityTimeout wins even without device", async () => {
    const { resolveSessionPolicy } = await import("@/lib/employee-session")
    const result = resolveSessionPolicy(
      { permittedMethods: [], inactivityTimeoutSeconds: 1800, maxSessionDurationSeconds: null, disableInactivityTimeout: true, disableMaxSessionDuration: false },
      null
    )
    expect(result.inactivityTimeoutSeconds).toBeNull()
  })
})

// ── validateEmployeeSession (unit) ────────────────────────────────────────────

describe("validateEmployeeSession", () => {
  it("returns not_employee for non-employee sessions", async () => {
    const { validateEmployeeSession } = await import("@/lib/employee-session")
    const result = await validateEmployeeSession({
      userId: "u-1", email: "e@e.com", name: "E", role: "EMPLOYEE",
      organizationId: "org-1", sessionType: "standard",
    })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe("not_employee")
  })

  it("returns user_inactive when user is deactivated", async () => {
    const { validateEmployeeSession } = await import("@/lib/employee-session")
    mockUserFindUnique.mockResolvedValue({ employeeSessionVersion: 0, isActive: false })
    const result = await validateEmployeeSession({
      userId: "u-1", email: "e@e.com", name: "E", role: "EMPLOYEE",
      organizationId: "org-1", sessionType: "employee", employeeSessionVersion: 0,
    })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe("user_inactive")
  })

  it("returns version_mismatch when employee session version differs", async () => {
    const { validateEmployeeSession } = await import("@/lib/employee-session")
    mockUserFindUnique.mockResolvedValue({ employeeSessionVersion: 2, isActive: true })
    const result = await validateEmployeeSession({
      userId: "u-1", email: "e@e.com", name: "E", role: "EMPLOYEE",
      organizationId: "org-1", sessionType: "employee", employeeSessionVersion: 1,
    })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe("version_mismatch")
  })

  it("returns valid for active user with matching version", async () => {
    const { validateEmployeeSession } = await import("@/lib/employee-session")
    mockUserFindUnique.mockResolvedValue({ employeeSessionVersion: 1, isActive: true })
    const result = await validateEmployeeSession({
      userId: "u-1", email: "e@e.com", name: "E", role: "EMPLOYEE",
      organizationId: "org-1", sessionType: "employee", employeeSessionVersion: 1,
    })
    expect(result.valid).toBe(true)
  })

  it("returns device_revoked when device is deactivated", async () => {
    const { validateEmployeeSession } = await import("@/lib/employee-session")
    mockUserFindUnique.mockResolvedValue({ employeeSessionVersion: 0, isActive: true })
    mockDeviceFindUnique.mockResolvedValue({ sessionVersion: 0, isActive: false })
    const result = await validateEmployeeSession({
      userId: "u-1", email: "e@e.com", name: "E", role: "EMPLOYEE",
      organizationId: "org-1", sessionType: "employee",
      employeeSessionVersion: 0, deviceId: "dev-1", deviceSessionVersion: 0,
    })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe("device_revoked")
  })

  it("returns version_mismatch when device session version differs", async () => {
    const { validateEmployeeSession } = await import("@/lib/employee-session")
    mockUserFindUnique.mockResolvedValue({ employeeSessionVersion: 0, isActive: true })
    mockDeviceFindUnique.mockResolvedValue({ sessionVersion: 3, isActive: true })
    const result = await validateEmployeeSession({
      userId: "u-1", email: "e@e.com", name: "E", role: "EMPLOYEE",
      organizationId: "org-1", sessionType: "employee",
      employeeSessionVersion: 0, deviceId: "dev-1", deviceSessionVersion: 2,
    })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe("version_mismatch")
  })
})
