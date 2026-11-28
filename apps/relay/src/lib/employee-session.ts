import "server-only"
import { signJwt, setSessionCookie } from "@hce/auth"
import { encodeSecret } from "@hce/auth"
import { prisma } from "@/lib/prisma"
import type { SessionPayload } from "@/lib/session"

// ── Auth policy types ─────────────────────────────────────────────────────────

export type AuthPolicyConfig = {
  permittedMethods:          string[]  // ["EMPLOYEE_ID","ACCESS_CODE","BADGE"]
  inactivityTimeoutSeconds:  number | null
  maxSessionDurationSeconds: number | null
  disableInactivityTimeout:  boolean
  disableMaxSessionDuration: boolean
}

export const DEFAULT_AUTH_POLICY: AuthPolicyConfig = {
  permittedMethods:          ["EMPLOYEE_ID", "ACCESS_CODE", "BADGE"],
  inactivityTimeoutSeconds:  null,
  maxSessionDurationSeconds: null,
  disableInactivityTimeout:  false,
  disableMaxSessionDuration: false,
}

// Merge org policy + per-device overrides into effective session policy.
export function resolveSessionPolicy(
  orgPolicy: AuthPolicyConfig | null,
  device: {
    inactivityTimeoutSeconds:  number | null
    maxSessionDurationSeconds: number | null
    disableInactivityTimeout:  boolean
    disableMaxSessionDuration: boolean
  } | null
): {
  inactivityTimeoutSeconds:  number | null
  maxSessionDurationSeconds: number | null
} {
  const org = orgPolicy ?? DEFAULT_AUTH_POLICY
  let inactivity  = org.inactivityTimeoutSeconds
  let maxDuration = org.maxSessionDurationSeconds

  if (device) {
    // Device-level overrides take precedence over org defaults when set
    if (device.disableInactivityTimeout) {
      inactivity = null
    } else if (device.inactivityTimeoutSeconds !== null) {
      inactivity = device.inactivityTimeoutSeconds
    }

    if (device.disableMaxSessionDuration) {
      maxDuration = null
    } else if (device.maxSessionDurationSeconds !== null) {
      maxDuration = device.maxSessionDurationSeconds
    }
  }

  // If org itself disables these, honour it even without a device
  if (org.disableInactivityTimeout) inactivity  = null
  if (org.disableMaxSessionDuration) maxDuration = null

  return { inactivityTimeoutSeconds: inactivity, maxSessionDurationSeconds: maxDuration }
}

// ── Employee session creation ─────────────────────────────────────────────────

type CreateEmployeeSessionParams = {
  user: {
    id:                    string
    name:                  string
    email:                 string
    role:                  string
    organizationId:        string
    employeeSessionVersion: number
  }
  device: {
    id:             string
    sessionVersion: number
    loginMode:      string
    inactivityTimeoutSeconds:  number | null
    maxSessionDurationSeconds: number | null
    disableInactivityTimeout:  boolean
    disableMaxSessionDuration: boolean
  } | null
  orgPolicy: AuthPolicyConfig | null
}

function getSecret() {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error("SESSION_SECRET environment variable is required")
  return encodeSecret(s)
}

// Computes the JWT expiry based on session policy.
// exp = now + min(inactivityTimeout, maxDuration), defaulting to 7 days if neither is set.
function computeExp(
  nowSecs:                   number,
  inactivityTimeoutSeconds:  number | null,
  maxSessionDurationSeconds: number | null
): number {
  const DEFAULT_SECS = 60 * 60 * 24 * 7  // 7 days
  const candidates: number[] = []
  if (inactivityTimeoutSeconds !== null) candidates.push(nowSecs + inactivityTimeoutSeconds)
  if (maxSessionDurationSeconds !== null) candidates.push(nowSecs + maxSessionDurationSeconds)
  if (candidates.length === 0) return nowSecs + DEFAULT_SECS
  return Math.min(...candidates)
}

export async function createEmployeeSession(params: CreateEmployeeSessionParams) {
  const { user, device, orgPolicy } = params
  const policy = resolveSessionPolicy(orgPolicy, device)

  const nowSecs      = Math.floor(Date.now() / 1000)
  const exp          = computeExp(nowSecs, policy.inactivityTimeoutSeconds, policy.maxSessionDurationSeconds)
  const expiresInSec = exp - nowSecs

  const payload: SessionPayload = {
    userId:         user.id,
    email:          user.email,
    name:           user.name,
    role:           user.role,
    organizationId: user.organizationId,
    // Employee session extensions
    sessionType:              "employee",
    employeeSessionVersion:   user.employeeSessionVersion,
    ...(device ? {
      deviceId:                device.id,
      deviceSessionVersion:    device.sessionVersion,
    } : {}),
    // Policy encoded in JWT for server-side heartbeat cap enforcement
    sessionIssuedAt:          nowSecs,
    maxSessionDurationSeconds: policy.maxSessionDurationSeconds ?? undefined,
    inactivityTimeoutSeconds:  policy.inactivityTimeoutSeconds ?? undefined,
  }

  const token = await signJwt(payload as unknown as Record<string, unknown>, getSecret(), {
    expiresIn: `${expiresInSec}s`,
  })

  await setSessionCookie("session", token, {
    secure: process.env.NODE_ENV === "production",
    maxAge: expiresInSec,
  })
}

// Extends the session's expiry to now + inactivityTimeout, capped by max session duration.
// Called by the heartbeat endpoint.
export async function extendEmployeeSession(session: SessionPayload): Promise<boolean> {
  if (session.sessionType !== "employee") return false
  if (!session.inactivityTimeoutSeconds) return false  // no inactivity timeout — nothing to extend

  const nowSecs   = Math.floor(Date.now() / 1000)
  const issuedAt  = (session as unknown as Record<string, unknown>).sessionIssuedAt as number | undefined ?? nowSecs
  const maxDur    = (session as unknown as Record<string, unknown>).maxSessionDurationSeconds as number | null | undefined ?? null

  const newExpiry = nowSecs + session.inactivityTimeoutSeconds
  const hardCap   = maxDur !== null ? issuedAt + maxDur : Infinity
  const exp       = Math.min(newExpiry, hardCap)

  if (exp <= nowSecs) return false  // already past hard cap

  const expiresInSec = exp - nowSecs
  const token = await signJwt(session as unknown as Record<string, unknown>, getSecret(), {
    expiresIn: `${expiresInSec}s`,
  })

  await setSessionCookie("session", token, {
    secure: process.env.NODE_ENV === "production",
    maxAge: expiresInSec,
  })

  return true
}

// ── Session validation ────────────────────────────────────────────────────────

type ValidationResult =
  | { valid: true }
  | { valid: false; reason: "not_employee" | "user_inactive" | "version_mismatch" | "device_revoked" }

// Checks employee session version and (if bound) device session version.
// Call this in employee-only routes to enforce revocation.
export async function validateEmployeeSession(session: SessionPayload): Promise<ValidationResult> {
  if (session.sessionType !== "employee") return { valid: false, reason: "not_employee" }

  const user = await prisma.user.findUnique({
    where:  { id: session.userId },
    select: { employeeSessionVersion: true, isActive: true },
  })
  if (!user || !user.isActive)                              return { valid: false, reason: "user_inactive" }
  if (user.employeeSessionVersion !== session.employeeSessionVersion)
                                                            return { valid: false, reason: "version_mismatch" }

  if (session.deviceId && session.deviceSessionVersion !== undefined) {
    const device = await prisma.registeredDevice.findUnique({
      where:  { id: session.deviceId },
      select: { sessionVersion: true, isActive: true },
    })
    if (!device || !device.isActive)                        return { valid: false, reason: "device_revoked" }
    if (device.sessionVersion !== session.deviceSessionVersion)
                                                            return { valid: false, reason: "version_mismatch" }
  }

  return { valid: true }
}

// Invalidates all active employee sessions for a user (e.g. deactivation).
export async function invalidateUserEmployeeSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data:  { employeeSessionVersion: { increment: 1 } },
  })
}

// Invalidates all active sessions bound to a device (e.g. device revocation).
export async function invalidateDeviceSessions(deviceId: string): Promise<void> {
  await prisma.registeredDevice.update({
    where: { id: deviceId },
    data:  { sessionVersion: { increment: 1 } },
  })
}
