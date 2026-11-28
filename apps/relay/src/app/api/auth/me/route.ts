import "server-only"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"

// GET /api/auth/me
//
// Returns the current session's basic user info.
// Used by kiosk dashboard to confirm session is still active and get the name.
// Returns 401 if no valid session.
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  return NextResponse.json({
    name:  session.name,
    role:  session.role,
    email: session.email,
  })
}
