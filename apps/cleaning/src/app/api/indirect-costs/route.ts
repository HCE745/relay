import { requireAccountManager } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { indirectCostSchema } from "@/lib/zod-schemas"
import { listIndirectCostPools, createIndirectCostPool } from "@/lib/data/indirect-costs"

const CAP = "erp.siteProfitability"

export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listIndirectCostPools(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(indirectCostSchema, request); if (!body.ok) return body.response
  return runWrite(() => createIndirectCostPool(g.orgId, body.data), { created: true })
}
