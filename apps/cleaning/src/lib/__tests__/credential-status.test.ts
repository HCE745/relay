import { describe, it, expect } from "vitest"
import { credentialState, satisfiesRequirement } from "../credential-status"

const now = new Date("2026-06-01T00:00:00Z")
const d = (s: string) => new Date(`${s}T00:00:00Z`)

describe("credentialState", () => {
  it("REVOKED regardless of date", () => {
    expect(credentialState({ status: "REVOKED", expiryDate: d("2030-01-01") }, 30, now)).toBe("REVOKED")
  })
  it("ACTIVE with no expiry", () => {
    expect(credentialState({ status: "ACTIVE", expiryDate: null }, 30, now)).toBe("ACTIVE")
  })
  it("EXPIRED once past the expiry date", () => {
    expect(credentialState({ status: "ACTIVE", expiryDate: d("2026-05-31") }, 30, now)).toBe("EXPIRED")
  })
  it("EXPIRING within the lead window", () => {
    expect(credentialState({ status: "ACTIVE", expiryDate: d("2026-06-20") }, 30, now)).toBe("EXPIRING")
  })
  it("ACTIVE beyond the lead window", () => {
    expect(credentialState({ status: "ACTIVE", expiryDate: d("2026-09-01") }, 30, now)).toBe("ACTIVE")
  })
})

describe("satisfiesRequirement", () => {
  it("active and expiring satisfy (not yet expired)", () => {
    expect(satisfiesRequirement({ status: "ACTIVE", expiryDate: d("2026-06-20") }, now)).toBe(true)
    expect(satisfiesRequirement({ status: "ACTIVE", expiryDate: null }, now)).toBe(true)
  })
  it("expired and revoked do not satisfy", () => {
    expect(satisfiesRequirement({ status: "ACTIVE", expiryDate: d("2026-05-31") }, now)).toBe(false)
    expect(satisfiesRequirement({ status: "REVOKED", expiryDate: d("2030-01-01") }, now)).toBe(false)
  })
})
