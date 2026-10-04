import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { accessItemCreateSchema } from "@/lib/zod-schemas"
import { listAccessItems, createAccessItem } from "@/lib/data/access"

const CAP = "operations.accessControl"

export async function GET() {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  return ok(await listAccessItems(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(accessItemCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createAccessItem(g.orgId, body.data), { created: true })
}
