import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite } from "@/lib/api"
import { customerUpdateSchema } from "@/lib/zod-schemas"
import { updateCustomer, archiveCustomer, restoreCustomer } from "@/lib/data/customers"

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

// DELETE archives (soft) — a customer is never hard-deleted, so linked
// service-exclusion incident history and its customer association are preserved.
export async function DELETE(request: Request, { params }: Ctx) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const { id } = await params
  const body = (await request.json().catch(() => null)) as { reason?: string; restore?: boolean } | null
  if (body?.restore) {
    return runWrite(async () => ((await restoreCustomer(g.orgId, id)) ? { restored: true } : null))
  }
  const reason = body?.reason?.trim() || undefined
  return runWrite(async () => ((await archiveCustomer(g.orgId, id, g.session.userId, reason)) ? { archived: true } : null))
}
