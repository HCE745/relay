import { requireAccountManager } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { shiftDifferentialSchema } from "@/lib/zod-schemas"
import { listDifferentialRules, createDifferentialRule } from "@/lib/data/shift-differentials"

const CAP = "workforce.laborCosting"

export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listDifferentialRules(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(shiftDifferentialSchema, request); if (!body.ok) return body.response
  return runWrite(() => createDifferentialRule(g.orgId, body.data), { created: true })
}
