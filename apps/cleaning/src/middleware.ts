import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
import {
  experienceForRole,
  canAccessAdminRoute,
  landingPathForRole,
  ADMIN_ROUTE_KEYS,
} from "@/lib/rbac"

// Edge middleware: authenticate, then route users to the correct experience.
// It enforces AUTH + RBAC only (both static/pure). Capability gating requires a
// DB read and is done in server components, keeping the two systems orthogonal.
//
// (Next 16 renames this file to `proxy.ts`; Cleaning targets Next 15, so it is
//  `middleware.ts`.)

const SECRET = new TextEncoder().encode(
  process.env.CLEANING_SESSION_SECRET ?? "cleaning-dev-secret-change-me-in-production-32ch",
)

const PUBLIC_PATHS = ["/login", "/api/health", "/icon", "/apple-icon", "/manifest.webmanifest"]
const FIELD_PREFIXES = ["/today", "/job"]

function isUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(base + "/")
}

function toLogin(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => isUnder(pathname, p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get("cln_session")?.value
  if (!token) return toLogin(request)

  let role: string
  try {
    const { payload } = await jwtVerify(token, SECRET)
    role = String((payload as Record<string, unknown>).role ?? "")
  } catch {
    return toLogin(request)
  }

  // Root → role-appropriate landing.
  if (pathname === "/") {
    return NextResponse.redirect(new URL(landingPathForRole(role), request.url))
  }

  const experience = experienceForRole(role)
  const isField = FIELD_PREFIXES.some((p) => isUnder(pathname, p))

  // Cleaners live entirely in the field app.
  if (experience === "field") {
    return isField ? NextResponse.next() : NextResponse.redirect(new URL("/today", request.url))
  }

  // Management roles never see the field app.
  if (isField) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Static RBAC route gating for known admin sections (not API routes, which
  // self-guard). Unknown keys are left alone.
  if (!pathname.startsWith("/api/")) {
    const key = pathname.split("/")[1] || "dashboard"
    if (ADMIN_ROUTE_KEYS.has(key) && !canAccessAdminRoute(role, key)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
