import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { markMissedSchema } from "@/lib/zod-schemas"
import { markJobMissed } from "@/lib/data/jobs"

const CAP = "core.jobs"
type Ctx = { params: Promise<{ id: string }> }

// Manual MISSED only (no automated grace-period logic). Reason required + audited.
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(markMissedSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => markJobMissed(g.orgId, id, g.session.userId, body.data.reason))
}
