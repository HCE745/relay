import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok, notFound } from "@/lib/api"
import { invoiceStatusActionSchema } from "@/lib/zod-schemas"
import { getInvoice, setInvoiceStatus } from "@/lib/data/invoices"

const CAP = "billing.invoicing"
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const invoice = await getInvoice(g.orgId, id)
  return invoice ? ok(invoice) : notFound()
}

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(invoiceStatusActionSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => setInvoiceStatus(g.orgId, id, body.data.status))
}
