import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { supplyAdjustSchema } from "@/lib/zod-schemas"
import { adjustSupply } from "@/lib/data/supplies"

const CAP = "supplies.inventory"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(supplyAdjustSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => adjustSupply(g.orgId, id, g.session.userId, body.data))
}
