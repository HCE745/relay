// Server-only session-cookie helpers built on next/headers.
// These operate on the request cookie store (cookies() from next/headers).
// Routes that set cookies on a NextResponse object use that API directly and
// do not go through here.
import "server-only"
import { cookies } from "next/headers"

export type SessionCookieOptions = {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "lax" | "strict" | "none"
  maxAge?: number
  path?: string
}

// Sensible session defaults; callers override per app (e.g. secure in prod).
const DEFAULTS: SessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
}

/** Set a session cookie (httpOnly, sameSite=lax, path=/ by default). */
export async function setSessionCookie(
  name: string,
  token: string,
  opts: SessionCookieOptions = {},
): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(name, token, { ...DEFAULTS, ...opts })
}

/** Read a session cookie's raw token value, or undefined if absent. */
export async function getSessionToken(name: string): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(name)?.value
}

/** Delete a session cookie. */
export async function deleteSessionCookie(name: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(name)
}
