import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { taxRateUpdateSchema } from "@/lib/zod-schemas"
import { updateTaxRate } from "@/lib/data/tax-rates"

const CAP = "billing.salesTax"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(taxRateUpdateSchema, request); if (!body.ok) return body.response
  return runWrite(() => updateTaxRate(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  // Soft-delete: deactivate so historical invoices (which snapshot the rate) are untouched.
  return runWrite(() => updateTaxRate(g.orgId, id, { isActive: false }))
}
