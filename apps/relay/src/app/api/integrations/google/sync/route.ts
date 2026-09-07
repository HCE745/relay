import "server-only"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { ingestReviews } from "@/lib/customer-voice"

export const dynamic = "force-dynamic"

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Admin required" }, { status: 403 })

  try {
    const result = await ingestReviews(session.organizationId)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[google/sync] error:", err)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
