import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { hash, compare } from "bcryptjs"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { getIP } from "@/lib/ratelimit"
import { normalizeCredential, computeCredentialIndex } from "@/lib/credential-hmac"
import { invalidateDeviceSessions } from "@/lib/employee-session"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// POST /api/settings/devices/[id]/rotate
//
// Rotates the device token: generates a new secret, updates the HMAC index and
// bcrypt hash, invalidates all current sessions bound to this device, and sets
// the new token as the relay-device cookie IF the caller is currently on this
// device (i.e., their relay-device cookie matches).
//
// CSRF note: SameSite=Strict on the session cookie means cross-site requests
// cannot include the session cookie, so unauthenticated cross-origin requests
// are blocked before they reach this handler.
//
// Requires ADMIN role.
export async function POST(request: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session)               return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const device = await prisma.registeredDevice.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, deviceTokenIndex: true, deviceTokenHash: true, isActive: true },
  })
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })
  if (!device.isActive) return NextResponse.json({ error: "Cannot rotate a revoked device" }, { status: 409 })

  // Generate new device token
  const newRawToken   = randomBytes(32).toString("hex")
  const newNormalized = normalizeCredential(newRawToken)
  const newTokenIndex = computeCredentialIndex(newNormalized)
  const newTokenHash  = await hash(newRawToken, 12)

  // Update token + increment sessionVersion atomically (invalidates all current sessions)
  await prisma.registeredDevice.update({
    where: { id },
    data: {
      deviceTokenIndex: newTokenIndex,
      deviceTokenHash:  newTokenHash,
      sessionVersion:   { increment: 1 },
    },
  })

  // Log the rotation as a session invalidation event
  void prisma.authAuditLog.create({
    data: {
      organizationId: session.organizationId,
      userId:         session.userId,
      deviceId:       id,
      outcome:        "SUCCESS",
      failureReason:  "SESSION_INVALIDATED",
      ipAddress:      getIP(request),
    },
  }).catch(() => undefined)

  // Determine whether the caller is currently on this device (cookie matches old token)
  const cookieStore  = await cookies()
  const currentToken = cookieStore.get("relay-device")?.value
  let   callerOnDevice = false

  if (currentToken) {
    const currentIndex = computeCredentialIndex(normalizeCredential(currentToken))
    if (currentIndex === device.deviceTokenIndex) {
      // Caller is on this device — verify via bcrypt before updating their cookie
      callerOnDevice = await compare(currentToken, device.deviceTokenHash)
    }
  }

  if (callerOnDevice) {
    const isProduction = process.env.NODE_ENV === "production"
    cookieStore.set("relay-device", newRawToken, {
      httpOnly:  true,
      secure:    isProduction,
      sameSite:  "strict",
      path:      "/",
      maxAge:    60 * 60 * 24 * 365 * 10,
    })
  }

  return NextResponse.json({
    ok:              true,
    cookieUpdated:   callerOnDevice,
  })
}
