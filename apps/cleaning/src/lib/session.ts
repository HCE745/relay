import "server-only"
import {
  signJwt,
  verifyJwt,
  encodeSecret,
  setSessionCookie,
  getSessionToken,
  deleteSessionCookie,
} from "@hce/auth"

// Cleaning's own cookie + secret — fully isolated from Relay's `session` cookie
// and SESSION_SECRET. No shared secret, no cross-app session bleed.
const COOKIE_NAME = "cln_session"

function getSecret() {
  const secret = process.env.CLEANING_SESSION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CLEANING_SESSION_SECRET is not set")
    }
    // Dev-only fallback so `next dev` works before secrets are configured.
    return encodeSecret("cleaning-dev-secret-change-me-in-production-32ch")
  }
  return encodeSecret(secret)
}

export type SessionPayload = {
  userId: string
  email: string
  name: string
  role: string
  organizationId: string
  packageTier: string
  onboardingCompleted?: boolean
  isDemo?: boolean // set only for public sandbox demo sessions (separate cookie)
  exp?: number
}

export async function createSession(payload: SessionPayload) {
  const token = await signJwt(payload as unknown as Record<string, unknown>, getSecret(), {
    expiresIn: "7d",
  })
  await setSessionCookie(COOKIE_NAME, token, {
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = await getSessionToken(COOKIE_NAME)
  if (token) {
    const s = await verifyJwt<SessionPayload>(token, getSecret())
    // A real staff token must never carry the demo flag.
    if (s && !s.isDemo) return s
  }
  // Fall back to a public sandbox demo session (own cookie + secret). The whole
  // admin app then renders for the demo OWNER, scoped to their demo org.
  const { getDemoSession } = await import("./demo-session")
  return getDemoSession()
}

export async function deleteSession() {
  await deleteSessionCookie(COOKIE_NAME)
}

export const SESSION_COOKIE_NAME = COOKIE_NAME
