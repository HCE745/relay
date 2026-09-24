import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { supplyCreateSchema } from "@/lib/zod-schemas"
import { createSupply, listSupplies } from "@/lib/data/supplies"

const CAP = "supplies.inventory"

export async function GET() {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  return ok(await listSupplies(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(supplyCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createSupply(g.orgId, body.data), { created: true })
}
