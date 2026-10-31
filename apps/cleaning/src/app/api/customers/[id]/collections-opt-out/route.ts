import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { collectionsOptOutSchema } from "@/lib/zod-schemas"
import { setCustomerCollectionsOptOut } from "@/lib/data/collections"

const CAP = "billing.invoicing"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(collectionsOptOutSchema, request); if (!body.ok) return body.response
  return runWrite(() => setCustomerCollectionsOptOut(g.orgId, id, body.data.optOut))
}
