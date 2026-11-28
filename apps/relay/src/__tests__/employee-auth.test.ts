/**
 * Phase 1 regression tests: POST /api/auth/employee
 *
 * Covers:
 * - 400 when credential missing
 * - 400 when organizationSlug missing (no device cookie)
 * - 401 when org not found
 * - 401 when no matching credential found
 * - Employee ID login: HMAC index match, issues session
 * - Access code login: HMAC index match + bcrypt verify, issues session
 * - Badge login: HMAC index match, issues session
 * - Third-party badge: HMAC match only (no bcrypt), issues session
 * - 401 when access code hash mismatch
 * - 401 when user is inactive
 * - 401 when user org mismatch
 * - 403 when method not permitted on device
 * - Device cookie: resolves org from device, not slug
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ─── Environment ──────────────────────────────────────────────────────────────
process.env.SESSION_SECRET          = "test-session-secret-32-chars-xx"
process.env.CREDENTIAL_HMAC_SECRET  = "test-hmac-secret-32-chars-xxxxxx"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))
vi.mock("@hce/auth", () => ({
  signJwt:          vi.fn().mockResolvedValue("mock.jwt.token"),
  verifyJwt:        vi.fn(),
  encodeSecret:     vi.fn((s: string) => s),
  setSessionCookie: vi.fn().mockResolvedValue(undefined),
  getSessionToken:  vi.fn(),
  deleteSessionCookie: vi.fn(),
}))
const mockGetCookie = vi.fn().mockReturnValue(undefined)

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: (...a: unknown[]) => mockGetCookie(...a) }),
}))

const mockOrgFindUnique    = vi.fn()
const mockEmpCredFindFirst = vi.fn()
const mockBadgeFindFirst   = vi.fn()
const mockUserFindUnique   = vi.fn()
const mockDeviceFindUnique = vi.fn()
const mockDeviceUpdate     = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization:       { findUnique: (...a: unknown[]) => mockOrgFindUnique(...a) },
    employeeCredential: { findFirst:  (...a: unknown[]) => mockEmpCredFindFirst(...a) },
    employeeBadge:      { findFirst:  (...a: unknown[]) => mockBadgeFindFirst(...a) },
    user:               { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    registeredDevice:   {
      findUnique: (...a: unknown[]) => mockDeviceFindUnique(...a),
      update:     (...a: unknown[]) => mockDeviceUpdate(...a),
    },
  },
}))

vi.mock("@/lib/ratelimit", () => ({
  checkLimit: vi.fn().mockResolvedValue(null),
  getIP:      vi.fn().mockReturnValue("127.0.0.1"),
  limiters:   { employeeLogin: null },
}))

// bcryptjs mock: compare returns true when hash === "VALID_HASH"
vi.mock("bcryptjs", () => ({
  compare: vi.fn().mockImplementation((_raw: string, hash: string) =>
    Promise.resolve(hash === "VALID_HASH")
  ),
}))

import { POST } from "@/app/api/auth/employee/route"

function makeReq(body: Record<string, unknown>, deviceCookie?: string) {
  mockGetCookie.mockImplementation((name: string) =>
    name === "relay-device" && deviceCookie ? { value: deviceCookie } : undefined
  )
  return new NextRequest("http://localhost/api/auth/employee", {
    method: "POST",
    body:   JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

const BASE_USER = {
  id: "u-1", email: "alice@acme.com", name: "Alice", role: "EMPLOYEE",
  organizationId: "org-1", isActive: true, employeeSessionVersion: 0,
}

const BASE_ORG = {
  id: "org-1", subscriptionStatus: "active",
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetCookie.mockReturnValue(undefined)
  mockOrgFindUnique.mockResolvedValue(BASE_ORG)
  mockEmpCredFindFirst.mockResolvedValue(null)
  mockBadgeFindFirst.mockResolvedValue(null)
  mockUserFindUnique.mockResolvedValue(BASE_USER)
  mockDeviceFindUnique.mockResolvedValue(null)
  mockDeviceUpdate.mockResolvedValue({})
})

describe("POST /api/auth/employee — input validation", () => {
  it("returns 400 when credential is missing", async () => {
    const res = await POST(makeReq({ organizationSlug: "acme" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when organizationSlug missing and no device cookie", async () => {
    const res = await POST(makeReq({ credential: "ABC123" }))
    expect(res.status).toBe(400)
  })

  it("returns 401 when organization not found", async () => {
    mockOrgFindUnique.mockResolvedValue(null)
    const res = await POST(makeReq({ credential: "ABC123", organizationSlug: "ghost" }))
    expect(res.status).toBe(401)
  })

  it("returns 401 when org is canceled", async () => {
    mockOrgFindUnique.mockResolvedValue({ id: "org-1", subscriptionStatus: "canceled" })
    const res = await POST(makeReq({ credential: "ABC123", organizationSlug: "acme" }))
    expect(res.status).toBe(401)
  })

  it("returns 401 when no matching credential exists", async () => {
    const res = await POST(makeReq({ credential: "NOMATCH", organizationSlug: "acme" }))
    expect(res.status).toBe(401)
  })
})

describe("POST /api/auth/employee — Employee ID login", () => {
  it("matches on employeeIdIndex and issues session", async () => {
    mockEmpCredFindFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where.employeeIdEnabled) return Promise.resolve({ userId: "u-1" })
      return Promise.resolve(null)
    })
    mockOrgFindUnique
      .mockResolvedValueOnce(BASE_ORG)       // org by slug
      .mockResolvedValueOnce({ authPolicyConfig: null })  // org auth policy
    const res = await POST(makeReq({ credential: "EMP001", organizationSlug: "acme" }))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})

describe("POST /api/auth/employee — Access code login", () => {
  it("matches on accessCodeIndex + valid bcrypt hash and issues session", async () => {
    mockEmpCredFindFirst
      .mockResolvedValueOnce(null)   // employeeId check
      .mockResolvedValueOnce({ userId: "u-1", accessCodeHash: "VALID_HASH" })  // access code
    mockOrgFindUnique
      .mockResolvedValueOnce(BASE_ORG)
      .mockResolvedValueOnce({ authPolicyConfig: null })
    const res = await POST(makeReq({ credential: "MYCODE", organizationSlug: "acme" }))
    expect(res.status).toBe(200)
  })

  it("returns 401 when bcrypt hash mismatch", async () => {
    mockEmpCredFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: "u-1", accessCodeHash: "WRONG_HASH" })
    const res = await POST(makeReq({ credential: "MYCODE", organizationSlug: "acme" }))
    expect(res.status).toBe(401)
  })

  it("returns 401 when access code record has no hash", async () => {
    mockEmpCredFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: "u-1", accessCodeHash: null })
    const res = await POST(makeReq({ credential: "MYCODE", organizationSlug: "acme" }))
    expect(res.status).toBe(401)
  })
})

describe("POST /api/auth/employee — Badge login", () => {
  it("Relay badge: HMAC match + bcrypt verify, issues session", async () => {
    mockEmpCredFindFirst.mockResolvedValue(null)
    mockBadgeFindFirst.mockResolvedValue({ userId: "u-1", credentialHash: "VALID_HASH" })
    mockOrgFindUnique
      .mockResolvedValueOnce(BASE_ORG)
      .mockResolvedValueOnce({ authPolicyConfig: null })
    const res = await POST(makeReq({ credential: "BADGEVALUE", organizationSlug: "acme" }))
    expect(res.status).toBe(200)
  })

  it("Third-party badge: HMAC match only (no bcrypt), issues session", async () => {
    mockEmpCredFindFirst.mockResolvedValue(null)
    mockBadgeFindFirst.mockResolvedValue({ userId: "u-1", credentialHash: null })
    mockOrgFindUnique
      .mockResolvedValueOnce(BASE_ORG)
      .mockResolvedValueOnce({ authPolicyConfig: null })
    const res = await POST(makeReq({ credential: "12345678", organizationSlug: "acme" }))
    expect(res.status).toBe(200)
  })
})

describe("POST /api/auth/employee — user validation", () => {
  it("returns 401 when user is inactive", async () => {
    mockEmpCredFindFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      where.employeeIdEnabled ? Promise.resolve({ userId: "u-1" }) : Promise.resolve(null)
    )
    mockUserFindUnique.mockResolvedValue({ ...BASE_USER, isActive: false })
    const res = await POST(makeReq({ credential: "EMP001", organizationSlug: "acme" }))
    expect(res.status).toBe(401)
  })

  it("returns 401 when user org does not match resolved org", async () => {
    mockEmpCredFindFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      where.employeeIdEnabled ? Promise.resolve({ userId: "u-1" }) : Promise.resolve(null)
    )
    mockUserFindUnique.mockResolvedValue({ ...BASE_USER, organizationId: "org-other" })
    const res = await POST(makeReq({ credential: "EMP001", organizationSlug: "acme" }))
    expect(res.status).toBe(401)
  })
})

describe("POST /api/auth/employee — device cookie", () => {
  it("resolves org from device cookie, ignores organizationSlug", async () => {
    const deviceRecord = {
      id: "dev-1", organizationId: "org-1", isActive: true,
      sessionVersion: 0, loginMode: "QUICK_ACCESS",
      permittedMethods: [],
      inactivityTimeoutSeconds: null, maxSessionDurationSeconds: null,
      disableInactivityTimeout: false, disableMaxSessionDuration: false,
    }
    mockDeviceFindUnique.mockResolvedValue(deviceRecord)
    mockEmpCredFindFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      where.employeeIdEnabled ? Promise.resolve({ userId: "u-1" }) : Promise.resolve(null)
    )
    mockOrgFindUnique.mockResolvedValue({ authPolicyConfig: null })
    const res = await POST(makeReq({ credential: "EMP001" }, "some-device-token"))
    expect(res.status).toBe(200)
  })

  it("returns 400 when device cookie is stale and no organizationSlug given", async () => {
    mockDeviceFindUnique.mockResolvedValue(null)  // stale token
    const res = await POST(makeReq({ credential: "EMP001" }, "stale-token"))
    expect(res.status).toBe(400)
  })

  it("returns 403 when method is not permitted on device", async () => {
    const deviceRecord = {
      id: "dev-1", organizationId: "org-1", isActive: true,
      sessionVersion: 0, loginMode: "QUICK_ACCESS",
      permittedMethods: ["ACCESS_CODE"],  // only access code allowed
      inactivityTimeoutSeconds: null, maxSessionDurationSeconds: null,
      disableInactivityTimeout: false, disableMaxSessionDuration: false,
    }
    mockDeviceFindUnique.mockResolvedValue(deviceRecord)
    mockEmpCredFindFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      // employee ID match — but device only permits ACCESS_CODE
      where.employeeIdEnabled ? Promise.resolve({ userId: "u-1" }) : Promise.resolve(null)
    )
    mockOrgFindUnique.mockResolvedValue({ authPolicyConfig: null })
    const res = await POST(makeReq({ credential: "EMP001" }, "device-token"))
    expect(res.status).toBe(403)
  })
})
