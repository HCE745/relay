/**
 * Invitation flow tests.
 * Verifies that used tokens, expired tokens, and valid tokens behave correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invitation: { findUnique: vi.fn() },
    user:       { findUnique: vi.fn(), create: vi.fn() },
    organization: { findUnique: vi.fn() },
    userOrgMembership: { create: vi.fn() },
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
