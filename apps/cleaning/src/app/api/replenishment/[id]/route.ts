import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { replenishmentReviewSchema } from "@/lib/zod-schemas"
import { reviewReplenishmentRequest } from "@/lib/data/inventory"
const CAP = "supplies.inventory"
type Ctx = { params: Promise<{ id: string }> }
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const b = await parseBody(replenishmentReviewSchema, request); if (!b.ok) return b.response
  return runWrite(async () => ((await reviewReplenishmentRequest(g.orgId, id, g.session.userId, b.data.status, b.data.resolutionNote)) ? { reviewed: true } : null))
}
