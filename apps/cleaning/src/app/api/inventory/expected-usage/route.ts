import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { expectedUsageSchema } from "@/lib/zod-schemas"
import { setExpectedUsage } from "@/lib/data/inventory"
const CAP = "supplies.inventory"
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const b = await parseBody(expectedUsageSchema, request); if (!b.ok) return b.response
  return runWrite(() => setExpectedUsage(g.orgId, b.data))
}
