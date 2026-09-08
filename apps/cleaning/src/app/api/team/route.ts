import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { userCreateSchema } from "@/lib/zod-schemas"
import { listUsers, createUser } from "@/lib/data/users"

const CAP = "workforce.employees"

export async function GET() {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  return ok(await listUsers(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(userCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createUser(g.orgId, g.session.role, body.data), { created: true })
}
