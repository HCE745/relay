import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { serviceLocationCreateSchema } from "@/lib/zod-schemas"
import { createServiceLocation, listAllSites } from "@/lib/data/service-locations"

const CAP = "core.locations"

export async function GET() {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  return ok(await listAllSites(g.orgId))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(serviceLocationCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createServiceLocation(g.orgId, body.data), { created: true })
}
