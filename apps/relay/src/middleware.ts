import { type NextRequest, NextResponse } from "next/server"
import { verifyJwt, encodeSecret } from "@hce/auth"
import type { SessionPayload } from "@/lib/session"

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

// These sales endpoints are always permitted even during impersonation.
// Logout lets the SA abandon the impersonation session cleanly.
const ALWAYS_ALLOWED = new Set([
  "/api/sales/logout",
  "/api/sales/auth/logout",
])

export async function middleware(request: NextRequest) {
  // Only intercept mutation requests on the sales API surface.
  if (!MUTATION_METHODS.has(request.method)) return NextResponse.next()

  const path = request.nextUrl.pathname
  if (ALWAYS_ALLOWED.has(path)) return NextResponse.next()

  // Decode the session JWT at the edge (jose — no server-only needed).
  const sessionToken = request.cookies.get("session")?.value
  if (!sessionToken) return NextResponse.next()

  const secret = process.env.SESSION_SECRET
  if (!secret) return NextResponse.next()

  const payload = await verifyJwt<SessionPayload>(sessionToken, encodeSecret(secret))

  if (payload?.crmImpersonatedSalesUserId) {
    return NextResponse.json(
      { error: "This action is not permitted during CRM rep impersonation. Exit impersonation first." },
      { status: 403 }
    )
  }

  return NextResponse.next()
}

export const config = {
  // Run only on the sales API — super-admin routes are already guarded at the route level.
  matcher: ["/api/sales/:path*"],
}
