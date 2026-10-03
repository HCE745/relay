import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { productionRateUpdateSchema } from "@/lib/zod-schemas"
import { updateProductionRate, archiveProductionRate } from "@/lib/data/production-rates"

const CAP = "crm.bidCalculator"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(productionRateUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateProductionRate(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(async () => ((await archiveProductionRate(g.orgId, id)) ? { archived: true } : null))
}
