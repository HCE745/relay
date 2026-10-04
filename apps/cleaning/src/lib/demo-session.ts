import "server-only"
import { signJwt, verifyJwt, encodeSecret, setSessionCookie, getSessionToken, deleteSessionCookie } from "@hce/auth"
import type { SessionPayload } from "./session"

// Public sandbox demo sessions use their OWN cookie + domain-separated secret,
// so a demo token can never be used as a real staff session (cln_session) and
// vice-versa. A demo session is otherwise an ordinary OWNER session whose org
// has isDemo set — isolation still runs through orgDb(demoOrgId).
const COOKIE_NAME = "cln_demo"

function getSecret() {
  const secret = process.env.CLEANING_SESSION_SECRET
  const raw = secret ?? "cleaning-dev-secret-change-me-in-production-32ch"
  if (!secret && process.env.NODE_ENV === "production") throw new Error("CLEANING_SESSION_SECRET is not set")
  return encodeSecret(`demo:${raw}`) // domain separation from the staff secret
}

export async function createDemoSession(payload: Omit<SessionPayload, "exp">) {
  const token = await signJwt({ ...payload, isDemo: true } as unknown as Record<string, unknown>, getSecret(), { expiresIn: "1d" })
  await setSessionCookie(COOKIE_NAME, token, { secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 })
}

export async function getDemoSession(): Promise<SessionPayload | null> {
  const token = await getSessionToken(COOKIE_NAME)
  if (!token) return null
  const s = await verifyJwt<SessionPayload>(token, getSecret())
  // A valid demo token must be flagged isDemo — never accept a non-demo claim here.
  if (!s || !s.isDemo) return null
  return s
}

export async function deleteDemoSession() {
  await deleteSessionCookie(COOKIE_NAME)
}

export const DEMO_COOKIE_NAME = COOKIE_NAME
