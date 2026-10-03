import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { timeOffReviewSchema } from "@/lib/zod-schemas"
import { reviewTimeOff } from "@/lib/data/timeoff"

const CAP = "workforce.coverage"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(timeOffReviewSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => reviewTimeOff(g.orgId, id, { approve: body.data.action === "approve", reviewerId: g.session.userId }))
}
