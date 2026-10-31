import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { collectionsHoldSchema } from "@/lib/zod-schemas"
import { setInvoiceCollectionsHold } from "@/lib/data/collections"

const CAP = "billing.invoicing"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(collectionsHoldSchema, request); if (!body.ok) return body.response
  return runWrite(() => setInvoiceCollectionsHold(g.orgId, id, body.data.hold))
}
