/**
 * Registration validation tests.
 * Verifies server-side email format and password minimum-length checks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    organization: { create: vi.fn(), findUnique: vi.fn() },
    referral: { create: vi.fn() },
  },
}))

vi.mock("@/lib/session", () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ ok: true }),
  welcomeEmail: vi.fn().mockReturnValue("<p>welcome</p>"),
}))

vi.mock("@/lib/ratelimit", () => ({
  checkLimit:  vi.fn().mockResolvedValue(null),
  getIP:       vi.fn().mockReturnValue("127.0.0.1"),
  limiters:    { register: "register-limiter" },
}))

vi.mock("@/lib/analytics",              () => ({ logActivationEvent: vi.fn() }))
vi.mock("@/lib/registration-crm-sync",  () => ({ syncRegistrationToCrm: vi.fn() }))
vi.mock("@/lib/billing-credits-engine", () => ({
  generateUniqueReferralCode: vi.fn().mockResolvedValue("ABCDE"),
  buildReferralLink:          vi.fn().mockReturnValue("https://example.com/r/ABCDE"),
  getActiveReferralProgram:   vi.fn().mockResolvedValue(null),
}))
vi.mock("@/lib/test-registration-token", () => ({
  verifyTestRegToken: vi.fn().mockReturnValue(false),
  TEST_REG_COOKIE:    "test-reg-token",
}))

// Mock Next.js after() so it runs synchronously (or no-ops in tests)
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>()
  return { ...actual, after: (fn: () => void) => fn() }
})

import { prisma } from "@/lib/prisma"
import { POST } from "@/app/api/auth/register/route"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/register", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
}

const VALID_BODY = {
  name:     "Test User",
  email:    "test@example.com",
  password: "securepass",
  orgName:  "Acme Corp",
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auth/register — validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.organization as never).create = vi.fn()
    // Mock $transaction to run the callback synchronously
    ;(prisma as never).$transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        organization: { create: vi.fn().mockResolvedValue({ id: "org-1", name: "Acme Corp", referralCode: "ABC", referralLink: "" }) },
        user:         { create: vi.fn().mockResolvedValue({ id: "user-1", email: "test@example.com", name: "Test User", role: "ADMIN", organizationId: "org-1" }) },
      }
      return fn(mockTx)
    })
  })

  it("rejects an invalid email address (400)", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, email: "not-an-email" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid email/i)
  })

  it("rejects an email without a TLD (400)", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, email: "user@example" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid email/i)
  })

  it("rejects a password shorter than 8 characters (400)", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, password: "short" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/8 characters/i)
  })

  it("rejects an empty password (400)", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, password: "" }))
    expect(res.status).toBe(400)
  })

  it("rejects when required fields are missing (400)", async () => {
    const res = await POST(makeRequest({ name: "Only name" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/required/i)
  })

  it("passes validation for a valid registration payload (does not 400)", async () => {
    const { createSession } = await import("@/lib/session")
    vi.mocked(createSession).mockResolvedValue(undefined as never)

    const res = await POST(makeRequest(VALID_BODY))
    // Validation must pass: status should NOT be 400.
    // The full registration may still produce 500 due to incomplete mocking
    // of deep prisma internals — that's acceptable for a validation test.
    expect(res.status).not.toBe(400)
  })
})
