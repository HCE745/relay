import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { siteTaxabilitySchema } from "@/lib/zod-schemas"
import { setSiteTaxability } from "@/lib/data/tax-rates"

const CAP = "billing.salesTax"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(siteTaxabilitySchema, request); if (!body.ok) return body.response
  return runWrite(() => setSiteTaxability(g.orgId, id, body.data))
}
