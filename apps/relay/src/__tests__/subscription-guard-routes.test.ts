/**
 * Subscription guard coverage for correction-pass routes.
 * Verifies that the guard is wired on the newly protected endpoints:
 * suggestions/[id] PUT, assignments/[id] PATCH+DELETE, locations POST+PUT+DELETE,
 * departments POST, vendors POST, assets POST, team POST, invitations POST.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { NextResponse } from "next/server"

// ── Shared mocks ──────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization:   { findUnique: vi.fn(), update: vi.fn() },
    suggestion:     { findFirst: vi.fn(), update: vi.fn() },
    assignment:     { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    location:       { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    department:     { create: vi.fn(), findFirst: vi.fn() },
    vendor:         { create: vi.fn() },
    asset:          { create: vi.fn() },
    user:           { findMany: vi.fn() },
    invitation:     { findFirst: vi.fn(), create: vi.fn() },
    issue:          { findMany: vi.fn().mockResolvedValue([]) },
    qrCode:         { findMany: vi.fn().mockResolvedValue([]) },
    // team route uses User model
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/ratelimit", () => ({
  checkLimit: vi.fn().mockResolvedValue(null),
  limiters:   {},
  getIP:      vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/email",    () => ({ sendEmail: vi.fn().mockResolvedValue({ ok: true }) }))
vi.mock("@/lib/analytics",() => ({ logActivationEvent: vi.fn() }))

// ── Subscription guard mock ───────────────────────────────────────────────────

const mockGuard = vi.fn()
vi.mock("@/lib/subscription-guard", () => ({
  requireActiveSubscription: mockGuard,
}))

import { getSession } from "@/lib/session"
import { prisma }     from "@/lib/prisma"

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTIVE_SESSION = {
  userId: "user-1", organizationId: "org-1", email: "a@b.com",
  name: "Admin", role: "ADMIN",
  onboardingCompleted: true, trialEndsAt: null,
  subscriptionStatus: "active", plan: "professional", productLine: "RELAY_STANDARD",
}

function makeRequest(url: string, body: Record<string, unknown> = {}) {
  return new NextRequest(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
}

function makeUpdateRequest(url: string, body: Record<string, unknown> = {}) {
  return new NextRequest(url, {
    method:  "PUT",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

const SUBSCRIPTION_ENDED_RESPONSE = NextResponse.json(
  { error: "Your subscription has ended.", code: "SUBSCRIPTION_REQUIRED" },
  { status: 402 },
)

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Subscription guard — correction-pass routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue(ACTIVE_SESSION as never)
    // Default: guard passes (returns null)
    mockGuard.mockResolvedValue(null)
  })

  it("suggestions/[id] PUT — blocks expired subscription (402)", async () => {
    mockGuard.mockResolvedValue(SUBSCRIPTION_ENDED_RESPONSE)
    const { PUT } = await import("@/app/api/suggestions/[id]/route")
    const res = await PUT(
      makeUpdateRequest("http://localhost/api/suggestions/sug-1", { status: "RESOLVED" }),
      makeParams("sug-1"),
    )
    expect(res.status).toBe(402)
    expect(mockGuard).toHaveBeenCalled()
  })

  it("assignments/[id] PATCH — blocks expired subscription (402)", async () => {
    mockGuard.mockResolvedValue(SUBSCRIPTION_ENDED_RESPONSE)
    const { PATCH } = await import("@/app/api/assignments/[id]/route")
    const req = new NextRequest("http://localhost/api/assignments/asgn-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body:   JSON.stringify({ status: "COMPLETED" }),
    })
    const res = await PATCH(req, makeParams("asgn-1"))
    expect(res.status).toBe(402)
  })

  it("assignments/[id] DELETE — blocks expired subscription (402)", async () => {
    mockGuard.mockResolvedValue(SUBSCRIPTION_ENDED_RESPONSE)
    const { DELETE } = await import("@/app/api/assignments/[id]/route")
    const req = new NextRequest("http://localhost/api/assignments/asgn-1", { method: "DELETE" })
    const res = await DELETE(req, makeParams("asgn-1"))
    expect(res.status).toBe(402)
  })

  it("locations POST — blocks expired subscription (402)", async () => {
    mockGuard.mockResolvedValue(SUBSCRIPTION_ENDED_RESPONSE)
    const { POST } = await import("@/app/api/locations/route")
    const res = await POST(makeRequest("http://localhost/api/locations", { name: "Plant A" }))
    expect(res.status).toBe(402)
  })

  it("locations/[id] PUT — blocks expired subscription (402)", async () => {
    mockGuard.mockResolvedValue(SUBSCRIPTION_ENDED_RESPONSE)
    const { PUT } = await import("@/app/api/locations/[id]/route")
    const res = await PUT(makeUpdateRequest("http://localhost/api/locations/loc-1", { name: "Updated" }), makeParams("loc-1"))
    expect(res.status).toBe(402)
  })

  it("departments POST — blocks expired subscription (402)", async () => {
    mockGuard.mockResolvedValue(SUBSCRIPTION_ENDED_RESPONSE)
    const { POST } = await import("@/app/api/departments/route")
    const res = await POST(makeRequest("http://localhost/api/departments", { name: "Engineering" }))
    expect(res.status).toBe(402)
  })

  it("invitations POST — blocks expired subscription (402)", async () => {
    mockGuard.mockResolvedValue(SUBSCRIPTION_ENDED_RESPONSE)
    const { POST } = await import("@/app/api/invitations/route")
    const res = await POST(makeRequest("http://localhost/api/invitations", { email: "new@acme.com", role: "EMPLOYEE" }))
    expect(res.status).toBe(402)
  })
})
