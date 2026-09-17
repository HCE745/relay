import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { invoicePaymentSchema } from "@/lib/zod-schemas"
import { addInvoicePayment } from "@/lib/data/invoices"

const CAP = "billing.invoicing"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(invoicePaymentSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => addInvoicePayment(g.orgId, id, body.data), { created: true })
}
