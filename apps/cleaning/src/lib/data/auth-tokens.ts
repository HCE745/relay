import crypto from "crypto"
import bcrypt from "bcryptjs"
import { systemDb } from "../org-db"

// Password reset tokens. Only the SHA-256 hash is stored; the raw token exists
// only in the emailed link and is single-use + expiring. Reset happens before
// authentication, so these operations use systemDb (cross-org by nature) but
// are keyed solely by the unguessable token — a token can never target another
// account, and outstanding tokens are invalidated on use.

const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export async function createPasswordReset(email: string): Promise<{ email: string; name: string; token: string } | null> {
  const user = await systemDb.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true, isActive: true },
  })
  if (!user || !user.isActive) return null // do not reveal which; caller returns generic success

  const token = crypto.randomBytes(32).toString("hex")
  await systemDb.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  })
  return { email: user.email, name: user.name, token }
}

export async function consumePasswordReset(token: string, newPassword: string): Promise<boolean> {
  const rec = await systemDb.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, isActive: true } } },
  })
  if (!rec || rec.usedAt || rec.expiresAt < new Date() || !rec.user.isActive) return false

  const hashed = await bcrypt.hash(newPassword, 10)
  await systemDb.$transaction([
    systemDb.user.update({ where: { id: rec.userId }, data: { password: hashed } }),
    // Invalidate this and any other outstanding tokens for the user.
    systemDb.passwordResetToken.updateMany({ where: { userId: rec.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ])
  return true
}

/** Authenticated password change — verifies the current password first. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
  const user = await systemDb.user.findUnique({ where: { id: userId }, select: { password: true } })
  if (!user) return false
  const ok = await bcrypt.compare(currentPassword, user.password)
  if (!ok) return false
  await systemDb.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(newPassword, 10) } })
  return true
}
