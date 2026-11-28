import "server-only"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { validateEmployeeSession, extendEmployeeSession } from "@/lib/employee-session"

export const dynamic = "force-dynamic"

// POST /api/auth/employee/heartbeat
//
// Called periodically by the client to extend the inactivity timeout.
// Re-signs the JWT with a new expiry of now + inactivityTimeoutSeconds,
// capped by the original max session duration.
//
// Returns 200 { ok: true } on success, 401 on invalid/expired session.
export async function POST() {
  const session = await getSession()
  if (!session || session.sessionType !== "employee") {
    return NextResponse.json({ error: "No active employee session" }, { status: 401 })
  }

  const validation = await validateEmployeeSession(session)
  if (!validation.valid) {
    return NextResponse.json({ error: "Session has been revoked" }, { status: 401 })
  }

  const extended = await extendEmployeeSession(session)
  if (!extended) {
    // No inactivity timeout configured or session at hard cap — not an error
    return NextResponse.json({ ok: true, extended: false })
  }

  return NextResponse.json({ ok: true, extended: true })
}
