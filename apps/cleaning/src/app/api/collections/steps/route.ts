import { requireAccountManager } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { collectionStepSchema } from "@/lib/zod-schemas"
import { listCollectionSteps, createCollectionStep } from "@/lib/data/collections"

const CAP = "billing.invoicing"

export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listCollectionSteps(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(collectionStepSchema, request); if (!body.ok) return body.response
  return runWrite(() => createCollectionStep(g.orgId, body.data), { created: true })
}
