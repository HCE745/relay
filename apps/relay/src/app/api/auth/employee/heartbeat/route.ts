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
  // Allow heartbeat for employee quick-access sessions and standard sessions on
  // registered devices that have an inactivity policy (inactivityTimeoutSeconds set).
  // Revocation is already enforced by getSession() itself (correction #2).
  if (!session || !session.inactivityTimeoutSeconds) {
    return NextResponse.json({ error: "No active session with inactivity timeout" }, { status: 401 })
  }

  // For employee sessions: also validate via version check (defense-in-depth;
  // getSession already did this but explicit here for clarity in the audit trail).
  if (session.sessionType === "employee") {
    const validation = await validateEmployeeSession(session)
    if (!validation.valid) {
      return NextResponse.json({ error: "Session has been revoked" }, { status: 401 })
    }
  }

  const extended = await extendEmployeeSession(session)
  if (!extended) {
    // No inactivity timeout configured or session at hard cap — not an error
    return NextResponse.json({ ok: true, extended: false })
  }

  return NextResponse.json({ ok: true, extended: true })
}
