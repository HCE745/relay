import { NextResponse } from "next/server"
import { systemDb } from "@/lib/org-db"

// Liveness by default (no DB). Pass ?deep=1 for a readiness check that pings the
// database — kept separate so liveness never depends on DB availability.
export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep")
  if (!deep) return NextResponse.json({ status: "ok", app: "cleaning" })

  try {
    await systemDb.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ok", app: "cleaning", db: "ok" })
  } catch (e) {
    // Surface the driver error to the server logs (never to the client). The pg
    // error message aids diagnosis (SSL/auth/host) and contains no credentials.
    console.error("[health] deep DB check failed:", e instanceof Error ? e.message : e)
    return NextResponse.json({ status: "degraded", app: "cleaning", db: "error" }, { status: 503 })
  }
}
