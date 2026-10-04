import { NextResponse } from "next/server"
import { purgeExpiredDemoOrgs } from "@/lib/demo/provision"

// Purge expired demo orgs. Protected by CRON_SECRET (same pattern as the other
// crons). Each org is deleted independently; one failure never blocks the rest.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get("authorization")
  const qs = new URL(request.url).searchParams.get("secret")
  return header === `Bearer ${secret}` || qs === secret
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const started = Date.now()
  const { purged, failed, failures } = await purgeExpiredDemoOrgs()
  console.log(`[cron:purge-demo] purged=${purged} failed=${failed} ms=${Date.now() - started}${failures.length ? ` failures=${failures.join("; ")}` : ""}`)
  return NextResponse.json({ ok: failed === 0, purged, failed })
}
