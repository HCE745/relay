import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { contractCreateSchema } from "@/lib/zod-schemas"
import { createContract, listContracts } from "@/lib/data/contracts"

const CAP = "crm.contracts"

export async function GET() {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  return ok(await listContracts(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(contractCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createContract(g.orgId, body.data), { created: true })
}
