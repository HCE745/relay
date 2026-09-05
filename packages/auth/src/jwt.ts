// Framework-agnostic JWT primitives shared by all HCE apps.
// No next/headers, no server-only — safe to use in any runtime (incl. edge).
// App-specific payload shapes, cookie names, and getSession logic live in
// each app; this module only knows how to sign and verify HS256 tokens.
import { SignJWT, jwtVerify } from "jose"

export type SignOptions = {
  /** jose expiration time, e.g. "7d". Omit to issue a token with no expiry. */
  expiresIn?: string
}

/** Encode a secret string into the key bytes jose expects. */
export function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

/** Sign an HS256 JWT with `iat` set (and `exp` when `expiresIn` is given). */
export async function signJwt(
  payload: Record<string, unknown>,
  secret: Uint8Array,
  opts: SignOptions = {},
): Promise<string> {
  let jwt = new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt()
  if (opts.expiresIn) jwt = jwt.setExpirationTime(opts.expiresIn)
  return jwt.sign(secret)
}

/** Verify an HS256 JWT. Returns the decoded payload, or null if invalid/expired. */
export async function verifyJwt<T>(token: string, secret: Uint8Array): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as T
  } catch {
    return null
  }
}
