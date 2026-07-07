import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
import type { SessionPayload } from "@/lib/session"
import { checkLimit, getIP, limiters } from "@/lib/ratelimit"

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "relay-secret-key-change-in-production-32ch"
)

// Completely public — no session needed
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth",
  "/invite",
  "/api/invite",
  "/api/pwa-icon",
  "/icon",
  "/apple-icon",
  "/manifest.webmanifest",
  // Super admin login page and all SA API routes (they self-guard internally)
  "/super-admin/login",
  "/api/super-admin",
  // Demo system — unauthenticated start + self-guarded APIs
  "/demo",
  "/tour",
  "/api/demo",
]

// Authenticated but bypass onboarding/billing guards
const ONBOARDING_PATHS = ["/onboarding",  "/api/onboarding"]
const BILLING_PATHS    = ["/billing",     "/api/billing"]
// Super admin API routes guard themselves; middleware just lets them through
const SA_API_PATHS     = ["/api/super-admin"]

// API paths excluded from global rate limiting
const RATE_LIMIT_EXEMPT = ["/api/webhooks", "/api/cron", "/monitoring-tunnel"]

// Stamp the relay-vm cookie onto a successful (non-redirect) response when
// ?videomode=true or ?videomode=false is present in the URL.
function applyVideoMode(response: NextResponse, param: string | null): NextResponse {
  if (param === "true") {
    response.cookies.set("relay-vm", "1", {
      path: "/",
      maxAge: 7200,
      sameSite: "lax",
      httpOnly: false,
    })
  } else if (param === "false") {
    response.cookies.delete("relay-vm")
  }
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const vmParam = searchParams.get("videomode")

  // ── Global rate limit (500 req/min per IP) on all API routes ─────────────
  if (
    pathname.startsWith("/api/") &&
    !RATE_LIMIT_EXEMPT.some((p) => pathname.startsWith(p))
  ) {
    const blocked = await checkLimit(
      limiters.global,
      `global:${getIP(request)}`,
      "Too many requests. Please slow down.",
    )
    if (blocked) return blocked
  }

  // ── Fully public ─────────────────────────────────────────────────────────
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return applyVideoMode(NextResponse.next(), vmParam)
  }

  // ── Require a valid session for everything else ───────────────────────────
  const token = request.cookies.get("session")?.value
  if (!token) {
    // Redirect unauthenticated super-admin panel requests to its own login
    if (pathname.startsWith("/super-admin")) {
      return NextResponse.redirect(new URL("/super-admin/login", request.url))
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  let session: SessionPayload
  try {
    const { payload } = await jwtVerify(token, SECRET)
    session = payload as unknown as SessionPayload
  } catch {
    if (pathname.startsWith("/super-admin")) {
      return NextResponse.redirect(new URL("/super-admin/login", request.url))
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // ── Super admin panel routing ──────────────────────────────────────────────
  if (pathname.startsWith("/super-admin")) {
    // Only super admin sessions may access the panel
    if (!session.superAdmin) {
      return NextResponse.redirect(new URL("/super-admin/login", request.url))
    }
    return applyVideoMode(NextResponse.next(), vmParam)
  }

  // Super admins (not impersonating) must stay inside /super-admin
  if (session.superAdmin && !session.impersonatedBy) {
    return NextResponse.redirect(new URL("/super-admin", request.url))
  }

  // Super admin API routes self-guard; let them through
  if (SA_API_PATHS.some((p) => pathname.startsWith(p))) {
    return applyVideoMode(NextResponse.next(), vmParam)
  }

  // ── Impersonation sessions bypass all app-level restrictions ──────────────
  if (session.impersonatedBy) {
    return applyVideoMode(NextResponse.next(), vmParam)
  }

  // ── Onboarding guard ──────────────────────────────────────────────────────
  if (ONBOARDING_PATHS.some((p) => pathname.startsWith(p))) {
    return applyVideoMode(NextResponse.next(), vmParam)
  }
  if (session.onboardingCompleted === false) {
    return NextResponse.redirect(new URL("/onboarding", request.url))
  }

  // ── Trial / billing guard ─────────────────────────────────────────────────
  if (BILLING_PATHS.some((p) => pathname.startsWith(p))) {
    return applyVideoMode(NextResponse.next(), vmParam)
  }
  const trialExpired =
    session.trialEndsAt &&
    new Date(session.trialEndsAt) < new Date() &&
    session.subscriptionStatus !== "active"

  if (trialExpired) {
    return NextResponse.redirect(new URL("/billing", request.url))
  }

  return applyVideoMode(NextResponse.next(), vmParam)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
