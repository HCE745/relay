import { createHmac, timingSafeEqual } from "crypto"

export const TEST_REG_COOKIE = "relay-test-reg"
export const TOKEN_MAX_AGE   = 30 * 60 // 30 minutes in seconds

function deriveKey(): string {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error("SESSION_SECRET is required")
  return `test-reg:${s}`
}

export function createTestRegToken(): string {
  const exp     = Date.now() + TOKEN_MAX_AGE * 1000
  const payload = exp.toString(36)
  const sig     = createHmac("sha256", deriveKey()).update(payload).digest("hex")
  return `${payload}.${sig}`
}

export function verifyTestRegToken(token: string | undefined | null): boolean {
  if (!token) return false
  try {
    const dot = token.indexOf(".")
    if (dot < 1) return false
    const payload = token.slice(0, dot)
    const sig     = token.slice(dot + 1)
    if (!payload || !sig) return false
    const exp = parseInt(payload, 36)
    if (isNaN(exp) || Date.now() > exp) return false
    const expected = createHmac("sha256", deriveKey()).update(payload).digest("hex")
    const a = Buffer.from(expected, "hex")
    const b = Buffer.from(sig,      "hex")
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
