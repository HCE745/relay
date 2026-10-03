import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { reassignSchema } from "@/lib/zod-schemas"
import { reassignJob } from "@/lib/data/coverage"

const CAP = "workforce.coverage"
type Ctx = { params: Promise<{ jobId: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { jobId } = await params
  const body = await parseBody(reassignSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => reassignJob(g.orgId, jobId, body.data, g.session.userId))
}
