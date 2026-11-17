import { describe, it, expect, vi, beforeEach } from "vitest"

// Trial provisioning + duplicate-account prevention (Phase E). systemDb is mocked
// so this is a fast unit test with no DB: it proves a self-serve signup creates a
// trialing org on the CHOSEN tier with an INACTIVE owner and a verification token,
// and that a taken email is refused BEFORE anything is written.

const findUnique = vi.fn()
const orgCreate = vi.fn()
const userCreate = vi.fn()
const tokenCreate = vi.fn()

vi.mock("../../org-db", () => ({
  systemDb: {
    user: { findUnique: (...a: unknown[]) => findUnique(...a) },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        organization: { create: (...a: unknown[]) => orgCreate(...a) },
        user: { create: (...a: unknown[]) => userCreate(...a) },
        emailVerificationToken: { create: (...a: unknown[]) => tokenCreate(...a) },
      }),
  },
}))

import { registerTrialCompany } from "../registration"
import { ConflictError } from "../errors"

const INPUT = { orgName: "Summit Facility Services", name: "Dana", email: "Dana@Summit.CO", password: "supersecret", timezone: "America/New_York" }

beforeEach(() => {
  findUnique.mockReset()
  orgCreate.mockReset().mockResolvedValue({ id: "org_1" })
  userCreate.mockReset().mockResolvedValue({ id: "user_1" })
  tokenCreate.mockReset().mockResolvedValue({})
})

describe("registerTrialCompany — trial creation", () => {
  it("creates a trialing org on the chosen tier with an inactive owner + token", async () => {
    findUnique.mockResolvedValue(null)
    const before = Date.now()
    const res = await registerTrialCompany({ ...INPUT, trialTier: "BUSINESS" })

    // Org: trialing, chosen tier, trialEndsAt ~14 days out.
    const orgData = orgCreate.mock.calls[0][0].data
    expect(orgData.packageTier).toBe("BUSINESS")
    expect(orgData.subscriptionStatus).toBe("trialing")
    expect(orgData.trialEndsAt.getTime()).toBeGreaterThan(before + 13 * 24 * 60 * 60 * 1000)
    expect(orgData.trialEndsAt.getTime()).toBeLessThan(before + 15 * 24 * 60 * 60 * 1000)

    // Owner: OWNER role, INACTIVE until verified, email normalized, password hashed.
    const userData = userCreate.mock.calls[0][0].data
    expect(userData.role).toBe("OWNER")
    expect(userData.isActive).toBe(false)
    expect(userData.email).toBe("dana@summit.co")
    expect(userData.password).not.toBe(INPUT.password)
    expect(userData.organizationId).toBe("org_1")

    // A hashed verification token is stored; the raw token is returned (64 hex).
    expect(tokenCreate.mock.calls[0][0].data.userId).toBe("user_1")
    expect(res.token).toMatch(/^[0-9a-f]{64}$/)
    expect(res.email).toBe("dana@summit.co")
  })

  it("defaults to Essentials (TEAM) when no tier is chosen", async () => {
    findUnique.mockResolvedValue(null)
    await registerTrialCompany(INPUT)
    expect(orgCreate.mock.calls[0][0].data.packageTier).toBe("TEAM")
  })

  it("rejects an off-menu tier down to the default (never persists it)", async () => {
    findUnique.mockResolvedValue(null)
    await registerTrialCompany({ ...INPUT, trialTier: "ENTERPRISE" as never })
    expect(orgCreate.mock.calls[0][0].data.packageTier).toBe("TEAM")
  })
})

describe("registerTrialCompany — duplicate-account prevention", () => {
  it("throws ConflictError and writes nothing when the email is taken", async () => {
    findUnique.mockResolvedValue({ id: "existing" })
    await expect(registerTrialCompany(INPUT)).rejects.toBeInstanceOf(ConflictError)
    expect(orgCreate).not.toHaveBeenCalled()
    expect(userCreate).not.toHaveBeenCalled()
    expect(tokenCreate).not.toHaveBeenCalled()
  })
})
