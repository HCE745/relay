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
  } catch {
    return NextResponse.json({ status: "degraded", app: "cleaning", db: "error" }, { status: 503 })
  }
}
