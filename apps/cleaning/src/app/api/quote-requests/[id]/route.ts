import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { quoteRequestUpdateSchema } from "@/lib/zod-schemas"
import { updateQuoteRequestStatus } from "@/lib/data/quote-requests"

const CAP = "crm.quoting"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(quoteRequestUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateQuoteRequestStatus(g.orgId, id, body.data.status))
}
