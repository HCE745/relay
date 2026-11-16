import crypto from "crypto"
import { systemDb } from "../org-db"

// Email-verification tokens (Phase E). Mirrors auth-tokens.ts: only the SHA-256
// hash is stored; the raw token lives only in the emailed link and is single-use
// + expiring. Verification happens before the account is usable, so these run on
// systemDb (cross-org by nature) but are keyed solely by the unguessable token —
// a token can never target another account.
//
// A self-registered owner is created INACTIVE; consuming the token flips the user
// to active (there is no separate emailVerifiedAt column — isActive IS the gate,
// and authenticate() already rejects inactive users). This keeps Phase E free of
// any schema migration.

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

/** Issue a fresh verification token for a user. Returns the RAW token (for the
 *  emailed link); only its hash is persisted. */
export async function createEmailVerification(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex")
  await systemDb.emailVerificationToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS) },
  })
  return token
}

export type VerifyResult =
  | { ok: true; alreadyVerified: boolean }
  | { ok: false }

/**
 * Consume a verification token: activate the user (if not already) and burn this
 * and any other outstanding tokens for them. Idempotent for an already-active
 * user presenting a still-valid link (returns alreadyVerified). Returns ok:false
 * for an unknown, used, or expired token.
 */
export async function consumeEmailVerification(token: string): Promise<VerifyResult> {
  const rec = await systemDb.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, isActive: true } } },
  })
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return { ok: false }

  const alreadyVerified = rec.user.isActive
  await systemDb.$transaction([
    systemDb.user.update({ where: { id: rec.userId }, data: { isActive: true } }),
    systemDb.emailVerificationToken.updateMany({
      where: { userId: rec.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ])
  return { ok: true, alreadyVerified }
}
