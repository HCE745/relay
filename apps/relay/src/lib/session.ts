import "server-only"
import { cookies } from "next/headers"
import {
  signJwt,
  verifyJwt,
  encodeSecret,
  setSessionCookie,
  getSessionToken,
  deleteSessionCookie,
} from "@hce/auth"

const SECRET = encodeSecret(
  process.env.SESSION_SECRET ?? "relay-secret-key-change-in-production-32ch"
)

export type SessionPayload = {
  userId: string
  email: string
  name: string
  role: string
  organizationId: string
  // Onboarding + trial (undefined = old session without field → no restriction)
  onboardingCompleted?: boolean
  trialEndsAt?: string        // ISO string; undefined = no trial restriction
  subscriptionStatus?: string // "trialing" | "active" | "expired" | "read_only"
  plan?: string               // "essentials" | "professional" | "custom" | "wash_essentials"
  productLine?: string        // "RELAY_STANDARD" | "WASH_ESSENTIALS"
  // Super admin panel access
  superAdmin?: boolean        // true = this is a super admin session
  superAdminId?: string       // set on both SA sessions and impersonation sessions
  // Impersonation (set when a super admin is viewing as an org admin)
  impersonatedBy?: string     // superAdminId of the SA doing the impersonation
  impersonatedByName?: string
  impersonatedOrgName?: string
  impersonationLogId?: string // ImpersonationLog.id for closing the audit record on exit
  // Demo sessions
  isDemo?: boolean            // true = this session is an isolated sales demo
  exp?: number
}

export async function createSession(payload: SessionPayload) {
  const token = await signJwt(payload as unknown as Record<string, unknown>, SECRET, {
    expiresIn: "7d",
  })
  await setSessionCookie("session", token, {
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = await getSessionToken("session")
  if (!token) return null
  return verifyJwt<SessionPayload>(token, SECRET)
}

export async function deleteSession() {
  await deleteSessionCookie("session")
}

// ── Video mode display overrides ─────────────────────────────────────────────
// When relay-vm=1 cookie is present (set by middleware on ?videomode=true),
// display-only fields are overlaid so every page shows the demo persona.
// Auth/authorization is never affected — only name, title, and a flag.

export const VM_NAME  = "James Wilson"
export const VM_TITLE = "Plant Manager, Acme Manufacturing"

export type DisplaySession = SessionPayload & {
  videoMode: boolean
  displayName: string   // use this instead of session.name for UI display
  displayTitle: string  // role subtitle: either role or "Plant Manager, Acme Manufacturing"
}

export async function getDisplaySession(): Promise<DisplaySession | null> {
  const session = await getSession()
  if (!session) return null

  const cookieStore = await cookies()
  const videoMode = cookieStore.get("relay-vm")?.value === "1"

  return {
    ...session,
    videoMode,
    displayName:  videoMode ? VM_NAME  : session.name,
    displayTitle: videoMode ? VM_TITLE : session.role.toLowerCase(),
  }
}
