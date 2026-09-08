import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { setPasswordSchema } from "@/lib/zod-schemas"
import { setUserPassword } from "@/lib/data/users"

const CAP = "workforce.employees"
type Ctx = { params: Promise<{ id: string }> }

// Admin-set temporary/replacement password for an employee.
export async function POST(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(setPasswordSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => setUserPassword(g.orgId, g.session.role, id, body.data.password))
}
