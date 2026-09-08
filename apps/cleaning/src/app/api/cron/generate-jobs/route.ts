import { NextResponse } from "next/server"
import { generateUpcomingAllOrgs } from "@/lib/scheduling/generation"

// Rolling job generation for all orgs. Protected by CRON_SECRET (Vercel Cron
// sends `Authorization: Bearer $CRON_SECRET`). Disabled unless the secret is set.
// Idempotent by construction (DB unique + P2002), so retries are harmless.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get("authorization")
  const qs = new URL(request.url).searchParams.get("secret")
  return header === `Bearer ${secret}` || qs === secret
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const days = Number(new URL(request.url).searchParams.get("days") ?? 60)
  const started = Date.now()
  const results = await generateUpcomingAllOrgs(Number.isFinite(days) ? days : 60)
  const created = results.reduce((s, r) => s + (r.created ?? 0), 0)
  const failed = results.filter((r) => r.error).length

  // Observability: one structured line per run.
  console.log(
    `[cron:generate-jobs] orgs=${results.length} created=${created} failed=${failed} ms=${Date.now() - started}`,
  )
  return NextResponse.json({ ok: failed === 0, orgs: results.length, created, failed, results })
}
