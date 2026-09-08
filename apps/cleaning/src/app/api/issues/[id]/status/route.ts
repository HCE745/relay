import { requireOperations } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { issueStatusSchema } from "@/lib/zod-schemas"
import { setIssueStatus } from "@/lib/data/issues"

const CAP = "operations.issues"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireOperations(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(issueStatusSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => setIssueStatus(g.orgId, id, g.userId, body.data.status))
}
