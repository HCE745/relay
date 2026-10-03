import { NextResponse } from "next/server"
import { generatePeriodInvoicesAllOrgs } from "@/lib/data/period-invoicing"

// Recurring flat-period auto-invoicing for all orgs (Phase 9). Protected by
// CRON_SECRET (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`), same
// pattern as generate-jobs. Produces DRAFT invoices only — never auto-sends.
// Idempotent by construction (activePeriodKey unique), so retries are harmless.
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
  const results = await generatePeriodInvoicesAllOrgs()
  const created = results.reduce((s, r) => s + r.created, 0)
  const failed = results.filter((r) => r.error).length

  console.log(`[cron:period-invoices] orgs=${results.length} created=${created} failed=${failed} ms=${Date.now() - started}`)
  return NextResponse.json({ ok: failed === 0, orgs: results.length, created, failed, results })
}
