import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { credentialUpdateSchema } from "@/lib/zod-schemas"
import { updateCredential, deleteCredential } from "@/lib/data/credentials"

const CAP = "workforce.compliance"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = await parseBody(credentialUpdateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => updateCredential(g.orgId, id, body.data))
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  return runWrite(async () => ((await deleteCredential(g.orgId, id)) ? { deleted: true } : null))
}
