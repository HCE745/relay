/**
 * Onboarding location requirement tests.
 * Verifies that POST /api/onboarding rejects submissions with no valid location.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/session", () => ({
  getSession:    vi.fn(),
  createSession: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { update: vi.fn(), findUnique: vi.fn() },
    location:     { create: vi.fn() },
    department:   { findFirst: vi.fn(), create: vi.fn() },
    employeeType: { findFirst: vi.fn(), create: vi.fn() },
    user:         { findUnique: vi.fn() },
    invitation:   { findFirst: vi.fn(), create: vi.fn() },
    routingRule:  { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/email",                 () => ({ sendEmail: vi.fn().mockResolvedValue({ ok: true }) }))
vi.mock("@/lib/registration-crm-sync", () => ({
  updateOnboardingStatusInCrm: vi.fn().mockResolvedValue(undefined),
  resolveOnboardingFollowUps:  vi.fn().mockResolvedValue(undefined),
}))

import { getSession } from "@/lib/session"
import { POST } from "@/app/api/onboarding/route"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSession() {
  return {
    userId:         "user-1",
    organizationId: "org-1",
    email:          "admin@acme.com",
    name:           "Admin",
    role:           "ADMIN" as const,
    onboardingCompleted: false,
    trialEndsAt:    null,
    subscriptionStatus: "trialing",
    plan:           "professional",
    productLine:    "RELAY_STANDARD",
  }
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/onboarding", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/onboarding — location requirement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue(makeSession() as never)
  })

  it("rejects when locations array is empty (400)", async () => {
    const req = makeRequest({
      companyName: "Acme Corp",
      industry:    "Manufacturing",
      locations:   [],
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/location/i)
  })

  it("rejects when all location entries have blank names (400)", async () => {
    const req = makeRequest({
      companyName: "Acme Corp",
      industry:    "Manufacturing",
      locations:   [{ id: "l1", name: "", address: "", locationType: "" }],
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/location/i)
  })

  it("rejects when locations contain only whitespace names (400)", async () => {
    const req = makeRequest({
      companyName: "Acme Corp",
      industry:    "Manufacturing",
      locations:   [{ id: "l1", name: "   ", address: "", locationType: "" }],
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("passes validation when at least one location has a name (proceeds past 400)", async () => {
    const { prisma }        = await import("@/lib/prisma")
    const { createSession } = await import("@/lib/session")

    vi.mocked(createSession).mockResolvedValue(undefined as never)

    const mockOrg = { plan: "professional", productLine: "RELAY_STANDARD" }
    ;(prisma as never).$transaction = vi.fn().mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          organization: { update: vi.fn().mockResolvedValue(mockOrg), findUnique: vi.fn().mockResolvedValue({ name: "Acme Corp" }) },
          location:     { create: vi.fn().mockResolvedValue({}) },
          department:   { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
          employeeType: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
          user:         { findUnique: vi.fn().mockResolvedValue(null) },
          invitation:   { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
          routingRule:  { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
        }
        return fn(tx)
      },
    )

    const req = makeRequest({
      companyName: "Acme Corp",
      industry:    "Manufacturing",
      locations:   [{ id: "l1", name: "Plant A", address: "", locationType: "" }],
    })
    const res = await POST(req)
    // Must NOT be 400 — location validation should pass
    expect(res.status).not.toBe(400)
  })
})
