import { describe, it, expect, vi, beforeEach } from "vitest"

// Email verification token lifecycle (Phase E). systemDb is mocked. Proves a
// valid token activates the owner once (and is idempotent for an already-active
// user), and that unknown / used / expired tokens are refused and never activate
// anyone — the isActive flag IS the "email verified" gate.

const tokenFindUnique = vi.fn()
const tokenCreate = vi.fn()
const tokenUpdateMany = vi.fn()
const userUpdate = vi.fn()
const txCalls: unknown[][] = []

vi.mock("../../org-db", () => ({
  systemDb: {
    emailVerificationToken: {
      findUnique: (...a: unknown[]) => tokenFindUnique(...a),
      create: (...a: unknown[]) => tokenCreate(...a),
      updateMany: (...a: unknown[]) => tokenUpdateMany(...a),
    },
    user: { update: (...a: unknown[]) => userUpdate(...a) },
    $transaction: async (ops: unknown[]) => {
      txCalls.push(ops)
      return ops
    },
  },
}))

import { consumeEmailVerification, createEmailVerification } from "../email-verification"

beforeEach(() => {
  tokenFindUnique.mockReset()
  tokenCreate.mockReset().mockResolvedValue({})
  tokenUpdateMany.mockReset().mockReturnValue({})
  userUpdate.mockReset().mockReturnValue({})
  txCalls.length = 0
})

const future = () => new Date(Date.now() + 60 * 60 * 1000)
const past = () => new Date(Date.now() - 60 * 60 * 1000)

describe("consumeEmailVerification", () => {
  it("activates an inactive owner and reports not-already-verified", async () => {
    tokenFindUnique.mockResolvedValue({ userId: "u1", usedAt: null, expiresAt: future(), user: { id: "u1", isActive: false } })
    const r = await consumeEmailVerification("rawtoken")
    expect(r).toEqual({ ok: true, alreadyVerified: false })
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { isActive: true } })
    expect(txCalls).toHaveLength(1) // activation + token burn ran in one transaction
  })

  it("is idempotent for an already-active user (alreadyVerified)", async () => {
    tokenFindUnique.mockResolvedValue({ userId: "u1", usedAt: null, expiresAt: future(), user: { id: "u1", isActive: true } })
    expect(await consumeEmailVerification("rawtoken")).toEqual({ ok: true, alreadyVerified: true })
  })

  it("refuses an unknown token without touching anyone", async () => {
    tokenFindUnique.mockResolvedValue(null)
    expect(await consumeEmailVerification("bad")).toEqual({ ok: false })
    expect(userUpdate).not.toHaveBeenCalled()
    expect(txCalls).toHaveLength(0)
  })

  it("refuses an already-used token", async () => {
    tokenFindUnique.mockResolvedValue({ userId: "u1", usedAt: new Date(), expiresAt: future(), user: { id: "u1", isActive: false } })
    expect(await consumeEmailVerification("used")).toEqual({ ok: false })
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it("refuses an expired token", async () => {
    tokenFindUnique.mockResolvedValue({ userId: "u1", usedAt: null, expiresAt: past(), user: { id: "u1", isActive: false } })
    expect(await consumeEmailVerification("stale")).toEqual({ ok: false })
    expect(userUpdate).not.toHaveBeenCalled()
  })
})

describe("createEmailVerification", () => {
  it("returns a 64-hex raw token and stores only its hash", async () => {
    const token = await createEmailVerification("u1")
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    const stored = tokenCreate.mock.calls[0][0].data
    expect(stored.userId).toBe("u1")
    expect(stored.tokenHash).not.toBe(token) // hash, never the raw token
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })
})
