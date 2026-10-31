import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { collectionStepUpdateSchema } from "@/lib/zod-schemas"
import { updateCollectionStep } from "@/lib/data/collections"

const CAP = "billing.invoicing"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(collectionStepUpdateSchema, request); if (!body.ok) return body.response
  return runWrite(() => updateCollectionStep(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  return runWrite(() => updateCollectionStep(g.orgId, id, { isActive: false }))
}
