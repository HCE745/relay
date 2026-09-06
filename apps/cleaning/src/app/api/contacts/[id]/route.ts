import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { contactUpdateSchema } from "@/lib/zod-schemas"
import { updateContact, deleteContact } from "@/lib/data/contacts"

const CAP = "core.customers"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(contactUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateContact(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(async () => ((await deleteContact(g.orgId, id)) ? { deleted: true } : null))
}
