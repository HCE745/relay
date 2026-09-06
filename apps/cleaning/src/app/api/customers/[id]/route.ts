import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { customerUpdateSchema } from "@/lib/zod-schemas"
import { updateCustomer, archiveCustomer } from "@/lib/data/customers"

const CAP = "core.customers"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(customerUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateCustomer(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(async () => ((await archiveCustomer(g.orgId, id)) ? { archived: true } : null))
}
