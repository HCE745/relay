import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { hash } from "bcryptjs"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { getIP } from "@/lib/ratelimit"
import { normalizeCredential, computeCredentialIndex } from "@/lib/credential-hmac"
import { invalidateDeviceSessions } from "@/lib/employee-session"

function auditLog(params: {
  organizationId?: string
  userId?: string
  deviceId?: string
  outcome: "SUCCESS" | "FAILURE"
  failureReason?: string
  ipAddress?: string
}) {
  void prisma.authAuditLog.create({ data: { authMethod: undefined, ...params } }).catch(() => undefined)
}

export const dynamic = "force-dynamic"

// ── GET /api/settings/devices ─────────────────────────────────────────────────
// Returns all registered devices for the caller's organization.
// Requires ADMIN role.
export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session)                       return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN")       return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const devices = await prisma.registeredDevice.findMany({
    where:   { organizationId: session.organizationId },
    orderBy: { registeredAt: "desc" },
    select: {
      id: true, deviceName: true, locationId: true, departmentId: true,
      stationId: true, loginMode: true, permittedMethods: true,
      inactivityTimeoutSeconds: true, maxSessionDurationSeconds: true,
      disableInactivityTimeout: true, disableMaxSessionDuration: true,
      platform: true, isActive: true, registeredAt: true, lastSeenAt: true,
      revokedAt: true,
      location:   { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ devices })
}

// ── POST /api/settings/devices/register ──────────────────────────────────────
// Registers the current device.
// The caller must be authenticated as an ADMIN. After registration the admin
// signs out and the device uses the persistent relay-device cookie.
// Requires ADMIN role.
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session)               return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json() as {
    deviceName?:                string
    locationId?:                string | null
    departmentId?:              string | null
    stationId?:                 string | null
    loginMode?:                 string
    permittedMethods?:          string[]
    inactivityTimeoutSeconds?:  number | null
    maxSessionDurationSeconds?: number | null
    disableInactivityTimeout?:  boolean
    disableMaxSessionDuration?: boolean
  }

  if (!body.deviceName?.trim()) {
    return NextResponse.json({ error: "deviceName is required" }, { status: 400 })
  }

  const loginMode = body.loginMode === "QUICK_ACCESS" ? "QUICK_ACCESS" : "STANDARD"
  const permitted = Array.isArray(body.permittedMethods) ? body.permittedMethods : []

  // Validate locationId and departmentId belong to this org
  if (body.locationId) {
    const loc = await prisma.location.findFirst({
      where: { id: body.locationId, organizationId: session.organizationId },
    })
    if (!loc) return NextResponse.json({ error: "Invalid locationId" }, { status: 400 })
  }
  if (body.departmentId) {
    const dept = await prisma.department.findFirst({
      where: { id: body.departmentId, organizationId: session.organizationId },
    })
    if (!dept) return NextResponse.json({ error: "Invalid departmentId" }, { status: 400 })
  }

  // Generate a cryptographically secure device token
  const rawToken   = randomBytes(32).toString("hex")
  const normalized = normalizeCredential(rawToken)
  const tokenIndex = computeCredentialIndex(normalized)
  const tokenHash  = await hash(rawToken, 12)

  const device = await prisma.registeredDevice.create({
    data: {
      organizationId:            session.organizationId,
      registeredByUserId:        session.userId,
      deviceName:                body.deviceName.trim(),
      locationId:                body.locationId   ?? null,
      departmentId:              body.departmentId ?? null,
      stationId:                 body.stationId    ?? null,
      loginMode,
      permittedMethods:          permitted,
      inactivityTimeoutSeconds:  body.inactivityTimeoutSeconds  ?? null,
      maxSessionDurationSeconds: body.maxSessionDurationSeconds ?? null,
      disableInactivityTimeout:  body.disableInactivityTimeout  ?? false,
      disableMaxSessionDuration: body.disableMaxSessionDuration ?? false,
      deviceTokenIndex:          tokenIndex,
      deviceTokenHash:           tokenHash,
      platform:                  request.headers.get("x-relay-platform") ?? null,
    },
  })

  auditLog({
    organizationId: session.organizationId,
    userId:         session.userId,
    deviceId:       device.id,
    outcome:        "SUCCESS",
    failureReason:  "DEVICE_REGISTERED",
    ipAddress:      getIP(request),
  })

  // Set the persistent device-identity cookie (HttpOnly, Secure, SameSite=Strict)
  const isProduction = process.env.NODE_ENV === "production"
  const cookieStore  = await cookies()
  cookieStore.set("relay-device", rawToken, {
    httpOnly:  true,
    secure:    isProduction,
    sameSite:  "strict",
    path:      "/",
    maxAge:    60 * 60 * 24 * 365 * 10,  // 10 years — persistent across employee logouts
  })

  return NextResponse.json({
    ok: true,
    device: {
      id:        device.id,
      deviceName: device.deviceName,
      loginMode: device.loginMode,
    },
  }, { status: 201 })
}

// ── DELETE /api/settings/devices (revoke current device) ─────────────────────
// Revokes the device identified by the relay-device cookie.
// Also clears the cookie and invalidates active sessions.
export async function DELETE(_req: NextRequest) {
  const session = await getSession()
  if (!session)               return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const cookieStore = await cookies()
  const rawToken    = cookieStore.get("relay-device")?.value

  if (!rawToken) {
    return NextResponse.json({ error: "No registered device on this browser" }, { status: 404 })
  }

  const idx = computeCredentialIndex(normalizeCredential(rawToken))
  const device = await prisma.registeredDevice.findUnique({
    where: { deviceTokenIndex: idx },
  })
  if (!device || device.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 })
  }

  await prisma.registeredDevice.update({
    where: { id: device.id },
    data:  { isActive: false, revokedAt: new Date() },
  })
  await invalidateDeviceSessions(device.id)

  auditLog({
    organizationId: session.organizationId,
    userId:         session.userId,
    deviceId:       device.id,
    outcome:        "SUCCESS",
    failureReason:  "DEVICE_REVOKED_ADMIN",
    ipAddress:      getIP(_req),
  })

  cookieStore.delete("relay-device")

  return NextResponse.json({ ok: true })
}
