import { requireAccountManager } from "@/lib/guards"
import { ok } from "@/lib/api"
import { listExclusions } from "@/lib/data/service-areas"
const CAP = "operations.serviceAreas"
export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listExclusions(g.orgId))
}
