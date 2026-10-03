import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { productionRateCreateSchema } from "@/lib/zod-schemas"
import { listProductionRates, createProductionRate } from "@/lib/data/production-rates"

const CAP = "crm.bidCalculator"

export async function GET() {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  return ok(await listProductionRates(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(productionRateCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createProductionRate(g.orgId, body.data), { created: true })
}
