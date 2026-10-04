import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { accessItemUpdateSchema, accessActionSchema } from "@/lib/zod-schemas"
import { updateAccessItem, issueAccessItem, returnAccessItem, markAccessItemLost } from "@/lib/data/access"
import { badRequest } from "@/lib/api"

const CAP = "operations.accessControl"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(accessItemUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateAccessItem(g.orgId, id, body.data))
}

// Custody actions: issue / return / mark lost (each audited in the data layer).
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(accessActionSchema, request)
  if (!body.ok) return body.response
  const actor = g.session.userId
  if (body.data.action === "issue") {
    if (!body.data.userId) return badRequest({ userId: ["Required to issue"] })
    return runWrite(() => issueAccessItem(g.orgId, id, body.data.userId!, actor))
  }
  if (body.data.action === "return") return runWrite(() => returnAccessItem(g.orgId, id, actor))
  return runWrite(() => markAccessItemLost(g.orgId, id, actor))
}
