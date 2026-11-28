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
import { prisma } from "@/lib/prisma"

const _sessionSecret = process.env.SESSION_SECRET
if (!_sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required — set it in .env or Vercel dashboard")
}
const SECRET = encodeSecret(_sessionSecret)

export type SessionPayload = {
  userId: string
  email: string
  name: string
  role: string
  organizationId: string
  // Onboarding + trial (undefined = old session without field → no restriction)
  onboardingCompleted?: boolean
  trialStartDate?: string     // ISO string; set for white-glove orgs — trial blocked until this date
  trialEndsAt?: string        // ISO string; undefined = no trial restriction
  subscriptionStatus?: string // "trialing" | "active" | "expired" | "read_only"
  plan?: string               // "essentials" | "professional" | "custom" | "wash_essentials"
  productLine?: string        // "RELAY_STANDARD" | "WASH_ESSENTIALS"
  // Super admin panel access
  superAdmin?: boolean        // true = this is a super admin session
  superAdminId?: string       // set on both SA sessions and impersonation sessions
  // Sales team access (separate from super-admin)
  salesUserId?:   string      // set when a SalesUser logs in via /sales/login
  salesUserRole?: string      // "admin_sales" | "sales_rep"
  salesUserName?: string      // display name for the logged-in sales user
  // Impersonation (set when a super admin is viewing as an org admin)
  impersonatedBy?: string     // superAdminId of the SA doing the impersonation
  impersonatedByName?: string
  impersonatedOrgName?: string
  impersonationLogId?: string // ImpersonationLog.id for closing the audit record on exit
  // CRM rep impersonation (set when a super admin views the CRM as a sales rep)
  crmImpersonatedSalesUserId?: string   // SalesUser.id being viewed
  crmImpersonationExpiresAt?:  string   // ISO string; session auto-expires after 8h
  crmImpersonationLogId?:      string   // CrmRepImpersonationLog.id
  // Demo sessions
  isDemo?: boolean            // true = this session is an isolated sales demo
  exp?: number

  // ── Employee quick-access sessions (Phase 1) ───────────────────────────────
  sessionType?:               "standard" | "employee"
  deviceId?:                  string   // RegisteredDevice.id — set when session is device-bound
  deviceSessionVersion?:      number   // snapshot of RegisteredDevice.sessionVersion at login
  employeeSessionVersion?:    number   // snapshot of User.employeeSessionVersion at login
  // Session policy encoded at login — used by heartbeat endpoint to enforce cap
  sessionIssuedAt?:           number   // Unix seconds at original login (stable across heartbeats)
  maxSessionDurationSeconds?: number   // null-encoded as undefined — no max
  inactivityTimeoutSeconds?:  number   // null-encoded as undefined — no inactivity timeout
}

export async function createSession(payload: SessionPayload) {
  // When the payload encodes a device session policy, derive expiry from that policy.
  // This applies to both employee sessions and standard sessions on registered devices.
  // "Disabled" policy (both fields null/undefined) falls back to the 7-day default —
  // the session remains version-checked on every request and is therefore still revocable.
  const DEFAULT_SECS = 60 * 60 * 24 * 7
  let expiresInSec = DEFAULT_SECS

  if (payload.inactivityTimeoutSeconds !== undefined || payload.maxSessionDurationSeconds !== undefined) {
    const candidates: number[] = []
    if (payload.inactivityTimeoutSeconds  !== undefined) candidates.push(payload.inactivityTimeoutSeconds)
    if (payload.maxSessionDurationSeconds !== undefined) candidates.push(payload.maxSessionDurationSeconds)
    if (candidates.length > 0) {
      expiresInSec = Math.min(...candidates)
    }
  }

  const token = await signJwt(payload as unknown as Record<string, unknown>, SECRET, {
    expiresIn: `${expiresInSec}s`,
  })
  await setSessionCookie("session", token, {
    secure: process.env.NODE_ENV === "production",
    maxAge: expiresInSec,
  })
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = await getSessionToken("session")
  if (!token) return null
  const payload = await verifyJwt<SessionPayload>(token, SECRET)
  if (!payload) return null

  // For sessions bound to a registered device (employee or standard), verify the device
  // has not been revoked or had its sessions invalidated since this JWT was issued.
  // SameSite=Strict on the session cookie means cross-site requests cannot even send
  // the cookie, so CSRF is mitigated at the transport layer for all device-bound requests.
  if (payload.deviceId !== undefined && payload.deviceSessionVersion !== undefined) {
    const device = await prisma.registeredDevice.findUnique({
      where:  { id: payload.deviceId },
      select: { sessionVersion: true, isActive: true },
    })
    if (!device || !device.isActive || device.sessionVersion !== payload.deviceSessionVersion) {
      return null
    }
  }

  // For employee quick-access sessions, verify the employee session version.
  // Incremented on deactivation, password change, or admin force-logout.
  if (payload.sessionType === "employee" && payload.employeeSessionVersion !== undefined) {
    const user = await prisma.user.findUnique({
      where:  { id: payload.userId },
      select: { employeeSessionVersion: true, isActive: true },
    })
    if (!user || !user.isActive || user.employeeSessionVersion !== payload.employeeSessionVersion) {
      return null
    }
  }

  return payload
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
