import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { jobPostingUpdateSchema } from "@/lib/zod-schemas"
import { updateJobPosting } from "@/lib/data/hiring"
const CAP = "workforce.hiring"
type Ctx = { params: Promise<{ id: string }> }
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(jobPostingUpdateSchema, request); if (!body.ok) return body.response
  return runWrite(() => updateJobPosting(g.orgId, id, body.data))
}
