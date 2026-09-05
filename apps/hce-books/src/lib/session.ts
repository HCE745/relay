import "server-only"
import { signJwt, verifyJwt, encodeSecret, getSessionToken } from "@hce/auth"

const SECRET = encodeSecret(process.env.SESSION_SECRET ?? "change-me")

export type SessionPayload = {
  userId: string
  tenantId: string
  role: string
  entityIds: string[]
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return signJwt(payload as unknown as Record<string, unknown>, SECRET, { expiresIn: "7d" })
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  return verifyJwt<SessionPayload>(token, SECRET)
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = await getSessionToken("hce-session")
  if (!token) return null
  return verifySession(token)
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) {
    const { redirect } = await import("next/navigation")
    redirect("/login")
    // redirect() throws, but TypeScript doesn't know that
    throw new Error("Unreachable")
  }
  return session
}
