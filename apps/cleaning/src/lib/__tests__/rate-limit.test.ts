import { describe, it, expect, beforeEach } from "vitest"
import { takeToken, enforceIpBurst, enforceOrgBurst, resetRateLimiter, BURST_LIMITS } from "../rate-limit"
import { clientIpFromHeaders, IntakeRejected } from "../public-intake"

beforeEach(() => resetRateLimiter())

describe("takeToken (token bucket)", () => {
  it("allows up to capacity immediately, then blocks (burst)", () => {
    const cfg = { capacity: 3, refillPerMs: 0 }
    const now = 1_000_000
    expect([0, 1, 2].map(() => takeToken("k", cfg, now))).toEqual([true, true, true])
    expect(takeToken("k", cfg, now)).toBe(false) // 4th blocked
  })

  it("refills over time at the sustained rate", () => {
    const cfg = { capacity: 1, refillPerMs: 1 / 1000 } // 1 token/sec
    const t0 = 2_000_000
    expect(takeToken("k", cfg, t0)).toBe(true)
    expect(takeToken("k", cfg, t0)).toBe(false) // empty
    expect(takeToken("k", cfg, t0 + 1000)).toBe(true) // +1s refilled one token
  })

  it("isolates keys", () => {
    const cfg = { capacity: 1, refillPerMs: 0 }
    const now = 3_000_000
    expect(takeToken("a", cfg, now)).toBe(true)
    expect(takeToken("b", cfg, now)).toBe(true) // different key unaffected
    expect(takeToken("a", cfg, now)).toBe(false)
  })
})

describe("enforce guards", () => {
  it("enforceIpBurst throws rate_limit after the IP burst is spent", () => {
    const now = 4_000_000
    for (let i = 0; i < BURST_LIMITS.ip.capacity; i++) enforceIpBurst("1.2.3.4", now)
    try {
      enforceIpBurst("1.2.3.4", now)
      throw new Error("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(IntakeRejected)
      expect((e as IntakeRejected).code).toBe("rate_limit")
    }
  })

  it("enforceOrgBurst throws capacity after the org burst is spent", () => {
    const now = 5_000_000
    for (let i = 0; i < BURST_LIMITS.org.capacity; i++) enforceOrgBurst("org1", now)
    expect(() => enforceOrgBurst("org1", now)).toThrow(IntakeRejected)
  })
})

describe("clientIpFromHeaders (anti-spoofing)", () => {
  const h = (o: Record<string, string>) => new Headers(o)

  it("prefers the Vercel-set header over a spoofed x-forwarded-for", () => {
    expect(clientIpFromHeaders(h({ "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("9.9.9.9")
  })

  it("falls back to x-real-ip (also platform-set)", () => {
    expect(clientIpFromHeaders(h({ "x-real-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1" }))).toBe("8.8.8.8")
  })

  it("with ONLY x-forwarded-for, takes the RIGHTMOST (closest trusted hop), not the client-controlled leftmost", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "6.6.6.6, 7.7.7.7" }))).toBe("7.7.7.7")
  })

  it("a rotating leftmost x-forwarded-for cannot change the identity when a trusted header is present", () => {
    const a = clientIpFromHeaders(h({ "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "10.0.0.1" }))
    const b = clientIpFromHeaders(h({ "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "10.0.0.2" }))
    expect(a).toBe(b)
  })
})
