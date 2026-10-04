import { describe, it, expect, beforeAll } from "vitest"
import { encryptSecret, decryptSecret, isSecretConfigured } from "../secret-crypto"

beforeAll(() => {
  process.env.ACCESS_ENCRYPTION_KEY = "test-key-for-unit-tests"
})

describe("secret-crypto (AES-256-GCM)", () => {
  it("reports configured when a key is set", () => {
    expect(isSecretConfigured()).toBe(true)
  })
  it("round-trips a secret", () => {
    const blob = encryptSecret("1234#alarm")
    expect(blob).toBeTruthy()
    expect(blob).toMatch(/^v1:/)
    expect(blob).not.toContain("1234#alarm") // ciphertext does not leak plaintext
    expect(decryptSecret(blob!)).toBe("1234#alarm")
  })
  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same")
    const b = encryptSecret("same")
    expect(a).not.toBe(b)
    expect(decryptSecret(a!)).toBe("same")
    expect(decryptSecret(b!)).toBe("same")
  })
  it("fails to decrypt a tampered blob (auth tag)", () => {
    const blob = encryptSecret("secret")!
    const parts = blob.split(":")
    parts[3] = Buffer.from("tampered").toString("base64")
    expect(decryptSecret(parts.join(":"))).toBeNull()
  })
  it("returns null without a key", () => {
    const saved = process.env.ACCESS_ENCRYPTION_KEY
    delete process.env.ACCESS_ENCRYPTION_KEY
    expect(isSecretConfigured()).toBe(false)
    expect(encryptSecret("x")).toBeNull()
    process.env.ACCESS_ENCRYPTION_KEY = saved
  })
})
