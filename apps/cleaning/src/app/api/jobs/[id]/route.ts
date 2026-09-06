import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { jobUpdateSchema } from "@/lib/zod-schemas"
import { updateJob } from "@/lib/data/jobs"

const CAP = "core.jobs"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(jobUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateJob(g.orgId, id, body.data))
}
