import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { userUpdateSchema } from "@/lib/zod-schemas"
import { updateUser } from "@/lib/data/users"

const CAP = "workforce.employees"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(userUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateUser(g.orgId, g.session.role, id, body.data))
}
