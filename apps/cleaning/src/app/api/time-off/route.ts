import { requireAccountManager, requireSession } from "@/lib/guards"
import { parseBody, parseQuery, runWrite, ok, forbidden } from "@/lib/api"
import { timeOffRequestSchema } from "@/lib/zod-schemas"
import { listTimeOff, requestTimeOff } from "@/lib/data/timeoff"
import { orgHasCapability } from "@/lib/page-guards"
import { z } from "zod"

const CAP = "workforce.coverage"

// Managers list requests to review.
export async function GET(request: Request) {
  const g = await requireAccountManager(CAP)
  if (!g.ok) return g.response
  const q = parseQuery(z.object({ status: z.string().optional() }), request.url)
  if (!q.ok) return q.response
  return ok(await listTimeOff(g.orgId, { status: q.data.status }))
}

// Any authenticated user requests their own time off (cleaner-side, field app).
export async function POST(request: Request) {
  const g = await requireSession()
  if (!g.ok) return g.response
  if (!(await orgHasCapability(g.orgId, CAP))) return forbidden(`Missing capability: ${CAP}`)
  const body = await parseBody(timeOffRequestSchema, request)
  if (!body.ok) return body.response
  return runWrite(() => requestTimeOff(g.orgId, g.userId, body.data), { created: true })
}
