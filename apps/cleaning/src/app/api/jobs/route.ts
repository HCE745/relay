import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { manualJobCreateSchema } from "@/lib/zod-schemas"
import { createManualJob } from "@/lib/data/jobs"

const CAP = "core.jobs"

// Create a one-time / manual Job (special cleans, move-outs, emergencies) that
// does not require a recurring ServicePlan.
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(manualJobCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createManualJob(g.orgId, body.data), { created: true })
}
