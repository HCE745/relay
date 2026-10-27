import { requireAccountManager } from "@/lib/guards"
import { ok, parseBody, runWrite } from "@/lib/api"
import { sopSchema } from "@/lib/zod-schemas"
import { listSops, createSop } from "@/lib/data/sops"
const CAP = "operations.sopLibrary"
export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listSops(g.orgId))
}
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(sopSchema, request); if (!body.ok) return body.response
  return runWrite(() => createSop(g.orgId, g.session.userId!, body.data), { created: true })
}
