/**
 * Subscription enforcement guard tests.
 * Verifies that POST/PUT/DELETE on core write endpoints return 402 when the
 * organization's subscription is in a blocked state, and pass through when
 * the subscription allows writes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}))

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
  },
}))

import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { requireActiveSubscription } from "@/lib/subscription-guard"

const SESSION = {
  userId:         "user-1",
  organizationId: "org-1",
  email:          "admin@example.com",
  name:           "Admin",
  role:           "ADMIN",
}

// ── Helper ────────────────────────────────────────────────────────────────────

function mockSession(overrides = {}) {
  vi.mocked(getSession).mockResolvedValue({ ...SESSION, ...overrides } as never)
}

function mockOrgStatus(status: string | null, trialStartDate?: Date | null) {
  vi.mocked(prisma.organization.findUnique).mockResolvedValue(
    { subscriptionStatus: status, trialStartDate: trialStartDate ?? null } as never
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("requireActiveSubscription", () => {
  beforeEach(() => { vi.clearAllMocks() })

  // Statuses that must be blocked
  const BLOCKED = ["expired", "read_only", "canceled", "incomplete_expired", "paused"]

  for (const status of BLOCKED) {
    it(`returns 402 for status "${status}"`, async () => {
      mockSession()
      mockOrgStatus(status)

      const result = await requireActiveSubscription()

      expect(result).not.toBeNull()
      expect(result!.status).toBe(402)
      const body = await result!.json()
      expect(body.code).toBe("SUBSCRIPTION_REQUIRED")
    })
  }

  // Statuses that must pass through
  const ALLOWED = ["active", "trialing", "past_due", "incomplete", null, undefined]

  for (const status of ALLOWED) {
    it(`returns null (allows writes) for status "${status ?? "null/undefined"}"`, async () => {
      mockSession()
      mockOrgStatus(status ?? null)

      const result = await requireActiveSubscription()

      expect(result).toBeNull()
    })
  }

  // Future trialStartDate blocks access even when status is "trialing"
  it("returns 402 (TRIAL_NOT_STARTED) when trialing and trialStartDate is in the future", async () => {
    mockSession()
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    mockOrgStatus("trialing", futureDate)

    const result = await requireActiveSubscription()

    expect(result).not.toBeNull()
    expect(result!.status).toBe(402)
    const body = await result!.json()
    expect(body.code).toBe("TRIAL_NOT_STARTED")
  })

  it("returns null (allows writes) when trialing and trialStartDate is in the past", async () => {
    mockSession()
    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    mockOrgStatus("trialing", pastDate)

    const result = await requireActiveSubscription()

    expect(result).toBeNull()
  })

  it("returns null (allows writes) when trialing and trialStartDate is null", async () => {
    mockSession()
    mockOrgStatus("trialing", null)

    const result = await requireActiveSubscription()

    expect(result).toBeNull()
  })

  it("returns 401 when there is no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never)

    const result = await requireActiveSubscription()

    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it("returns 404 when the organization does not exist", async () => {
    mockSession()
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null)

    const result = await requireActiveSubscription()

    expect(result).not.toBeNull()
    expect(result!.status).toBe(404)
  })
})
