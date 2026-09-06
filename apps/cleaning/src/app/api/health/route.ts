import { NextResponse } from "next/server"

// Public liveness probe — no auth, no DB. Used for uptime checks.
export function GET() {
  return NextResponse.json({ status: "ok", app: "cleaning" })
}
