import { requireOperations } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { issueCommentSchema } from "@/lib/zod-schemas"
import { addIssueComment } from "@/lib/data/issues"

const CAP = "operations.issues"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const g = await requireOperations(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(issueCommentSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => addIssueComment(g.orgId, id, g.userId, body.data.body), { created: true })
}
