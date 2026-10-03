import { requireAccountManager } from "@/lib/guards"
import { parseBody, parseQuery, runWrite, ok } from "@/lib/api"
import { unavailabilityCreateSchema } from "@/lib/zod-schemas"
import { listUnavailability, createUnavailability } from "@/lib/data/availability"
import { z } from "zod"

const CAP = "workforce.coverage"

export async function GET(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const q = parseQuery(z.object({ userId: z.string().optional() }), request.url)
  if (!q.ok) return q.response
  return ok(await listUnavailability(g.orgId, { userId: q.data.userId, from: new Date() }))
}

export async function POST(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const body = await parseBody(unavailabilityCreateSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => createUnavailability(g.orgId, body.data, g.session.userId), { created: true })
}
