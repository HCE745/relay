import { requireAccountManager } from "@/lib/guards"
import { parseBody, runWrite, ok } from "@/lib/api"
import { serviceAreaCreateSchema } from "@/lib/zod-schemas"
import { listServiceAreas, createServiceArea } from "@/lib/data/service-areas"
const CAP = "operations.serviceAreas"
export async function GET() {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  return ok(await listServiceAreas(g.orgId))
}
export async function POST(request: Request) {
  const g = await requireAccountManager(CAP); if (!g.ok) return g.response
  const body = await parseBody(serviceAreaCreateSchema, request); if (!body.ok) return body.response
  return runWrite(() => createServiceArea(g.orgId, body.data), { created: true })
}
