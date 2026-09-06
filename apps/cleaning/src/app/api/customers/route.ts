import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { customerCreateSchema } from "@/lib/zod-schemas"
import { createCustomer, listCustomers } from "@/lib/data/customers"

const CAP = "core.customers"

export async function GET() {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  return ok(await listCustomers(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(customerCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createCustomer(g.orgId, body.data), { created: true })
}
