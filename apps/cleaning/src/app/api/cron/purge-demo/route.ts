import { purgeExpiredDemoOrgs } from "@/lib/demo/provision"
import { runCron } from "@/lib/cron-alert"

// Purge expired demo orgs. CRON_SECRET-gated; each org deleted independently.
// Fails loud: any deletion failure → 500 + alert.
export async function GET(request: Request) {
  return runCron("purge-demo", request, async () => {
    const { purged, failed, failures } = await purgeExpiredDemoOrgs()
    return {
      failed,
      line: `purged=${purged} failed=${failed}`,
      failures,
      body: { purged, failed },
    }
  })
}
