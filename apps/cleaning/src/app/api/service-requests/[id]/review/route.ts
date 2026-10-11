import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { z } from "zod"
import { reviewServiceRequest } from "@/lib/data/service-requests"
const CAP = "core.jobs"
type Ctx = { params: Promise<{ id: string }> }
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(z.object({ approve: z.boolean() }), request); if (!body.ok) return body.response
  return runWrite(() => reviewServiceRequest(g.orgId, id, body.data.approve, g.session.userId))
}
