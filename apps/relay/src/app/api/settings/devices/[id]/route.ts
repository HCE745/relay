import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { getIP } from "@/lib/ratelimit"
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

type RouteCtx = { params: Promise<{ id: string }> }

// ── GET /api/settings/devices/[id] ───────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session)               return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const device = await prisma.registeredDevice.findFirst({
    where: { id, organizationId: session.organizationId },
    select: {
      id: true, deviceName: true, locationId: true, departmentId: true,
      stationId: true, loginMode: true, permittedMethods: true,
      inactivityTimeoutSeconds: true, maxSessionDurationSeconds: true,
      disableInactivityTimeout: true, disableMaxSessionDuration: true,
      platform: true, deviceInfo: true, isActive: true,
      registeredAt: true, lastSeenAt: true, revokedAt: true, sessionVersion: true,
      location:   { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  })

  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })
  return NextResponse.json({ device })
}

// ── PATCH /api/settings/devices/[id] ─────────────────────────────────────────
// Update device configuration remotely.
// Incrementing sessionVersion invalidates all current sessions on the device.
export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session)               return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const existing = await prisma.registeredDevice.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Device not found" }, { status: 404 })

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
    // Explicit session invalidation (remote kick)
    invalidateSessions?:        boolean
  }

  if (body.locationId !== undefined && body.locationId !== null) {
    const loc = await prisma.location.findFirst({
      where: { id: body.locationId, organizationId: session.organizationId },
    })
    if (!loc) return NextResponse.json({ error: "Invalid locationId" }, { status: 400 })
  }
  if (body.departmentId !== undefined && body.departmentId !== null) {
    const dept = await prisma.department.findFirst({
      where: { id: body.departmentId, organizationId: session.organizationId },
    })
    if (!dept) return NextResponse.json({ error: "Invalid departmentId" }, { status: 400 })
  }

  const updated = await prisma.registeredDevice.update({
    where: { id },
    data: {
      ...(body.deviceName    !== undefined && { deviceName:    body.deviceName.trim() }),
      ...(body.locationId    !== undefined && { locationId:    body.locationId }),
      ...(body.departmentId  !== undefined && { departmentId:  body.departmentId }),
      ...(body.stationId     !== undefined && { stationId:     body.stationId }),
      ...(body.loginMode     !== undefined && {
        loginMode: body.loginMode === "QUICK_ACCESS" ? "QUICK_ACCESS" : "STANDARD",
      }),
      ...(body.permittedMethods           !== undefined && { permittedMethods:          body.permittedMethods }),
      ...(body.inactivityTimeoutSeconds   !== undefined && { inactivityTimeoutSeconds:  body.inactivityTimeoutSeconds }),
      ...(body.maxSessionDurationSeconds  !== undefined && { maxSessionDurationSeconds: body.maxSessionDurationSeconds }),
      ...(body.disableInactivityTimeout   !== undefined && { disableInactivityTimeout:  body.disableInactivityTimeout }),
      ...(body.disableMaxSessionDuration  !== undefined && { disableMaxSessionDuration: body.disableMaxSessionDuration }),
    },
  })

  // Invalidate active sessions if requested (e.g. after changing loginMode or permissions)
  if (body.invalidateSessions) {
    await invalidateDeviceSessions(id)
  }

  return NextResponse.json({ ok: true, device: { id: updated.id, deviceName: updated.deviceName } })
}

// ── DELETE /api/settings/devices/[id] ────────────────────────────────────────
// Remotely revoke a registered device and invalidate its active sessions.
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session)               return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const device = await prisma.registeredDevice.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })

  await prisma.registeredDevice.update({
    where: { id },
    data:  { isActive: false, revokedAt: new Date() },
  })

  await invalidateDeviceSessions(id)

  auditLog({
    organizationId: session.organizationId,
    userId:         session.userId,
    deviceId:       id,
    outcome:        "SUCCESS",
    failureReason:  "DEVICE_REVOKED_ADMIN",
    ipAddress:      getIP(_req),
  })

  return NextResponse.json({ ok: true })
}
