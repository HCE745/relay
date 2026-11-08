import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { createTestRegToken, TEST_REG_COOKIE, TOKEN_MAX_AGE } from "@/lib/test-registration-token"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// POST — generate a short-lived HMAC-signed test registration token and set it as an HttpOnly cookie.
// The register route checks this cookie server-side and sets isDemo=true on the new org.
export async function POST() {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = createTestRegToken()
  const expiresAt = new Date(Date.now() + TOKEN_MAX_AGE * 1000).toISOString()

  const response = NextResponse.json({
    ok: true,
    signupUrl: "/register",
    expiresAt,
    message: `Test token set for ${TOKEN_MAX_AGE / 60} minutes. Open /register in this browser to test the public signup flow.`,
  })

  response.cookies.set(TEST_REG_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_MAX_AGE,
  })

  return response
}

// DELETE — clear the test registration cookie
export async function DELETE() {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const response = NextResponse.json({ ok: true })
  response.cookies.set(TEST_REG_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return response
}
