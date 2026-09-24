import { requireCleaner } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { supplyUsageSchema } from "@/lib/zod-schemas"
import { recordSupplyUsage } from "@/lib/data/supplies"

const CAP = "supplies.inventory"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireCleaner(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(supplyUsageSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => recordSupplyUsage(g.orgId, g.userId, id, body.data), { created: true })
}
