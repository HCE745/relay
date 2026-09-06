import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { generateJobsSchema } from "@/lib/zod-schemas"
import { generateJobsForServicePlan } from "@/lib/scheduling/generation"

const CAP = "core.jobs"
type Ctx = { params: Promise<{ id: string }> }

// Explicit, idempotent generation of the next N days of Jobs for a plan.
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(generateJobsSchema, request)
  if (!body.ok) return body.response

  const now = new Date()
  const end = new Date(now.getTime() + body.data.days * 86_400_000)
  return runWrite(() => generateJobsForServicePlan(g.orgId, id, now, end))
}
