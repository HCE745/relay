import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { normalizeCredential, computeCredentialIndex } from "@/lib/credential-hmac"

export const dynamic = "force-dynamic"

// GET /api/auth/device-info
//
// Returns the login mode and org info for the current device (from relay-device cookie).
// Used by login pages to determine whether to redirect to the kiosk Quick Access page.
//
// Response:
//   { isRegistered: false }                    — no device cookie / unknown device
//   { isRegistered: true, loginMode: "STANDARD" | "QUICK_ACCESS", organizationId, kioskPath }
export async function GET(_req: NextRequest) {
  const cookieStore = await cookies()
  const deviceToken = cookieStore.get("relay-device")?.value ?? null

  if (!deviceToken) {
    return NextResponse.json({ isRegistered: false })
  }

  const normalizedToken = normalizeCredential(deviceToken)
  const deviceTokenIndex = computeCredentialIndex(normalizedToken)

  const device = await prisma.registeredDevice.findUnique({
    where: { deviceTokenIndex },
    select: {
      id: true,
      organizationId: true,
      loginMode: true,
      isActive: true,
      organization: { select: { slug: true } },
    },
  })

  if (!device || !device.isActive) {
    return NextResponse.json({ isRegistered: false })
  }

  return NextResponse.json({
    isRegistered:   true,
    loginMode:      device.loginMode,
    organizationId: device.organizationId,
    organizationSlug: device.organization.slug,
    kioskPath:      "/kiosk/login",
  })
}
