import { describe, it, expect } from "vitest"
import { verifyStripeSignature, signStripePayload } from "../stripe"

// SECURITY (Phase 22): the Stripe webhook is public + unauthenticated, so
// signature verification is the only thing standing between an attacker and a
// forged "payment succeeded". These tests prove unsigned / wrong / stale
// signatures are rejected and a correctly-signed one is accepted.

const SECRET = "whsec_test_secret"
const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { amount_total: 5000 } } })
const now = 1_000_000

describe("verifyStripeSignature", () => {
  it("accepts a correctly-signed, fresh payload", () => {
    const header = signStripePayload(body, SECRET, now)
    expect(verifyStripeSignature(body, header, { secret: SECRET, nowSec: now })).toBe(true)
  })

  it("REJECTS a missing signature header", () => {
    expect(verifyStripeSignature(body, null, { secret: SECRET, nowSec: now })).toBe(false)
  })

  it("REJECTS a wrong signature (signed with a different secret)", () => {
    const forged = signStripePayload(body, "whsec_attacker", now)
    expect(verifyStripeSignature(body, forged, { secret: SECRET, nowSec: now })).toBe(false)
  })

  it("REJECTS a tampered body under a valid-looking signature", () => {
    const header = signStripePayload(body, SECRET, now)
    const tampered = body.replace("5000", "500000")
    expect(verifyStripeSignature(tampered, header, { secret: SECRET, nowSec: now })).toBe(false)
  })

  it("REJECTS a stale timestamp outside the tolerance window (replay)", () => {
    const header = signStripePayload(body, SECRET, now - 10_000)
    expect(verifyStripeSignature(body, header, { secret: SECRET, nowSec: now, toleranceSec: 300 })).toBe(false)
  })

  it("REJECTS when no endpoint secret is configured", () => {
    const header = signStripePayload(body, SECRET, now)
    expect(verifyStripeSignature(body, header, { secret: undefined, nowSec: now })).toBe(false)
  })

  it("REJECTS a malformed header", () => {
    expect(verifyStripeSignature(body, "garbage", { secret: SECRET, nowSec: now })).toBe(false)
    expect(verifyStripeSignature(body, "t=abc,v1=", { secret: SECRET, nowSec: now })).toBe(false)
  })
})
