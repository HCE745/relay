import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { planTaxabilitySchema } from "@/lib/zod-schemas"
import { setPlanTaxability } from "@/lib/data/tax-rates"

const CAP = "billing.salesTax"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(planTaxabilitySchema, request); if (!body.ok) return body.response
  return runWrite(() => setPlanTaxability(g.orgId, id, body.data))
}
