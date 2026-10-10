import { generateUpcomingAllOrgs } from "@/lib/scheduling/generation"
import { runCron } from "@/lib/cron-alert"

// Rolling job generation for all orgs. CRON_SECRET-gated; idempotent (DB unique
// + P2002), so retries are harmless. Fails loud: any per-org error → 500 + alert.
export async function GET(request: Request) {
  const days = Number(new URL(request.url).searchParams.get("days") ?? 60)
  return runCron("generate-jobs", request, async () => {
    const results = await generateUpcomingAllOrgs(Number.isFinite(days) ? days : 60)
    const created = results.reduce((s, r) => s + (r.created ?? 0), 0)
    const failed = results.filter((r) => r.error).length
    return {
      failed,
      line: `orgs=${results.length} created=${created} failed=${failed}`,
      failures: results.filter((r) => r.error).map((r) => `${r.orgId}: ${r.error}`),
      body: { orgs: results.length, created, failed, results },
    }
  })
}
