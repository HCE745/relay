import "server-only"
import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET ?? "change-me")

export type SessionPayload = {
  userId: string
  tenantId: string
  role: string
  entityIds: string[]
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET)
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("hce-session")?.value
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
