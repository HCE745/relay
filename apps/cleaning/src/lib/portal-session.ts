import "server-only"
import { signJwt, verifyJwt, encodeSecret, setSessionCookie, getSessionToken, deleteSessionCookie } from "@hce/auth"

// The customer portal is a SEPARATE trust boundary from the staff app. It uses
// its own cookie so a portal token can never be mistaken for a staff session
// (and vice-versa), and carries the customerId the user is scoped to.
const COOKIE_NAME = "cln_portal"

function getSecret() {
  const secret = process.env.CLEANING_SESSION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("CLEANING_SESSION_SECRET is not set")
    return encodeSecret("cleaning-dev-secret-change-me-in-production-32ch")
  }
  // Domain-separate the portal secret from the staff secret.
  return encodeSecret(`portal:${secret}`)
}

export type PortalSession = {
  userId: string
  email: string
  name: string
  customerId: string
  organizationId: string
  role: "CLIENT"
  exp?: number
}

export async function createPortalSession(payload: Omit<PortalSession, "role">) {
  const token = await signJwt({ ...payload, role: "CLIENT" }, getSecret(), { expiresIn: "7d" })
  await setSessionCookie(COOKIE_NAME, token, { secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7 })
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const token = await getSessionToken(COOKIE_NAME)
  if (!token) return null
  const s = await verifyJwt<PortalSession>(token, getSecret())
  // A valid token must be a CLIENT bound to a customer — never a staff token.
  if (!s || s.role !== "CLIENT" || !s.customerId) return null
  return s
}

export async function deletePortalSession() {
  await deleteSessionCookie(COOKIE_NAME)
}

export const PORTAL_COOKIE_NAME = COOKIE_NAME
