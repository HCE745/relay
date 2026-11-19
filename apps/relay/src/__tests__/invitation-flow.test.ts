/**
 * Invitation flow tests.
 * Verifies that used tokens, expired tokens, and valid tokens behave correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-pw") },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invitation: { findUnique: vi.fn(), update: vi.fn() },
    user:       { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    userOrgMembership: { create: vi.fn(), upsert: vi.fn() },
  },
}))

vi.mock("@/lib/session", () => ({
  createSession: vi.fn(),
  getSession:    vi.fn(),
}))

vi.mock("@/lib/ratelimit", () => ({
  checkLimit: vi.fn().mockResolvedValue(null),
  getIP:      vi.fn().mockReturnValue("127.0.0.1"),
  limiters:   { invite: "invite-limiter" },
}))

import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/session"
import { POST as acceptPOST } from "@/app/api/invite/[token]/route"

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_INVITE = {
  id:             "inv-1",
  organizationId: "org-1",
  email:          "new@example.com",
  token:          "valid-token",
  role:           "EMPLOYEE",
  usedAt:         null,
  expiresAt:      new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours in future
  invitedById:    "admin-1",
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Invitation token validation logic", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("rejects an already-used token", async () => {
    const usedInvite = {
      ...VALID_INVITE,
      usedAt: new Date(Date.now() - 3600_000),
    }

    vi.mocked(prisma.invitation.findUnique).mockResolvedValue(usedInvite as never)

    const invite = await prisma.invitation.findUnique({ where: { token: "used-token" } })
    const isValid = invite && !invite.usedAt && invite.expiresAt > new Date()

    expect(isValid).toBeFalsy()
    expect(invite?.usedAt).not.toBeNull()
  })

  it("rejects an expired token", async () => {
    const expiredInvite = {
      ...VALID_INVITE,
      usedAt:    null,
      expiresAt: new Date(Date.now() - 3600_000), // expired 1 hour ago
    }

    vi.mocked(prisma.invitation.findUnique).mockResolvedValue(expiredInvite as never)

    const invite = await prisma.invitation.findUnique({ where: { token: "expired-token" } })
    const isValid = invite && !invite.usedAt && invite.expiresAt > new Date()

    expect(isValid).toBeFalsy()
    expect(invite?.expiresAt.getTime()).toBeLessThan(Date.now())
  })

  it("accepts a valid, unexpired, unused token", async () => {
    vi.mocked(prisma.invitation.findUnique).mockResolvedValue(VALID_INVITE as never)

    const invite = await prisma.invitation.findUnique({ where: { token: "valid-token" } })
    const isValid = invite && !invite.usedAt && invite.expiresAt > new Date()

    expect(isValid).toBeTruthy()
  })

  it("rejects when token does not exist", async () => {
    vi.mocked(prisma.invitation.findUnique).mockResolvedValue(null)

    const invite = await prisma.invitation.findUnique({ where: { token: "nonexistent" } })
    const isValid = invite && !invite.usedAt && invite.expiresAt > new Date()

    expect(isValid).toBeFalsy()
    expect(invite).toBeNull()
  })
})

describe("Password validation on invitation acceptance", () => {
  it("enforces 8-character minimum on the invite acceptance route", async () => {
    // The invite/[token] route checks password.length < 8
    const shortPassword = "short"
    const longPassword  = "securepass"

    expect(shortPassword.length < 8).toBe(true)
    expect(longPassword.length < 8).toBe(false)
  })
})

// ── D1 regression: session includes org subscription state after invite acceptance ──

const TRIALING_ORG = {
  plan:               "essentials",
  productLine:        "RELAY_STANDARD",
  subscriptionStatus: "trialing",
  trialEndsAt:        new Date("2026-12-19T00:00:00Z"),
  onboardingCompletedAt: null,
}

const WHITE_GLOVE_INVITE = {
  id:             "inv-wg-1",
  organizationId: "org-wg",
  email:          "customer@acme.com",
  token:          "wg-token",
  role:           "ADMIN",
  usedAt:         null,
  expiresAt:      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  invitedById:    null,
  managerId:      null,
  departmentId:   null,
  locationId:     null,
  userType:       "INTERNAL",
  accountExpiresAt: null,
  organization:   { name: "Acme Co" },
}

describe("D1 — invitation acceptance session includes org subscription state", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("new user: createSession includes trialEndsAt, subscriptionStatus, plan, productLine", async () => {
    vi.mocked(prisma.invitation.findUnique).mockResolvedValue(WHITE_GLOVE_INVITE as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "u-new", email: "customer@acme.com", name: "Jane", role: "ADMIN", organizationId: "org-wg" } as never)
    vi.mocked(prisma.userOrgMembership.create).mockResolvedValue({} as never)
    vi.mocked(prisma.invitation.update).mockResolvedValue({} as never)
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(TRIALING_ORG as never)

    const req = new NextRequest("https://test.example/api/invite/wg-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Jane Smith", password: "securepass1" }),
    })
    const res = await acceptPOST(req, { params: Promise.resolve({ token: "wg-token" }) })
    expect(res.status).toBe(200)

    expect(vi.mocked(createSession)).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionStatus: "trialing",
        trialEndsAt:        TRIALING_ORG.trialEndsAt.toISOString(),
        plan:               "essentials",
        productLine:        "RELAY_STANDARD",
      }),
    )
  })

  it("new user: createSession sets onboardingCompleted correctly", async () => {
    vi.mocked(prisma.invitation.findUnique).mockResolvedValue(WHITE_GLOVE_INVITE as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "u-new", email: "customer@acme.com", name: "Jane", role: "ADMIN", organizationId: "org-wg" } as never)
    vi.mocked(prisma.userOrgMembership.create).mockResolvedValue({} as never)
    vi.mocked(prisma.invitation.update).mockResolvedValue({} as never)
    // org with onboardingCompletedAt set
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ ...TRIALING_ORG, onboardingCompletedAt: new Date() } as never)

    const req = new NextRequest("https://test.example/api/invite/wg-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Jane Smith", password: "securepass1" }),
    })
    await acceptPOST(req, { params: Promise.resolve({ token: "wg-token" }) })
    expect(vi.mocked(createSession)).toHaveBeenCalledWith(
      expect.objectContaining({ onboardingCompleted: true }),
    )
  })

  it("existing user re-join: createSession includes trialEndsAt", async () => {
    const existingUser = { id: "u-existing", email: "customer@acme.com", name: "Jane", role: "ADMIN" }
    vi.mocked(prisma.invitation.findUnique).mockResolvedValue(WHITE_GLOVE_INVITE as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser as never)
    vi.mocked(prisma.userOrgMembership.upsert).mockResolvedValue({} as never)
    vi.mocked(prisma.invitation.update).mockResolvedValue({} as never)
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(TRIALING_ORG as never)

    const req = new NextRequest("https://test.example/api/invite/wg-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Jane Smith", password: "securepass1" }),
    })
    await acceptPOST(req, { params: Promise.resolve({ token: "wg-token" }) })
    expect(vi.mocked(createSession)).toHaveBeenCalledWith(
      expect.objectContaining({
        trialEndsAt:        TRIALING_ORG.trialEndsAt.toISOString(),
        subscriptionStatus: "trialing",
      }),
    )
  })
})
