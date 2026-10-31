import { requireAccountManager } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { taxRateCreateSchema } from "@/lib/zod-schemas"
import { listTaxRates, createTaxRate } from "@/lib/data/tax-rates"

const CAP = "billing.salesTax"

export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listTaxRates(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(taxRateCreateSchema, request); if (!body.ok) return body.response
  return runWrite(() => createTaxRate(g.orgId, body.data), { created: true })
}
