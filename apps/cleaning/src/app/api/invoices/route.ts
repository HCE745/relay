import { z } from "zod"
import { requireAccountManager } from "@/lib/guards"
import { parseBody, parseQuery, runWrite, ok } from "@/lib/api"
import { generateInvoiceSchema } from "@/lib/zod-schemas"
import { generateInvoice, listInvoices } from "@/lib/data/invoices"

const CAP = "billing.invoicing"
const listQuery = z.object({ status: z.string().optional(), customerId: z.string().optional() })

export async function GET(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const q = parseQuery(listQuery, request.url)
  if (!q.ok) return q.response
  return ok(await listInvoices(g.orgId, q.data))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(generateInvoiceSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => generateInvoice(g.orgId, body.data))
}
