import { describe, it, expect, vi, beforeEach } from "vitest"
import bcrypt from "bcryptjs"

// Regression for the staff-login credential gate (auth-core.authenticate).
// History: eleven demo accounts could once authenticate through the real login.
// This locks the three rejections — inactive, CLIENT (portal), and demo-org —
// and proves they fire BEFORE the password is ever checked. prisma is mocked so
// this is a fast, deterministic unit test with no DB.

const findUnique = vi.fn()
vi.mock("../prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }))

import { authenticate } from "../auth-core"

const PASSWORD = "correct-horse"
const hash = bcrypt.hashSync(PASSWORD, 10)

// A valid, loginable staff account unless a field is overridden per test.
function user(over: Record<string, unknown> = {}) {
  return {
    id: "u1", email: "a@b.co", name: "Al", role: "MANAGER", organizationId: "o1",
    password: hash, isActive: true,
    organization: { packageTier: "TEAM", onboardingCompletedAt: new Date(), isDemo: false },
    ...over,
  }
}

beforeEach(() => findUnique.mockReset())

describe("authenticate — rejections", () => {
  it("rejects an unknown email", async () => {
    findUnique.mockResolvedValue(null)
    expect(await authenticate("nobody@b.co", PASSWORD)).toEqual({ ok: false, error: "Invalid credentials" })
  })

  it("rejects an INACTIVE account (before password check)", async () => {
    findUnique.mockResolvedValue(user({ isActive: false }))
    const spy = vi.spyOn(bcrypt, "compare")
    expect(await authenticate("a@b.co", PASSWORD)).toEqual({ ok: false, error: "Invalid credentials" })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it("rejects a CLIENT (portal) account with a portal hint", async () => {
    findUnique.mockResolvedValue(user({ role: "CLIENT" }))
    const r = await authenticate("a@b.co", PASSWORD)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/customer portal/i)
  })

  it("rejects a DEMO-org account even with a correct password (before password check)", async () => {
    findUnique.mockResolvedValue(user({ organization: { packageTier: "TEAM", onboardingCompletedAt: new Date(), isDemo: true } }))
    const spy = vi.spyOn(bcrypt, "compare")
    const r = await authenticate("a@b.co", PASSWORD)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/demo/i)
    expect(spy).not.toHaveBeenCalled() // demo rejected before credentials are even tested
    spy.mockRestore()
  })

  it("rejects a wrong password for an otherwise-valid account", async () => {
    findUnique.mockResolvedValue(user())
    expect(await authenticate("a@b.co", "wrong")).toEqual({ ok: false, error: "Invalid credentials" })
  })
})

describe("authenticate — success", () => {
  it("accepts an active, non-CLIENT, non-demo account with the right password", async () => {
    findUnique.mockResolvedValue(user())
    const r = await authenticate("a@b.co", PASSWORD)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.user).toMatchObject({ id: "u1", email: "a@b.co", role: "MANAGER", organizationId: "o1", packageTier: "TEAM", onboardingCompleted: true })
      expect(r.user).not.toHaveProperty("password") // never leak the hash
    }
  })
})
